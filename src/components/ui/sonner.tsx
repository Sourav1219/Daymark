"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-overlay)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border-soft)",
          "--success-bg": "#ecfdf3",
          "--success-border": "#86efac",
          "--success-text": "#116329",
          "--info-bg": "#eff6ff",
          "--info-border": "#bfdbfe",
          "--info-text": "#1e40af",
          "--warning-bg": "#fffbeb",
          "--warning-border": "#fde68a",
          "--warning-text": "#854d0e",
          "--error-bg": "#fff1f2",
          "--error-border": "#fecdd3",
          "--error-text": "#9f1239",
          "--border-radius": "var(--shape-control-radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
