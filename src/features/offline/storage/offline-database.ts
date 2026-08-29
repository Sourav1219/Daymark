"use client"

import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { QuestView } from "@/features/quests/domain/types"
import type {
  OfflineMutation,
  OfflineQuestConflict,
  OfflineScope,
} from "@/features/offline/domain/types"

// Keep the database name stable so existing encrypted offline data is retained.
export const offlineDatabaseName = "questly-private-offline"
const lockVerifier = "traketo-offline-lock-v1"
// Existing encrypted offline stores must remain unlockable after the rename.
const legacyLockVerifier = "daymark-offline-lock-v1"
const keyDerivationIterations = 150_000
export const offlineSnapshotLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1_000
export const offlineDatabaseVersion = 3

type SealedValue = Readonly<{ ciphertext: string; iv: string }>
type LockRecord = Readonly<{
  kind: "lock"
  salt: string
  scopeFingerprint: string | null
  verifier: SealedValue
}>
type ScopeRecord = Readonly<{ kind: "scope"; sealed: SealedValue }>
type EncryptedSnapshot = Readonly<{
  scopeKey: string
  sealed: SealedValue
  updatedAt: string
}>
type EncryptedMutation = Readonly<{
  createdAt: string
  id: string
  scopeKey: string
  sealed: SealedValue
  status: "conflict" | "pending"
}>

interface OfflineDatabaseSchema extends DBSchema {
  meta: {
    key: string
    value: LockRecord | ScopeRecord
  }
  mutations: {
    indexes: { "by-scope": string; "by-status": string }
    key: string
    value: EncryptedMutation
  }
  snapshots: {
    key: string
    value: EncryptedSnapshot
  }
}

export class OfflineStorageLockedError extends Error {
  constructor() {
    super("Offline data is locked.")
    this.name = "OfflineStorageLockedError"
  }
}

let databasePromise: Promise<IDBPDatabase<OfflineDatabaseSchema>> | null = null
let unlockedKey: CryptoKey | null = null

function database() {
  databasePromise ??= openDB<OfflineDatabaseSchema>(
    offlineDatabaseName,
    offlineDatabaseVersion,
    {
      upgrade(current, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          current.createObjectStore("meta")
          current.createObjectStore("snapshots", { keyPath: "scopeKey" })
          const mutations = current.createObjectStore("mutations", {
            keyPath: "id",
          })
          mutations.createIndex("by-scope", "scopeKey")
          mutations.createIndex("by-status", "status")
        }

        const storeNames = current.objectStoreNames as unknown as DOMStringList
        if (oldVersion < 2 && storeNames.contains("questCache")) {
          ;(current as unknown as IDBDatabase).deleteObjectStore("questCache")
        }
        // Version 2 stored task content in plaintext. Never migrate it into the
        // protected format: discard it so an upgrade cannot preserve exposure.
        if (oldVersion > 0 && oldVersion < 3) {
          transaction.objectStore("meta").clear()
          transaction.objectStore("snapshots").clear()
          transaction.objectStore("mutations").clear()
        }
      },
    },
  )

  return databasePromise
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(passcode: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      hash: "SHA-256",
      iterations: keyDerivationIterations,
      name: "PBKDF2",
      salt: Uint8Array.from(salt),
    },
    material,
    { length: 256, name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"],
  )
}

async function seal(value: unknown, key: CryptoKey): Promise<SealedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  }
}

async function unseal<T>(value: SealedValue, key: CryptoKey): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { iv: base64ToBytes(value.iv), name: "AES-GCM" },
    key,
    base64ToBytes(value.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

async function scopeFingerprint(scopeKey: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(scopeKey),
  )
  return bytesToBase64(new Uint8Array(digest))
}

async function lockRecord() {
  const record = await (await database()).get("meta", "offline-lock")
  return record?.kind === "lock" ? record : null
}

async function encryptionKey(required = true) {
  const lock = await lockRecord()
  if (!lock) return null
  if (!unlockedKey && required) throw new OfflineStorageLockedError()
  return unlockedKey
}

export async function getOfflineStorageStatus() {
  const enabled = Boolean(await lockRecord())
  return { enabled, locked: enabled && !unlockedKey } as const
}

export const offlinePasscodeMinLength = 8

export async function enablePrivateOfflineData(passcode: string) {
  if (passcode.length < offlinePasscodeMinLength || passcode.length > 128) {
    throw new Error(
      `Use an offline passcode between ${offlinePasscodeMinLength} and 128 characters.`,
    )
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passcode, salt)
  const verifier = await seal(lockVerifier, key)
  const current = await database()
  const transaction = current.transaction(
    ["meta", "mutations", "snapshots"],
    "readwrite",
  )
  await Promise.all([
    transaction.objectStore("meta").clear(),
    transaction.objectStore("mutations").clear(),
    transaction.objectStore("snapshots").clear(),
    transaction.objectStore("meta").put(
      {
        kind: "lock",
        salt: bytesToBase64(salt),
        scopeFingerprint: null,
        verifier,
      },
      "offline-lock",
    ),
  ])
  await transaction.done
  unlockedKey = key
}

export async function unlockPrivateOfflineData(passcode: string) {
  const lock = await lockRecord()
  if (!lock) return false
  try {
    const key = await deriveKey(passcode, base64ToBytes(lock.salt))
    const storedVerifier = await unseal<string>(lock.verifier, key)
    if (![lockVerifier, legacyLockVerifier].includes(storedVerifier))
      return false
    if (storedVerifier === legacyLockVerifier) {
      await (
        await database()
      ).put(
        "meta",
        { ...lock, verifier: await seal(lockVerifier, key) },
        "offline-lock",
      )
    }
    unlockedKey = key
    return true
  } catch {
    return false
  }
}

export function lockPrivateOfflineData() {
  unlockedKey = null
}

export async function setActiveOfflineScope(scope: OfflineScope) {
  const current = await database()
  const lock = await lockRecord()
  if (!lock) return
  const fingerprint = await scopeFingerprint(scope.key)

  if (lock.scopeFingerprint && lock.scopeFingerprint !== fingerprint) {
    await clearPrivateOfflineData()
    return
  }

  const key = await encryptionKey(false)
  if (!key) return

  const sealedScope = await seal(scope, key)
  const transaction = current.transaction(["meta"], "readwrite")
  await Promise.all([
    transaction
      .objectStore("meta")
      .put({ ...lock, scopeFingerprint: fingerprint }, "offline-lock"),
    transaction
      .objectStore("meta")
      .put({ kind: "scope", sealed: sealedScope }, "active-scope"),
  ])
  await transaction.done
}

export async function cacheOfflineQuests(
  scope: OfflineScope,
  quests: readonly QuestView[],
  now = new Date(),
) {
  const key = await encryptionKey(false)
  if (!key) return
  const current = await database()
  await current.put("snapshots", {
    scopeKey: scope.key,
    sealed: await seal(quests.slice(0, 200), key),
    updatedAt: now.toISOString(),
  })
}

function encryptedMutation(mutation: OfflineMutation, sealed: SealedValue) {
  return {
    createdAt: mutation.createdAt,
    id: mutation.id,
    scopeKey: mutation.scopeKey,
    sealed,
    status: mutation.status,
  } satisfies EncryptedMutation
}

export async function queueOfflineMutation(mutation: OfflineMutation) {
  const key = await encryptionKey()
  if (!key) throw new OfflineStorageLockedError()
  await (
    await database()
  ).put("mutations", encryptedMutation(mutation, await seal(mutation, key)))
}

export async function listOfflineMutations(scopeKey: string) {
  const key = await encryptionKey(false)
  if (!key) return []
  const records = await (
    await database()
  ).getAllFromIndex("mutations", "by-scope", scopeKey)
  return Promise.all(
    records.map((record) => unseal<OfflineMutation>(record.sealed, key)),
  )
}

export async function removeOfflineMutation(id: string) {
  await (await database()).delete("mutations", id)
}

async function updateMutation(
  id: string,
  update: (mutation: OfflineMutation) => OfflineMutation,
) {
  const key = await encryptionKey()
  if (!key) throw new OfflineStorageLockedError()
  const current = await database()
  const record = await current.get("mutations", id)
  if (!record) return
  const mutation = update(await unseal<OfflineMutation>(record.sealed, key))
  await current.put(
    "mutations",
    encryptedMutation(mutation, await seal(mutation, key)),
  )
}

export function markOfflineMutationConflict(
  id: string,
  conflict: OfflineQuestConflict,
) {
  return updateMutation(id, (mutation) => ({
    ...mutation,
    conflict,
    status: "conflict",
  }))
}

export function retryOfflineMutationWithVersion(
  id: string,
  expectedVersion: number,
) {
  return updateMutation(id, (mutation) => {
    if (mutation.type === "create") return mutation
    return {
      ...mutation,
      conflict: null,
      payload: { ...mutation.payload, expectedVersion },
      status: "pending",
    } as OfflineMutation
  })
}

export async function readOfflineQuestState(now = new Date()) {
  const key = await encryptionKey()
  if (!key) return null
  const current = await database()
  const scopeRecord = await current.get("meta", "active-scope")
  if (!scopeRecord || scopeRecord.kind !== "scope") return null
  const scope = await unseal<OfflineScope>(scopeRecord.sealed, key)
  let snapshot = await current.get("snapshots", scope.key)
  if (
    snapshot &&
    now.getTime() - new Date(snapshot.updatedAt).getTime() >
      offlineSnapshotLifetimeMilliseconds
  ) {
    await current.delete("snapshots", scope.key)
    snapshot = undefined
  }
  const [quests, mutations] = await Promise.all([
    snapshot
      ? unseal<readonly QuestView[]>(snapshot.sealed, key)
      : Promise.resolve([]),
    listOfflineMutations(scope.key),
  ])
  const completedIds = new Set(
    mutations.flatMap((mutation) =>
      mutation.type === "complete" || mutation.type === "delete"
        ? [mutation.payload.questId]
        : [],
    ),
  )
  const edits = new Map(
    mutations
      .filter((mutation) => mutation.type === "edit")
      .map((mutation) => [mutation.payload.questId, mutation.payload]),
  )
  const queued = mutations
    .filter((mutation) => mutation.type === "create")
    .map((mutation) => mutation.optimisticQuest)

  return {
    conflicts: mutations.filter(({ status }) => status === "conflict"),
    pendingCount: mutations.filter(({ status }) => status === "pending").length,
    quests: [
      ...quests
        .filter(({ id }) => !completedIds.has(id))
        .map((quest) => {
          const edit = edits.get(quest.id)
          return edit
            ? {
                ...quest,
                description: edit.description,
                priority: edit.priority as QuestView["priority"],
                title: edit.title,
              }
            : quest
        }),
      ...queued,
    ],
    scope,
    updatedAt: snapshot?.updatedAt ?? null,
  } as const
}

export async function clearPrivateOfflineData() {
  const current = databasePromise ? await databasePromise : null
  current?.close()
  databasePromise = null
  unlockedKey = null
  await deleteDB(offlineDatabaseName)

  if ("caches" in globalThis) {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith("questly-private-"))
        .map((name) => caches.delete(name)),
    )
  }

  navigator.serviceWorker?.controller?.postMessage("QUESTLY_CLEAR_PRIVATE_DATA")
}

export function resetOfflineDatabaseConnectionForTests() {
  databasePromise = null
  unlockedKey = null
}
