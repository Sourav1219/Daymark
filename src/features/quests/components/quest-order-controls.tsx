"use client"

import type { KeyboardEvent } from "react"
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"

type QuestOrderControlsProps = Readonly<{
  canMoveDown: boolean
  canMoveUp: boolean
  disabled: boolean
  onPointerDown: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  title: string
}>

export function QuestOrderControls({
  canMoveDown,
  canMoveUp,
  disabled,
  onPointerDown,
  onMoveDown,
  onMoveUp,
  title,
}: QuestOrderControlsProps) {
  function handleGripKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (
      !event.altKey ||
      (event.key !== "ArrowUp" && event.key !== "ArrowDown")
    ) {
      return
    }

    event.preventDefault()
    if (event.key === "ArrowUp" && canMoveUp) onMoveUp()
    if (event.key === "ArrowDown" && canMoveDown) onMoveDown()
  }

  return (
    <div
      aria-label={`Reorder ${title}`}
      className="flex items-center gap-1"
      role="group"
    >
      <Button
        aria-label={`Drag ${title} to reorder`}
        className="cursor-grab touch-none active:cursor-grabbing"
        disabled={disabled}
        onKeyDown={handleGripKeyDown}
        onPointerDown={onPointerDown}
        size="icon-sm"
        title="Drag to reorder, or press Alt+Arrow Up/Down"
        type="button"
        variant="ghost"
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Move ${title} up`}
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <ChevronUp aria-hidden="true" />
      </Button>
      <Button
        aria-label={`Move ${title} down`}
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <ChevronDown aria-hidden="true" />
      </Button>
    </div>
  )
}
