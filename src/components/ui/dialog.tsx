"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogContent({
  className,
  overlayClassName,
  portalContainer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  overlayClassName?: string | undefined
  portalContainer?: HTMLElement | null | undefined
}) {
  return (
    <DialogPrimitive.Portal container={portalContainer}>
      <DialogPrimitive.Overlay
        className={cn("dialog-overlay", overlayClassName)}
        data-slot="dialog-overlay"
      />
      <DialogPrimitive.Content
        className={cn("dialog-content", className)}
        data-slot="dialog-content"
        {...props}
      />
    </DialogPrimitive.Portal>
  )
}

function DialogTitle(
  props: React.ComponentProps<typeof DialogPrimitive.Title>,
) {
  return <DialogPrimitive.Title data-slot="dialog-title" {...props} />
}

function DialogDescription(
  props: React.ComponentProps<typeof DialogPrimitive.Description>,
) {
  return (
    <DialogPrimitive.Description data-slot="dialog-description" {...props} />
  )
}

export { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger }
