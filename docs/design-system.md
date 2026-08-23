# Design system and application shell

Status: Phase 3 visual foundation.

## Token contract

All foundational values live in `src/app/globals.css` and are exposed to Tailwind CSS 4 through `@theme inline`. Components consume semantic utilities instead of repeating color, shadow, radius, spacing, typography, or motion values.

| Category        | CSS source tokens                                                              | Tailwind examples                                                              |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Surfaces        | `--surface-base`, `--surface-elevated`, `--surface-overlay`, `--surface-inset` | `bg-surface-base`, `bg-surface-elevated`                                       |
| Signature color | `--system-blue`, `--mana-violet`, `--spectral-cyan`                            | `text-system-blue`, `bg-mana-violet/10`, `border-spectral-cyan`                |
| Status          | `--status-success`, `--status-warning`, `--status-danger`                      | `text-success`, `text-warning`, `text-danger`                                  |
| Text            | `--text-primary`, `--text-muted`                                               | `text-ink`, `text-ink-muted`                                                   |
| Borders         | `--border-soft`, `--border-strong`                                             | `border-border-soft`, `ring-border-strong`                                     |
| Elevation       | `--shadow-panel`, `--shadow-float`, glow shadows and intensity tokens          | `shadow-panel`, `shadow-glow-blue`                                             |
| Typography      | Geist Sans/Mono plus display, page-title, signal, and tracking tokens          | `font-mono`, `text-page-title`, `text-signal`                                  |
| Density         | shell gutter, panel, section, sidebar, and rank-panel spacing tokens           | `px-shell-gutter`, `p-panel`, `gap-section`                                    |
| Shape           | control, panel, and shell radius tokens                                        | `rounded-control`, `rounded-panel`                                             |
| Motion          | instant/fast/standard/slow durations and system/emphasized easing              | `motion-interactive`, `duration-[var(--duration-standard)]`, `ease-emphasized` |

The shadcn semantic variables map to the same foundation, so `bg-card`, `text-muted-foreground`, `border-border`, and `ring-ring` remain consistent with custom shell utilities.

## Visual language

The shell uses an original restrained spectral treatment: a low-opacity grid, two token-derived ambient fields, thin active-navigation signals, and limited system/mana glows. Effects never communicate status without text. Strong glows are reserved for the brand mark and small status anchors rather than whole surfaces.

Global `prefers-reduced-motion: reduce` rules collapse transition and animation durations and stop repetition. No interaction depends on animation to reveal meaning.

## Reusable components

- `AppShell`: permanent mobile device-frame, skip link, header, main landmark, and toaster. The frame is centered and capped at a phone-like width on every viewport.
- `MobileNavigation`: the sheet-based route inventory, current-page semantics, and account/log-out controls, always used regardless of browser width.
- `TopCommandArea`: keyboard-operable command menu with route, create, help, and shortcut actions; its accessible notification dialog lists persisted Phase 7 reminders and restores focus when closed.
- `PageHeading`: one unique route-announcement heading plus optional actions.
- `EmptyState`, `PageSkeleton`, and `ErrorState`: semantic non-happy-path presentation.
- `ConfirmationDialog`: AlertDialog-backed explicit confirmation contract.
- `Toaster`: globally mounted Sonner announcements using design tokens.
- Owned shadcn primitives: Button, Card, Alert, Badge, Separator, Sheet, AlertDialog, Skeleton, inputs, and labels.

## Responsive contract

- Below `lg`, the desktop sidebar is removed and the header exposes a Sheet-based menu with all routes and logout.
- At `lg`, persistent sidebar navigation appears beside the main region.
- At `xl`, the optional rank placeholder occupies a third column. It contains no progression data or calculations.
- Main content uses a bounded width and responsive shell gutters. Interactive navigation targets are at least 44 CSS pixels on touch-oriented paths.

Every page provides a unique `<h1>`. Navigation uses Next.js links and `aria-current="page"`; dialogs provide titles/descriptions and focus management; the skip link targets the focusable main landmark. These behaviors are covered by component, keyboard, mobile, reduced-motion, and axe-core smoke tests.
