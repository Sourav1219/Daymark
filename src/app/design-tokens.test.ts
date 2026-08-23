// @vitest-environment node

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const appDir = fileURLToPath(new URL(".", import.meta.url))
const stylesDir = join(appDir, "styles")
const cssFiles = [
  join(appDir, "globals.css"),
  ...readdirSync(stylesDir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(stylesDir, f)),
]
const styles = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n")

describe("design token contract", () => {
  it.each([
    "--surface-base",
    "--surface-elevated",
    "--system-blue",
    "--mana-violet",
    "--spectral-cyan",
    "--status-success",
    "--status-warning",
    "--status-danger",
    "--text-primary",
    "--text-muted",
    "--border-soft",
    "--shadow-panel",
    "--font-sans",
    "--spacing-shell-gutter",
    "--radius-panel",
    "--duration-standard",
    "--ease-system",
  ])("defines the reusable %s token", (token) => {
    expect(styles).toContain(token)
  })

  it("provides a reduced-motion override", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)")
  })
})
