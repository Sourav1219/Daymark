import Link from "next/link"

type TodayFiltersProps = Readonly<{
  activeLabelId: string
  selectedDate?: string
  labels: readonly Readonly<{ id: string; name: string }>[]
}>

/**
 * Category chips. "All" clears the filter; each label chip sets `?labelId`,
 * reusing the existing quest filter pipeline.
 */
export function TodayFilters({
  activeLabelId,
  labels,
  selectedDate,
}: TodayFiltersProps) {
  return (
    <nav aria-label="Filter tasks" className="today-chips">
      <Link
        className="today-chip"
        data-active={activeLabelId === "any"}
        href={{
          pathname: "/today",
          query: selectedDate ? { date: selectedDate } : undefined,
        }}
      >
        All
      </Link>
      {labels.map((label) => (
        <Link
          className="today-chip"
          data-active={activeLabelId === label.id}
          href={{
            pathname: "/today",
            query: { date: selectedDate, labelId: label.id },
          }}
          key={label.id}
        >
          {label.name}
        </Link>
      ))}
    </nav>
  )
}
