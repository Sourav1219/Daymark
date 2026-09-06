"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

type ErrorStateProps = Readonly<{
  description?: string
  onRetry?: () => void
  title?: string
}>

export function ErrorState({
  description = "The interface could not complete that request. Check the latest state before trying again.",
  onRetry,
  title = "The signal broke formation.",
}: ErrorStateProps) {
  return (
    <div
      className="flex min-h-[min(65vh,480px)] w-full flex-col items-center justify-center px-2 py-6 text-center"
      role="alert"
    >
      <div className="relative isolate w-full max-w-sm overflow-hidden rounded-[2rem] border border-[rgba(215,224,245,0.7)] bg-gradient-to-b from-white/95 via-white/85 to-[rgba(244,246,255,0.85)] p-7 shadow-[0_16px_40px_-12px_rgba(30,64,140,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-all">
        <span className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-100/80 via-orange-50/50 to-pink-100/40 text-rose-500 shadow-[0_4px_16px_-4px_rgba(244,63,94,0.22)]">
          <TriangleAlert aria-hidden="true" className="size-7 stroke-[2.2]" />
        </span>
        <h1
          className="mt-5 text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl"
          style={{
            fontFamily: "var(--font-baloo), var(--font-nunito), sans-serif",
          }}
        >
          {title}
        </h1>
        <p className="mx-auto mt-2.5 max-w-xs text-sm font-medium leading-relaxed text-slate-500 text-pretty">
          {description}
        </p>
        {onRetry ? (
          <Button
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-7 text-sm font-bold text-white shadow-[0_6px_20px_-4px_rgba(37,99,235,0.42)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-[0.98]"
            onClick={onRetry}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-4 stroke-[2.4]" />
            <span>Try again</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
