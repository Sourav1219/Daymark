"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"

type TurnstileApi = Readonly<{
  remove: (widgetId: string) => void
  render: (
    container: HTMLElement,
    options: Readonly<{
      action: string
      callback: (token: string) => void
      "error-callback": () => void
      "expired-callback": () => void
      "response-field": boolean
      sitekey: string
      size: "flexible"
      theme: "auto"
    }>,
  ) => string
  reset: (widgetId: string) => void
}>

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type TurnstileWidgetProps = Readonly<{
  onVerifiedChange: (verified: boolean) => void
  resetSignal: unknown
  siteKey: string
}>

export function TurnstileWidget({
  onVerifiedChange,
  resetSignal,
  siteKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState("")
  const [unavailable, setUnavailable] = useState(false)

  const clearVerification = useCallback(() => {
    setToken("")
    onVerifiedChange(false)
  }, [onVerifiedChange])

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      action: "authentication",
      callback: (response) => {
        setUnavailable(false)
        setToken(response)
        onVerifiedChange(true)
      },
      "error-callback": () => {
        setUnavailable(true)
        clearVerification()
      },
      "expired-callback": clearVerification,
      "response-field": false,
      sitekey: siteKey,
      size: "flexible",
      theme: "auto",
    })
  }, [clearVerification, onVerifiedChange, siteKey])

  useEffect(() => {
    const widgetId = widgetIdRef.current
    if (!widgetId || !window.turnstile) return

    clearVerification()
    window.turnstile.reset(widgetId)
  }, [clearVerification, resetSignal])

  useEffect(
    () => () => {
      const widgetId = widgetIdRef.current
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      widgetIdRef.current = null
    },
    [],
  )

  return (
    <div className="auth__turnstile">
      <Script
        onError={() => {
          setUnavailable(true)
          clearVerification()
        }}
        onReady={renderWidget}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
      <input name="cf-turnstile-response" type="hidden" value={token} />
      {unavailable ? (
        <p className="auth__field-error" role="alert">
          The security check could not load. Check your connection and retry.
        </p>
      ) : null}
    </div>
  )
}
