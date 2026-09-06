import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const styles = readFileSync("src/app/styles/home-classification.css", "utf8")

for (const width of [320, 390, 480]) {
  test(`Task Type matches Priority button layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 12px; }
        ${styles}
        .home-choice-panel { animation: none; }
      </style>
      <section class="home-choice-panel" data-kind="type">
        <div class="home-choice-grid">
          <button>Any</button><button>Personal</button><button>Work</button>
          <button>Long custom type</button><button>Study</button>
        </div>
      </section>
      <section class="home-choice-panel" data-kind="priority">
        <div class="home-choice-grid">
          <button>Any</button><button>Low</button><button>Medium</button>
          <button>High</button><button>Critical</button>
        </div>
      </section>
    `)

    const typeButtons = page.locator(
      '[data-kind="type"] .home-choice-grid button',
    )
    const priorityButtons = page.locator(
      '[data-kind="priority"] .home-choice-grid button',
    )
    const typeFirst = (await typeButtons.nth(0).boundingBox())!
    const typeFourth = (await typeButtons.nth(3).boundingBox())!
    const priorityFirst = (await priorityButtons.nth(0).boundingBox())!
    const priorityFourth = (await priorityButtons.nth(3).boundingBox())!
    const [typeColumns, priorityColumns] = await page
      .locator(".home-choice-grid")
      .evaluateAll((grids) =>
        grids.map((grid) => getComputedStyle(grid).gridTemplateColumns),
      )

    expect(typeFirst.width).toBe(priorityFirst.width)
    expect(typeFirst.height).toBe(priorityFirst.height)
    expect(typeColumns).toBe(priorityColumns)
    expect(typeColumns!.split(" ")).toHaveLength(3)
    expect(typeFourth.y).toBeGreaterThan(typeFirst.y)
    expect(priorityFourth.y).toBeGreaterThan(priorityFirst.y)
    expect(typeFourth.x).toBe(typeFirst.x)
    expect(priorityFourth.x).toBe(priorityFirst.x)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  })
}
