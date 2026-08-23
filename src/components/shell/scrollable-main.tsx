"use client"

import { useEffect, useRef, useState, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

type ScrollableMainProps = ComponentProps<"main">

export function ScrollableMain({
  children,
  className,
  onScroll,
  ...props
}: ScrollableMainProps) {
  const [isScrolling, setIsScrolling] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )

  return (
    <div className={cn("device-main-viewport", isScrolling && "is-scrolling")}>
      <main
        className={cn("device-main", className)}
        onScroll={(event) => {
          onScroll?.(event)
          setIsScrolling(true)

          if (hideTimer.current) clearTimeout(hideTimer.current)
          hideTimer.current = setTimeout(() => setIsScrolling(false), 500)
        }}
        {...props}
      >
        {children}
      </main>
      <span aria-hidden="true" className="device-scroll-indicator" />
    </div>
  )
}
