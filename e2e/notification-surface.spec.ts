import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const styles = readFileSync("src/app/styles/notifications.css", "utf8")

for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 390, height: 664 },
  { width: 1280, height: 800 },
]) {
  test(`Notification surface remains usable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 10px; color: #17213c; font-family: sans-serif; }
        ${styles}
      </style>
      <section class="notification-popover">
        <header class="notification-popover__header">
          <span class="notification-popover__header-icon">B</span>
          <div class="notification-popover__heading">
            <div><h2>Notifications</h2><p>Tasks ending soon</p></div>
            <span class="notification-popover__status">2 new</span>
          </div>
        </header>
        <div class="notification-popover__content">
          <div class="notification-toolbar notification-toolbar--compact">
            <button class="notification-action notification-action--quiet">Mark all read</button>
          </div>
          <ul class="notification-list notification-list--compact">
            <li class="notification-item notification-item--unread notification-item--compact">
              <article>
                <div class="notification-item__body">
                  <span class="notification-item__clock">C</span>
                  <div class="notification-item__content">
                    <div class="notification-item__title-row">
                      <p>A very long notification title that must remain inside the panel on a narrow mobile screen</p>
                      <span class="notification-item__unread-dot"></span>
                    </div>
                    <p class="notification-item__deadline">Due in 12 minutes</p>
                    <p class="notification-item__due">Due today at 11:45 PM</p>
                  </div>
                </div>
                <div class="notification-item__actions notification-item__actions--compact">
                  <button class="notification-action notification-action--primary">Open task</button>
                  <button class="notification-action notification-action--quiet">Mark read</button>
                </div>
              </article>
            </li>
          </ul>
        </div>
      </section>
    `)

    const popover = page.locator(".notification-popover")
    await expect(popover).toBeVisible()
    const bounds = (await popover.boundingBox())!
    expect(bounds.width).toBeLessThanOrEqual(width - 20)
    expect(bounds.height).toBeLessThanOrEqual(height - 20)
    expect(bounds.x).toBeGreaterThanOrEqual(10)
    expect(bounds.y).toBeGreaterThanOrEqual(10)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 10)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 10)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)

    for (const button of await page.locator("button").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(32)
    }
  })
}
