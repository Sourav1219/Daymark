#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const reportPath = resolve(
  process.cwd(),
  process.argv[2] ?? process.env.LIGHTHOUSE_REPORT ?? "lighthouse-current.json",
)
const report = JSON.parse(await readFile(reportPath, "utf8"))

function sumAuditItemField(auditId, field) {
  const items = report.audits?.[auditId]?.details?.items
  if (!Array.isArray(items)) return undefined

  return items.reduce(
    (total, item) =>
      total + (typeof item?.[field] === "number" ? item[field] : 0),
    0,
  )
}

const budgets = [
  {
    label: "Performance score",
    actual: report.categories?.performance?.score,
    limit: 0.9,
    passes: (actual, limit) => actual >= limit,
    expected: ">= 0.90",
  },
  {
    label: "Accessibility score",
    actual: report.categories?.accessibility?.score,
    limit: 1,
    passes: (actual, limit) => actual >= limit,
    expected: "= 1.00",
  },
  {
    label: "Best practices score",
    actual: report.categories?.["best-practices"]?.score,
    limit: 1,
    passes: (actual, limit) => actual >= limit,
    expected: "= 1.00",
  },
  {
    label: "SEO score",
    actual: report.categories?.seo?.score,
    limit: 0.9,
    passes: (actual, limit) => actual >= limit,
    expected: ">= 0.90",
  },
  {
    label: "Largest Contentful Paint",
    actual: report.audits?.["largest-contentful-paint"]?.numericValue,
    limit: 3_000,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 3000 ms",
  },
  {
    label: "Total Blocking Time",
    actual: report.audits?.["total-blocking-time"]?.numericValue,
    limit: 200,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 200 ms",
  },
  {
    label: "Cumulative Layout Shift",
    actual: report.audits?.["cumulative-layout-shift"]?.numericValue,
    limit: 0.1,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 0.1",
  },
  {
    label: "Total transfer size",
    actual: report.audits?.["total-byte-weight"]?.numericValue,
    limit: 600 * 1_024,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 600 KiB",
  },
  {
    label: "Unused JavaScript savings",
    actual: report.audits?.["unused-javascript"]?.details?.overallSavingsBytes,
    limit: 50 * 1_024,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 50 KiB",
  },
  {
    label: "Legacy JavaScript savings",
    actual: sumAuditItemField("legacy-javascript-insight", "wastedBytes"),
    limit: 14 * 1_024,
    passes: (actual, limit) => actual <= limit,
    expected: "<= 14 KiB (framework compatibility floor)",
  },
  {
    label: "Render-blocking request savings",
    actual: sumAuditItemField("render-blocking-insight", "wastedMs"),
    limit: 0,
    passes: (actual, limit) => actual <= limit,
    expected: "= 0 ms",
  },
]

let failed = false

for (const budget of budgets) {
  if (typeof budget.actual !== "number") {
    console.error(
      `FAIL ${budget.label}: metric is missing (${budget.expected})`,
    )
    failed = true
    continue
  }

  if (!budget.passes(budget.actual, budget.limit)) {
    console.error(
      `FAIL ${budget.label}: ${budget.actual} (expected ${budget.expected})`,
    )
    failed = true
    continue
  }

  console.log(`PASS ${budget.label}: ${budget.actual}`)
}

if (failed) process.exit(1)

console.log(`Lighthouse budget passed: ${reportPath}`)
