"use client"

import { LockKeyhole, Trash2, TriangleAlert } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type ConfirmationDialogProps = Readonly<{
  appearance?: "default" | "permanent-delete"
  cancelLabel?: string
  confirmLabel: string
  description: string
  onConfirm: () => void
  title: string
  triggerLabel: string
  variant?: "default" | "destructive"
}>

export function ConfirmationDialog({
  appearance = "default",
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  onConfirm,
  title,
  triggerLabel,
  variant = "default",
}: ConfirmationDialogProps) {
  const permanentDelete = appearance === "permanent-delete"
  const mobileViewport =
    permanentDelete && typeof document !== "undefined"
      ? document.getElementById("app-device-viewport")
      : null

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant === "destructive" ? "destructive" : "outline"}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        className={permanentDelete ? "permanent-delete-dialog" : undefined}
        disableDefaultOverlayBlur={permanentDelete}
        overlayClassName={
          permanentDelete ? "permanent-delete-dialog__overlay" : undefined
        }
        portalContainer={permanentDelete ? mobileViewport : undefined}
      >
        {permanentDelete ? (
          <span aria-hidden="true" className="permanent-delete-dialog__orb" />
        ) : null}
        <AlertDialogHeader
          className={
            permanentDelete ? "permanent-delete-dialog__header" : undefined
          }
        >
          <AlertDialogMedia
            className={
              permanentDelete
                ? "permanent-delete-dialog__media"
                : "bg-warning/10 text-warning"
            }
          >
            {permanentDelete ? (
              <Trash2 aria-hidden="true" />
            ) : (
              <TriangleAlert aria-hidden="true" />
            )}
          </AlertDialogMedia>
          {permanentDelete ? (
            <div className="permanent-delete-dialog__copy">
              <span>Permanent deletion</span>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          ) : (
            <>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>
        {permanentDelete ? (
          <div className="permanent-delete-dialog__notice">
            <LockKeyhole aria-hidden="true" />
            <div>
              <strong>This cannot be undone</strong>
              <span>The task will disappear from Trash immediately.</span>
            </div>
          </div>
        ) : null}
        <AlertDialogFooter
          className={
            permanentDelete ? "permanent-delete-dialog__footer" : undefined
          }
        >
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            variant={variant === "destructive" ? "destructive" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
