import "server-only"

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import {
  downloadUrlLifetimeSeconds,
  uploadUrlLifetimeSeconds,
} from "@/features/attachments/domain/types"
import type {
  AttachmentObjectInspection,
  AttachmentStorage,
} from "@/features/attachments/storage/attachment-storage"
import type { R2Env } from "@/lib/env/schema"

function safeContentDisposition(displayName: string, inline: boolean) {
  const safeName = displayName.replace(/[^a-zA-Z0-9._ -]/gu, "_")
  return `${inline ? "inline" : "attachment"}; filename="${safeName}"`
}

function copySource(bucket: string, key: string) {
  return `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
}

/** Application-level deadline for one R2 API call. */
const r2RequestTimeoutMilliseconds = 15_000

export function createR2AttachmentStorage(config: R2Env): AttachmentStorage {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  })

  function boundedOptions() {
    return {
      abortSignal: AbortSignal.timeout(r2RequestTimeoutMilliseconds),
    }
  }

  return {
    async copyObject({ contentType, destinationKey, sourceETag, sourceKey }) {
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucketName,
          ContentType: contentType,
          CopySource: copySource(config.bucketName, sourceKey),
          CopySourceIfMatch: sourceETag,
          Key: destinationKey,
          MetadataDirective: "REPLACE",
        }),
        boundedOptions(),
      )
    },

    async createDownloadUrl({ contentType, displayName, key }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          ResponseContentDisposition: safeContentDisposition(
            displayName,
            contentType.startsWith("image/"),
          ),
          ResponseContentType: contentType,
        }),
        { expiresIn: downloadUrlLifetimeSeconds },
      )
    },

    async createUploadGrant({ contentType, key }) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucketName,
          ContentType: contentType,
          Key: key,
        }),
        { expiresIn: uploadUrlLifetimeSeconds },
      )

      return { headers: { "Content-Type": contentType }, url }
    },

    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
        boundedOptions(),
      )
    },

    async inspectObject(key): Promise<AttachmentObjectInspection> {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: config.bucketName, Key: key }),
        boundedOptions(),
      )
      const byteSize = head.ContentLength
      const eTag = head.ETag
      if (!eTag) throw new Error("R2 object did not provide an ETag")
      if (!byteSize || byteSize < 1) {
        return { byteSize: 0, eTag, prefix: new Uint8Array() }
      }

      const object = await client.send(
        new GetObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Range: "bytes=0-15",
        }),
        boundedOptions(),
      )
      const prefix = object.Body
        ? await object.Body.transformToByteArray()
        : new Uint8Array()

      return { byteSize, eTag, prefix }
    },
  }
}
