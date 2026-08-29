"use client"

import type { Route } from "next"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

export function QuestPagination({
  hasNextPage,
  page,
  paramName = "page",
}: Readonly<{
  hasNextPage: boolean
  page: number
  paramName?: "page" | "trashPage"
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage <= 1) params.delete(paramName)
    else params.set(paramName, String(nextPage))
    const query = params.toString()
    router.push((query ? `${pathname}?${query}` : pathname) as Route, {
      scroll: false,
    })
  }

  if (page === 1 && !hasNextPage) return null

  return (
    <nav
      aria-label="Task pages"
      className="flex items-center justify-center gap-3 py-4"
    >
      <Button
        disabled={page <= 1}
        onClick={() => navigate(page - 1)}
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <span className="text-sm text-ink-muted">Page {page}</span>
      <Button
        disabled={!hasNextPage}
        onClick={() => navigate(page + 1)}
        type="button"
        variant="outline"
      >
        Next
      </Button>
    </nav>
  )
}
