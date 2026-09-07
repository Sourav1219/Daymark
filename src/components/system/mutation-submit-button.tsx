"use client"

import { useFormStatus } from "react-dom"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export function MutationSubmitButton({
  className,
  disabled = false,
  idleLabel,
  pendingLabel,
}: Readonly<{
  className?: string | undefined
  disabled?: boolean | undefined
  idleLabel: string
  pendingLabel: string
}>) {
  const { pending } = useFormStatus()

  return (
    <Button className={className} disabled={disabled || pending} type="submit">
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : null}
      {pending ? pendingLabel : idleLabel}
    </Button>
  )
}
