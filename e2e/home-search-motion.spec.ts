import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

// Isolate the production styles so layout regressions need no authenticated database.
const styles = ["today-page.css", "home-classification.css"]
  .map((file) => readFileSync(`src/app/styles/${file}`, "utf8"))
  .join("\n")

for (const width of [320, 390, 1280]) {
  test(`Home search keeps its height and reveals horizontally at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 16px; }
        .home-filters { max-width: 600px; }
        ${styles}
      </style>
      <div class="home-filters">
        <nav class="today-chips home-filter-chips" data-search-open="false">
          <div class="home-filter-chips__controls">
            <button class="today-chip">All</button>
            <button class="today-chip home-filter-chip">Long custom task type</button>
            <button class="today-chip home-filter-chip">Priority</button>
          </div>
          <button class="today-chip home-search-chip">S</button>
          <div class="home-search-bar-slot">
            <div class="home-search-bar-wrap">
              <div class="home-search-field">
                <input class="home-search-field__input" type="search">
              </div>
              <button class="home-search-cancel-btn">Cancel</button>
            </div>
          </div>
        </nav>
        <div id="tasks">Tasks below search</div>
      </div>
    `)
    const row = page.locator("nav")
    const initialRow = await row.boundingBox()
    const initialTasks = await page.locator("#tasks").boundingBox()
    const search = page.locator(".home-search-bar-slot")
    const closedClip = await search.evaluate(
      (el) => getComputedStyle(el).clipPath,
    )

    for (const open of [true, false]) {
      await row.evaluate((el, value) => {
        el.setAttribute("data-search-open", String(value))
      }, open)
      // Sample a real CSS transition midway, not just its final state.
      const clips = await search.evaluate(async (el) => {
        getComputedStyle(el).getPropertyValue("clip-path")
        const transition = el
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.transitionProperty === "clip-path",
          )
        if (!transition) throw new Error("Missing horizontal search transition")
        transition.pause()
        await transition.ready
        transition.currentTime = 180
        const middle = getComputedStyle(el).clipPath
        const middleHeight = el.closest("nav")!.getBoundingClientRect().height
        const middleTasksY = document
          .querySelector("#tasks")!
          .getBoundingClientRect().y
        transition.finish()
        return {
          middle,
          middleHeight,
          middleTasksY,
          end: getComputedStyle(el).clipPath,
        }
      })
      expect(clips.middle).not.toBe(closedClip)
      expect(clips.middle).not.toBe(clips.end)
      expect(clips.middleHeight).toBe(initialRow!.height)
      expect(clips.middleTasksY).toBe(initialTasks!.y)
      expect(await row.boundingBox()).toEqual(initialRow)
      expect(await page.locator("#tasks").boundingBox()).toEqual(initialTasks)
    }

    await page.emulateMedia({ reducedMotion: "reduce" })
    await row.evaluate((el) => el.setAttribute("data-search-open", "true"))
    await expect(search).toHaveCSS("transition-duration", "0s")
    expect(await row.boundingBox()).toEqual(initialRow)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
  })
}
