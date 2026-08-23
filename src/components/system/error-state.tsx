"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ErrorStateProps = Readonly<{
  description?: string
  onRetry?: () => void
  title?: string
}>

export function ErrorState({
  description = "The interface could not complete that request. Your data has not been changed.",
  onRetry,
  title = "The signal broke formation.",
}: ErrorStateProps) {
  return (
    <Card className="border-danger/35 bg-card/78 shadow-panel" role="alert">
      <CardContent className="grid min-h-72 place-items-center p-section text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-danger/40 bg-danger/10 text-danger">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 leading-7 text-ink-muted">{description}</p>
          {onRetry ? (
            <Button className="mt-6" onClick={onRetry} type="button">
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
