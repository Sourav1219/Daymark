"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

type ScrollableMainProps = Omit<ComponentProps<"main">, "ref">

const scrollPositions = new Map<string, number>()

export function ScrollableMain({
  children,
  className,
  onScroll,
  ...props
}: ScrollableMainProps) {
  const { bfcacheId } = useRouter()
  const [isScrolling, setIsScrolling] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const scrollPosition = useRef(0)

  useLayoutEffect(() => {
    if (!bfcacheId) return

    const main = mainRef.current
    const savedPosition = scrollPositions.get(bfcacheId)

    if (main && savedPosition !== undefined) {
      main.scrollTop = savedPosition
      scrollPosition.current = savedPosition
    }

    return () => {
      scrollPositions.set(bfcacheId, main?.scrollTop ?? scrollPosition.current)
    }
  }, [bfcacheId])

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
          scrollPosition.current = event.currentTarget.scrollTop
          setIsScrolling(true)

          if (hideTimer.current) clearTimeout(hideTimer.current)
          hideTimer.current = setTimeout(() => setIsScrolling(false), 500)
        }}
        ref={mainRef}
        {...props}
      >
        {children}
      </main>
      <span aria-hidden="true" className="device-scroll-indicator" />
    </div>
  )
}
