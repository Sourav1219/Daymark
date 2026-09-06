import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HomeExperience } from "./home-experience"
import type { HomePage, TodayCard } from "@/features/today/types"

// Mock router and dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/features/today/application/home-actions", () => ({
  loadHomeFacets: vi.fn().mockResolvedValue({ priorities: [], types: [] }),
  loadHomePage: vi.fn(),
  loadHomePages: vi
    .fn()
    .mockResolvedValue({ pages: [], facets: { priorities: [], types: [] } }),
}))
vi.mock("@/features/today/application/today-promo-actions", () => ({
  claimTodayPromoAction: vi.fn(),
}))

function createCard(
  id: string,
  title: string,
  description?: string,
): TodayCard {
  return {
    id,
    title,
    description: description ?? null,
    steps: 0,
    priority: "medium",
    status: "open",
    timeLabel: "Today",
    version: 1,
    taskType: "work",
    customType: null,
  }
}

const mockInitialPages: readonly HomePage[] = [
  {
    bucket: "active",
    hasMore: false,
    offset: 0,
    cards: [
      createCard("1", "Buy groceries", "Milk, bread, eggs"),
      createCard("2", "Client contract review", "Important contract for Q3"),
      createCard("3", "Reply to client email", "Follow up on onboarding"),
      createCard("4", "Design sprint planning", "Prepare Miro board"),
    ],
  },
  { bucket: "completed", hasMore: false, offset: 0, cards: [] },
  { bucket: "missed", hasMore: false, offset: 0, cards: [] },
  {
    bucket: "deleted",
    hasMore: false,
    offset: 0,
    cards: [createCard("deleted-1", "Archived task")],
  },
]

describe("HomeExperience instant case-insensitive search", () => {
  it("filters and sorts tasks instantly without case sensitivity on 1-2 letters", () => {
    render(
      <HomeExperience
        activeLabelId="any"
        facets={{
          priorities: ["medium"],
          types: [{ customType: null, taskType: "work" }],
        }}
        history={[]}
        inbox={{ dueSoonQuests: [] }}
        initialPages={mockInitialPages}
        labels={[]}
        referenceNow="2026-09-06T00:00:00.000Z"
        selectedDate="2026-09-06"
        streak={3}
        timezone="UTC"
        todayDate="2026-09-06"
      />,
    )

    // All initial cards are visible
    expect(screen.getAllByText("Buy groceries")[0]).toBeVisible()
    expect(screen.getAllByText("Client contract review")[0]).toBeVisible()
    expect(screen.getAllByText("Reply to client email")[0]).toBeVisible()
    expect(screen.getAllByText("Design sprint planning")[0]).toBeVisible()
    expect(screen.queryByText("Recently deleted")).not.toBeInTheDocument()
    expect(screen.queryByText("Archived task")).not.toBeInTheDocument()

    // Open search
    const searchTrigger = screen.getByRole("button", { name: "Search tasks" })
    fireEvent.click(searchTrigger)

    const searchInput = screen.getByRole("searchbox", { name: "Search tasks" })

    // 1. Type uppercase "CL" (testing case-insensitivity on 2 letters)
    fireEvent.change(searchInput, { target: { value: "CL" } })

    // Instant match on "CL": Client contract review & Reply to client email match!
    expect(screen.getAllByText("Client contract review")[0]).toBeVisible()
    expect(screen.getAllByText("Reply to client email")[0]).toBeVisible()
    // Non-matching tasks disappear immediately!
    expect(screen.queryByText("Buy groceries")).toBeNull()
    expect(screen.queryByText("Design sprint planning")).toBeNull()

    // Verify ranking: "Client contract review" (title starts with "CL") is ordered before "Reply to client email"
    const articles = screen.getAllByRole("article")
    expect(articles[0]).toHaveTextContent("Client contract review")
    expect(articles[1]).toHaveTextContent("Reply to client email")

    // 2. Type "b" (testing 1 letter)
    fireEvent.change(searchInput, { target: { value: "b" } })
    // "Buy groceries" (starts with B) must be first
    expect(screen.getAllByText("Buy groceries")[0]).toBeVisible()
    const bArticles = screen.getAllByRole("article")
    expect(bArticles[0]).toHaveTextContent("Buy groceries")

    // 3. Clear search restores all tasks
    const clearBtn = screen.getByRole("button", { name: "Clear search" })
    fireEvent.click(clearBtn)
    expect(screen.getAllByText("Buy groceries")[0]).toBeVisible()
    expect(screen.getAllByText("Client contract review")[0]).toBeVisible()
    expect(screen.getAllByText("Reply to client email")[0]).toBeVisible()
    expect(screen.getAllByText("Design sprint planning")[0]).toBeVisible()
  })
})
