import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TodayFilters } from "@/features/today/components/today-filters"
import type { HomeFilters } from "@/features/today/types"

describe("TodayFilters", () => {
  it("renders filter chips including All, Type, and Priority", () => {
    render(
      <TodayFilters
        activeLabelId="any"
        filters={{
          customType: null,
          taskType: "any",
          priority: "any",
          labelId: "any",
        }}
        labels={[]}
      />,
    )

    expect(screen.getByRole("button", { name: "All" })).toBeVisible()
    expect(screen.getByRole("button", { name: /Type/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /Priority/i })).toBeVisible()
  })

  it("opens priority dropdown and triggers onChange when a priority is selected", () => {
    const onChange = vi.fn()
    render(
      <TodayFilters
        activeLabelId="any"
        facets={{ priorities: ["high"], types: [] }}
        filters={{
          customType: null,
          taskType: "any",
          priority: "any",
          labelId: "any",
        }}
        labels={[]}
        onChange={onChange}
      />,
    )

    const priorityChip = screen.getByRole("button", { name: /Priority/i })
    expect(priorityChip).toHaveAttribute("aria-expanded", "false")

    // Click Priority chip to open dropdown
    fireEvent.click(priorityChip)
    expect(priorityChip).toHaveAttribute("aria-expanded", "true")

    const panel = screen.getByRole("region", { name: "Priority" })
    expect(panel).toBeVisible()

    // Select High priority
    const highBtn = screen.getByRole("button", { name: "High" })
    fireEvent.click(highBtn)

    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "high",
      labelId: "any",
    })
  })

  it("displays active priority in filter chip and allows resetting via All", () => {
    const onChange = vi.fn()
    render(
      <TodayFilters
        activeLabelId="any"
        filters={{
          customType: null,
          taskType: "work",
          priority: "critical",
          labelId: "any",
        }}
        labels={[]}
        onChange={onChange}
      />,
    )

    expect(screen.getByRole("button", { name: /Work/i })).toHaveAttribute(
      "data-type",
      "work",
    )
    expect(screen.getByRole("button", { name: /Critical/i })).toHaveAttribute(
      "data-priority",
      "critical",
    )

    // Click All chip
    fireEvent.click(screen.getByRole("button", { name: "All" }))
    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
    })
  })

  it("shows only present facets and uses saved custom type names", () => {
    const onChange = vi.fn()
    render(
      <TodayFilters
        activeLabelId="any"
        facets={{
          priorities: ["medium"],
          types: [
            { customType: null, taskType: "personal" },
            { customType: "Gym", taskType: "custom" },
          ],
        }}
        filters={{
          customType: null,
          taskType: "any",
          priority: "any",
          labelId: "any",
        }}
        labels={[]}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Type/i }))
    expect(screen.getByRole("button", { name: "Any" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Personal" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Gym" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Work" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Custom" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Gym" }))
    expect(onChange).toHaveBeenCalledWith({
      customType: "Gym",
      taskType: "custom",
      priority: "any",
      labelId: "any",
    })

    fireEvent.click(screen.getByRole("button", { name: /Priority/i }))
    expect(screen.getByRole("button", { name: "Any" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Medium" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "High" })).toBeNull()
  })

  it("opens search bar when clicking search trigger and allows immediate typing and instant search", () => {
    const onChange = vi.fn()
    render(
      <TodayFilters
        activeLabelId="any"
        filters={{
          customType: null,
          taskType: "any",
          priority: "any",
          labelId: "any",
        }}
        labels={[]}
        onChange={onChange}
      />,
    )

    const searchTrigger = screen.getByRole("button", { name: "Search tasks" })
    expect(searchTrigger).toBeVisible()

    // Click to open search
    fireEvent.click(searchTrigger)

    // Filter chips should now be replaced by the expanded search bar
    expect(screen.queryByRole("button", { name: "All" })).toBeNull()
    const searchInput = screen.getByRole("searchbox", { name: "Search tasks" })
    expect(searchInput).toBeVisible()
    const cancelBtn = screen.getByRole("button", { name: "Close search" })
    expect(cancelBtn).toBeVisible()

    // Type query: instant onChange with no lag or debounce delay!
    fireEvent.change(searchInput, { target: { value: "project report" } })
    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
      search: "project report",
    })

    // Click cancel button to restore filter chips
    fireEvent.click(cancelBtn)
    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
      search: undefined,
    })
    expect(screen.getByRole("button", { name: "All" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Search tasks" })).toBeVisible()
  })

  it("supports Enter to apply search immediately and Escape to close", () => {
    const onChange = vi.fn()
    render(
      <TodayFilters
        activeLabelId="any"
        filters={{
          customType: null,
          taskType: "any",
          priority: "any",
          labelId: "any",
        }}
        labels={[]}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Search tasks" }))
    const searchInput = screen.getByRole("searchbox", { name: "Search tasks" })

    fireEvent.change(searchInput, { target: { value: "client call" } })
    fireEvent.keyDown(searchInput, { key: "Enter" })

    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
      search: "client call",
    })

    // Press Escape to cancel
    fireEvent.keyDown(searchInput, { key: "Escape" })
    expect(onChange).toHaveBeenCalledWith({
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
      search: undefined,
    })
    expect(screen.getByRole("button", { name: "All" })).toBeVisible()
  })

  it("preserves continuous typing across multiple keystrokes without cursor/value reset from prop echo", () => {
    let currentFilters: HomeFilters = {
      customType: null,
      taskType: "any",
      priority: "any",
      labelId: "any",
      search: undefined,
    }

    const { rerender } = render(
      <TodayFilters
        activeLabelId="any"
        filters={currentFilters}
        labels={[]}
        onChange={(next) => {
          currentFilters = next
        }}
      />,
    )

    // Open search
    fireEvent.click(screen.getByRole("button", { name: "Search tasks" }))
    const input = screen.getByRole("searchbox", {
      name: "Search tasks",
    }) as HTMLInputElement

    // 1st keystroke: user types 'c'
    fireEvent.change(input, { target: { value: "c" } })
    expect(input.value).toBe("c")

    // Parent re-renders with currentFilters.search = "c"
    rerender(
      <TodayFilters
        activeLabelId="any"
        filters={currentFilters}
        labels={[]}
        onChange={(next) => {
          currentFilters = next
        }}
      />,
    )
    expect(input.value).toBe("c")

    // 2nd keystroke: user types 'l' -> value is now 'cl'
    fireEvent.change(input, { target: { value: "cl" } })
    expect(input.value).toBe("cl")

    // Parent re-renders with currentFilters.search = "cl"
    rerender(
      <TodayFilters
        activeLabelId="any"
        filters={currentFilters}
        labels={[]}
        onChange={(next) => {
          currentFilters = next
        }}
      />,
    )
    // Must remain "cl" and never get reset or reverted back to "c"!
    expect(input.value).toBe("cl")

    // 3rd keystroke: user types space 'cl '
    fireEvent.change(input, { target: { value: "cl " } })
    expect(input.value).toBe("cl ")

    rerender(
      <TodayFilters
        activeLabelId="any"
        filters={currentFilters}
        labels={[]}
        onChange={(next) => {
          currentFilters = next
        }}
      />,
    )
    expect(input.value).toBe("cl ")

    // 4th keystroke: user types 'i' -> 'cl i'
    fireEvent.change(input, { target: { value: "cl i" } })
    expect(input.value).toBe("cl i")
  })
})
