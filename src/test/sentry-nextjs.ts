type Scope = Readonly<{
  setContext: () => void
  setFingerprint: () => void
  setLevel: () => void
  setTag: () => void
  setTags: () => void
}>

const scope: Scope = {
  setContext: () => undefined,
  setFingerprint: () => undefined,
  setLevel: () => undefined,
  setTag: () => undefined,
  setTags: () => undefined,
}

export const metrics = { count: () => undefined }

export function captureException(): string {
  return "test-sentry-event"
}

export function captureMessage(): string {
  return "test-sentry-event"
}

export function captureRequestError(): void {}

export function captureRouterTransitionStart(): void {}

export function init(): void {}

export function withScope<T>(callback: (currentScope: Scope) => T): T {
  return callback(scope)
}

export function withSentryConfig<T>(config: T): T {
  return config
}
