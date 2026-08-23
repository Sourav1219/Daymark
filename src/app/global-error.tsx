"use client"

import { Button } from "@/components/ui/button"

type GlobalErrorProps = Readonly<{
  reset: () => void
}>

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="dark">
      <body>
        <main className="state-shell" role="alert">
          <p className="eyebrow">System interruption</p>
          <h1 className="state-title">The agenda could not be opened.</h1>
          <Button
            className="health-link"
            type="button"
            variant="outline"
            onClick={reset}
          >
            Try again
          </Button>
        </main>
      </body>
    </html>
  )
}
