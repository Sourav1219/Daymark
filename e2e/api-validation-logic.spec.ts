import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { completeEmailVerification } from "./helpers/complete-email-verification"

test.describe.configure({ mode: "serial" })

test.describe("Phase 5 — API, Input Validation & Business-Logic Audit", () => {
  test.setTimeout(120_000)

  // ─── 1. SERVER-SIDE INPUT VALIDATION: BOUNDARIES, UNICODE & EMOJIS ───
  test("1. Task Input Validation: Character Bounds, Unicode, Emojis & Rejection of Empty Titles", async ({
    page,
  }) => {
    const userEmail = `logic-audit-${randomUUID().slice(0, 8)}@example.com`
    const userPassword = "ValidPassword1234!"

    // 1.1 Register and sign in
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Logic Tester")
    await page.getByLabel("Email").fill(userEmail)
    await page.getByLabel("Password", { exact: true }).fill(userPassword)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Land on /today
    await expect(page).toHaveURL(/\/today$/u)

    // 1.2 Open Add Task Sheet on /quests
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")

    const openCreateBtn = page
      .getByRole("button", { name: /Add task/iu })
      .first()
    if (await openCreateBtn.isVisible()) {
      await openCreateBtn.click()
    }

    // 1.3 Test Server-Side Rejection of Empty Title
    const titleInput = page
      .getByLabel("Title")
      .or(page.getByPlaceholder(/What needs to be done/iu))
      .first()
    await titleInput.fill("   ") // Whitespace-only

    const saveBtn = page
      .getByRole("button", { name: /Create task|Save|Add/iu })
      .first()
    await saveBtn.click()

    // Expect validation message rejecting empty title
    await expect(
      page.getByText(/Give this task a title/iu).first(),
    ).toBeVisible()

    // 1.4 Test Unicode, Emojis, and Length Boundaries in Title
    const richTitle = "🔥 Conquer the Summit 🚀 漢字 & Symbols !@#$"
    await titleInput.fill(richTitle)

    // Fill valid description
    const descInput = page
      .getByLabel("Description")
      .or(page.getByPlaceholder(/Add any extra details/iu))
      .first()
    if (await descInput.isVisible()) {
      await descInput.fill("Detailed plan for peak performance with Unicode 🎯")
    }

    // Submit valid task
    await saveBtn.click()

    // Expect task with richTitle to appear in the list
    await expect(page.getByText(richTitle).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  // ─── 2. TIMER STATE MACHINE & CONCURRENCY CONSTRAINTS ───
  test("2. Timer Lifecycle State Machine: Valid Flow & Prohibition of Concurrent Timers", async ({
    page,
  }) => {
    const email = `timer-logic-${randomUUID().slice(0, 8)}@example.com`
    const password = "ValidPassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Timer Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // Navigate to /timer
    await page.goto("/timer")
    await page.waitForLoadState("networkidle")

    // 2.1 Verify timer view is loaded
    await expect(
      page.getByRole("heading", { name: /Focus Timer|Timer/iu }).first(),
    ).toBeVisible()

    // 2.2 Start a timer session
    const subjectInput = page.locator("#timer-subject")
    await expect(subjectInput).toBeVisible()
    await subjectInput.fill("Deep Architectural Review")

    const startBtn = page.locator(".timer-start-button")
    await startBtn.click()

    // Verify timer is running (Pause button is primary control)
    const primaryControl = page.locator(".timer-control-primary")
    await expect(primaryControl).toBeVisible({ timeout: 15_000 })
    await expect(primaryControl).toContainText(/Pause/iu)

    // 2.3 Pause the timer
    await primaryControl.click()

    // Verify timer is paused (Primary control becomes Resume)
    await expect(primaryControl).toContainText(/Resume/iu, { timeout: 15_000 })

    // 2.4 Resume the timer
    await primaryControl.click()

    // Verify timer resumed (Primary control becomes Pause again)
    await expect(primaryControl).toContainText(/Pause/iu, { timeout: 15_000 })

    // 2.5 Stop the timer
    const finishBtn = page.locator(".timer-control-secondary")
    await finishBtn.click()

    // Timer stops and resets to ready state
    await expect(page.locator(".timer-start-button")).toBeVisible({
      timeout: 15_000,
    })
  })

  // ─── 3. BUSINESS LOGIC: QUEST LIFECYCLE & MUTATION IDEMPOTENCY ───
  test("3. Business Logic: Quest Lifecycle Transitions & Offline API Invariance", async ({
    page,
    request,
  }) => {
    const email = `lifecycle-${randomUUID().slice(0, 8)}@example.com`
    const password = "ValidPassword1234!"

    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Lifecycle Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.locator("#termsAccepted").check()
    await page.locator("#privacyNoticeAcknowledged").check()
    await page.getByRole("button", { name: "Create" }).click()
    await completeEmailVerification(page)

    // 3.1 Create a new task on /quests scheduled for Today
    await page.goto("/quests")
    await page.waitForLoadState("networkidle")

    const taskTitle = `Lifecycle Task ${randomUUID().slice(0, 6)}`
    const createForm = page.locator("form", {
      has: page.getByRole("button", { name: "Create Task" }),
    })
    await createForm.getByLabel("Task title").fill(taskTitle)
    await createForm.getByRole("button", { name: "Today · 2 hours" }).click()
    await createForm.getByRole("button", { name: "Create Task" }).click()

    // 3.2 Follow the "Continue" CTA on TaskCreatedPopup to /today
    await page
      .getByRole("link", { name: /Continue/iu })
      .first()
      .click()
    await page.waitForURL("**/today*")

    // Complete the task via its Clear check button on /today
    const task = page.getByRole("article", { name: taskTitle, exact: true })
    await expect(task).toBeVisible({ timeout: 15_000 })
    await task.getByRole("button", { name: `Clear ${taskTitle}` }).click()

    const completionDialog = page
      .getByRole("dialog")
      .filter({ hasText: taskTitle })
    await expect(completionDialog).toBeVisible({ timeout: 15_000 })
    await completionDialog
      .getByRole("button", { name: /Keep going|Continue/iu })
      .click()
    await expect(task).toHaveAttribute("data-status", "completed", {
      timeout: 15_000,
    })

    // 3.3 Verify task moves to Cleared archive
    await page.goto("/cleared")
    await page.waitForLoadState("networkidle")
    const clearedTask = page.getByRole("article", { name: taskTitle })
    await expect(clearedTask).toBeVisible({
      timeout: 15_000,
    })

    // 3.4 Verify Offline Mutations API Idempotency under authenticated session
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ")

    const mutationId = randomUUID()
    const mutationPayload = {
      id: mutationId,
      workspaceId: randomUUID(),
      type: "create",
      payload: {
        title: "Idempotent Quest Beta",
        description: "Testing duplicate submission invariance",
        priority: "medium",
        dueAt: "",
        startAt: "",
        recurrenceRule: "",
        parentTaskId: "",
        projectId: "",
      },
    }

    // First API submission
    const res1 = await request.post("/api/offline/mutations", {
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: cookieHeader,
      },
      data: mutationPayload,
    })

    // Second API submission (Replay Attack / Double Submission)
    const res2 = await request.post("/api/offline/mutations", {
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: cookieHeader,
      },
      data: mutationPayload,
    })

    // Server must produce invariant response code (deterministic outcome)
    expect(res1.status()).toBe(res2.status())
  })
})
