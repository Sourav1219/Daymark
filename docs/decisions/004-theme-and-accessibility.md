# ADR 004: Original theme and accessibility

- Status: Accepted
- Date: 2026-08-08

## Context

The product needs an atmospheric dark fantasy “System/Hunter” identity while remaining original, usable, and accessible. Heavy animation, low-contrast neon text, color-only state, and copied franchise assets would undermine those goals.

## Decision

Use original geometry, copy, layout, and effects with near-black surfaces and semantic electric blue, violet, and cyan tokens. Do not use official logos, characters, screenshots, dialogue, audio, fonts, icons, or other protected assets. shadcn source is owned in-repository; Lucide icons are used only where an icon is useful and always receive accessible treatment.

All visual choices use CSS tokens for surface, text, border, focus, semantic state, accent, radii, and motion duration. Interfaces meet WCAG AA contrast, expose visible `:focus-visible`, use correct landmarks/headings/labels, announce meaningful completion in text/live regions, and never use color alone. Mobile begins at 320 CSS pixels and layouts adapt across tablet/desktop without horizontal overflow.

Ordinary transitions target 150–250 ms. Motion is reserved for state change or meaningful completion; backgrounds do not animate continuously. `prefers-reduced-motion` removes nonessential motion while retaining status text and outcome. Phase 6 adds one short Arise Quest-completion glow with a static reduced-motion equivalent; rank/progression effects remain later gamification work.

## Consequences

- Token review enables consistent contrast and future theme evolution.
- Visual QA includes keyboard, screen reader semantics, zoom/reflow, mobile, and reduced motion—not screenshots alone.
- Some atmospheric effects must be reduced or removed if contrast/performance/accessibility fails.
- The Phase 1 placeholder establishes tone without implying functional Quest controls.

## Alternatives rejected

- **Direct imitation of an existing franchise:** legal/ethical risk and no original product identity.
- **Always-on particles/parallax:** distracts, consumes resources, and conflicts with reduced-motion needs.
- **Color-only priority/completion:** inaccessible to many users and ambiguous under theme changes.
- **Runtime theme library in Phase 1:** dark is the product baseline; add user theme choice only when it is a real requirement.
