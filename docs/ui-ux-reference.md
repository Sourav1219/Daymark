# Daymark UI/UX reference

Status: comprehensive study of the implemented UI (2026-08-22). Use this as the
canonical reference when building or modifying interfaces. Every claim is
observable in the cited source; re-verify copy strings before reuse.

## 1. Product identity and voice

- Wordmark: **Daymark**. Internal domain names are legacy ("quests", "gates",
  "cleared") but user-facing copy is productivity-toned: quests → **Tasks**,
  gates → **Lists**, cleared → **Completed**, `/today` → **Home**.
- Gamified layer survives as streaks/flames, "points"/XP, levels, momentum
  language ("Momentum gained", "Task complete!", "Your momentum is building").
- Tagline: "Your day, made doable". Auth headline: "Turn plans into progress."
- Tone: calm, encouraging, second person, short sentences. Errors never blame
  the user ("The signal broke formation.", "Your data has not been changed.").
- Mascot: `/public/mascots/daymark-guide-blue-transparent.png` on auth welcome.

## 2. Design tokens (`src/app/styles/base.css`, Tailwind 4 `@theme inline`)

Bright habit-tracker palette: white/soft-blue surfaces, one blue accent, warm
orange reserved for streaks/celebration. Legacy token names kept for stored-data
compatibility even though palette pivoted from ADR 004's dark fantasy theme.

### Core semantic tokens

| Token                                     | Value                             |
| ----------------------------------------- | --------------------------------- |
| `--surface-base`                          | `#eaf1fe`                         |
| `--surface-elevated` / `overlay`          | `#ffffff`                         |
| `--surface-inset`                         | `#eef3fd`                         |
| `--system-blue`                           | `#2f6bf6`                         |
| `--mana-violet`                           | `#7c5cff`                         |
| `--spectral-cyan`                         | `#38bdf8`                         |
| `--accent-orange`                         | `#ff7a1a`                         |
| `--status-success` / `warning` / `danger` | `#16a34a` / `#f59e0b` / `#e5484d` |
| `--text-primary` / `--text-muted`         | `#10233f` / `#5a6b85`             |
| `--border-soft` / `strong`                | rgba(30,64,140,.1) / .16          |
| `--focus-outline`                         | `#2f6bf6`                         |

shadcn mapping: `--primary: var(--system-blue)`, `--destructive:
var(--status-danger)`, `bg-card` = elevated white, `text-muted-foreground` =
muted. No global dark mode: `.app-auth-page` scopes its own midnight `--app-*`
overrides (`.app-light` opts out).

### Second-generation friendly family (page-scoped)

`--app-page-bg #eaf1fe`, `--app-bg #fff`, `--app-surface #eef3fd`,
`--app-surface-2 #f4f8ff`, `--accent-blue(-strong/-dim/-border)`,
`--app-orange(-strong/-dim/-border)`, `--app-red`, `--app-card-shadow`.

### Utility mapping (how to consume)

- Colors → `bg-surface-base`, `bg-surface-inset`, `text-ink`, `text-ink-muted`,
  `text-system-blue`, `bg-mana-violet/10`, `border-border-soft`,
  `ring-border-strong`, `text-success/warning/danger`.
- Type → `font-sans` Nunito body; `--font-baloo` (Baloo 2) display/headings;
  Caveat via `font-serif` italic for taglines/ledes; mono = Inter (XP numbers,
  version chips). Sizes: `text-display` clamp(2.6–5.5rem),
  `text-page-title` clamp(2–3.75rem), `text-signal` 0.7rem uppercase +0.18em.
  Hand-written eyebrow pattern: ~0.62rem uppercase 900 weight accent-blue.
- Space → `px-shell-gutter`, `p-panel`, `gap-section` (all clamp()).
- Shape → `rounded-control` .375rem, `rounded-panel` .625rem,
  `rounded-shell` .875rem; page CSS often uses 12–28px + 999px pills.
- Elevation → `shadow-panel`, `shadow-float`, `shadow-glow-blue/violet`
  (glows only for brand mark/status anchors), `--app-card-shadow` in pages.
- Motion → `motion-interactive` (160ms system ease), `motion-surface` (220ms
  emphasized); durations 90/160/220/360ms; entrance helpers `.enter-up`,
  `.enter-pop`, `.stagger` (45ms steps).
- Reduced motion: global kill-switch collapses all durations to 0.01ms; every
  stylesheet with animation adds its own reduce rules. No interaction depends
  on animation to reveal meaning.

### Accessibility contract (ADR 004 + docs/design-system.md)

WCAG AA contrast; visible `:focus-visible` ring everywhere (global 2px
`--focus-outline` offset 3px; context overrides per surface); status never by
color alone (priority chips carry text labels, missed pill, signed deltas);
44px touch targets; mobile-first at 320px; skip link to `#main-content`; unique
h1; `aria-current="page"`; live regions for mutations; axe-core smoke tests.

## 3. Stylesheet responsibilities (`src/app/styles/*`, import order matters)

| Sheet                         | Owns                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.css` (~1530 l)          | Tokens, @theme, resets, focus ring, ambient `.system-backdrop`/`.app-stage`/`.device-frame` phone mock, landing/state shells (`.state-shell`, `.system-panel`), auth system (`.app-auth-*`, tactile `.app-submit-button` press-down), legacy welcome |
| `redesign.css` (~2524 l)      | Bottom tab bar (`.app-tabbar`, `.tab-liquid-lens`), keyframes library, profile dashboard v1+refresh (`.profile-*`), glass panels, gradient text                                                                                                      |
| `anime-chapter-styling.css`   | Shared helpers: `.chapter-rule`, `.field-standard` (3px left accent), `.lift` hover                                                                                                                                                                  |
| `prototype-motifs.css`        | `.chip-badge` (+gem mark), `.step-badge`, `.diamond`/`.diamond-divider`, `.cta-glow`, `.diagonal-weave`                                                                                                                                              |
| `today-home-hero.css`         | Today HUD hero ("System Window"): scan sweep, HUD brackets, XP ring, stat rail                                                                                                                                                                       |
| `sign-up-welcome-screen.css`  | Illustration-led welcome split, mascot idle float, float-cards, gradient CTA                                                                                                                                                                         |
| `sign-in-register-forms.css`  | Clean auth column: segmented tabs, fields with 4px focus glow, uppercase submit                                                                                                                                                                      |
| `quest-studio.css` (~4138 l)  | Quest Studio 3-tab board, create card, priority radio-cards, date/time popovers, search-result cards, trash cards, restore dialog, permanent-delete dialog, celebration popup family                                                                 |
| `today-page.css` (~1618 l)    | Topbar, streak flame, week strip, promo banner, filter chips, swipe/flip task cards with `--tone-*` priority system, empty states                                                                                                                    |
| `progress-page.css` (~2490 l) | Progress dashboard, Focus Timer card/clock/metrics/history, Group Study lobby/room/feed                                                                                                                                                              |

State theming pattern: component-local custom properties set per state
(`--tone-bg/-fg/-check…` for today cards by priority; `[data-status=failed]`
grey override wins; `--quest-priority-accent`, `--pace-*`, `--particle-color`).

Priority palettes (reused): low `#4eaa77/#e8f7ee/#277a50`, medium
`#5c6fe1/#e9edff/#4e5dca`, high `#e3a43d/#fff5df/#a9650b`, critical
`#dc5b67/#fff0f1/#b83b49`. Completed blue `#4b68c7`, missed grey `#64748b`.

## 4. Shell and navigation

### Device-frame concept

Whole product is a **phone mock**: `.app-stage` centers `.device-frame`
(26rem max width ≥640px, radius 2.25rem, ambient backdrop). Inside: skip link →
`OfflineStatusBar` → `<main id="main-content" class="device-main">` → floating
`.app-tabbar`. Safe-area insets respected. `#app-device-viewport` doubles as
portal target for in-frame dialogs. There is no desktop nav chrome — the tab
bar is the only persistent navigation; `NavigationLinks`/`TopCommandArea` exist
but are currently unwired.

### Navigation config (`navigation-config.ts`)

Primary tabs (BottomTabBar, icon-only, sr-only labels): Home `/today` (House),
Tasks `/quests` (ListChecks), Timer `/timer` (Timer), Progress `/progress`
(Gauge), Profile `/profile` (UserRound). Secondary (config-only): Lists
`/gates` (PanelsTopLeft), Labels `/labels` (Tags), Completed `/cleared`
(CircleCheckBig), Settings `/settings` (Settings).

Active logic: `pathname === href || startsWith(href + "/")`. Liquid lens:
`--active-tab-position` var (percent fallback, pixel-refined by ResizeObserver),
420ms cubic-bezier(0.22,1,0.36,1); active icon scale 1.09, strokeWidth 2.35;
hidden (`data-visible=false`) on non-nav routes. Tests pin exact behavior.

### Keyboard shortcuts (shared grammar)

`Ctrl/⌘K` command menu; `?`/`/` opens it too; `n` → `/quests#create-quest-title`;
`g` then within 900ms: `t/q/g/l/c` → today/quests/gates/labels/cleared.
Guarded against editing targets and modifier keys.

### Command menu (Cmd+K)

Radix Dialog, centered panel `rounded-panel shadow-float`; flat filtered list:
Create Task (N), Go to Home/Tasks/Lists/Labels/Cleared (G-chord badges);
empty query message; autofocus search; close restores trigger focus.

### Session resolution & states

`(system)/layout.tsx`: `requireUser()` (401 → `unauthorized.tsx` state-shell)

- `requireWorkspaceAccess()` (403 → `forbidden.tsx`; self-heals personal
  workspace once). Provider stack order: OfflineProvider(scope) →
  TaskCompletionCelebrationProvider → AppFrame; siblings TimerLifecycleBoundary,
  AutomaticTimezone, AutomaticPushEnrollment, sonner Toaster (bottom-center,
  richColors, closeButton).

### Loading/error skeletons

Route-segment `loading.tsx` only (no Suspense boundaries): root = text
"Synchronizing system"; `(system)` = PageSkeleton (eyebrow/title/description
lines + hero card skeleton); today/quests/cleared = QuestLoadingState (heading +
two quest-card skeletons). Every leaf route has `error.tsx` → `RouteError`
(logs digest) → ErrorState ("The signal broke formation." + Try again).

### System components API

- `PageHeading { eyebrow*, title*, description?, actions?, className? }` —
  chip-badge diamond eyebrow, h1 text-3xl, italic serif description.
- `EmptyState { title*, description*, icon?, action?, variant?
}` — dashed card, glowing icon tile, italic serif copy; `variant="trash"`
  adds "All clear" eyebrow + recovery status line.
- `ErrorState { title?, description?, onRetry? }` — role=alert danger card.
- `ConfirmationDialog { title*, description*, triggerLabel*, confirmLabel*,
cancelLabel?, onConfirm*, variant?, appearance? }` — appearance
  `"permanent-delete"` renders orb skin inside device-frame portal with
  "This cannot be undone" notice.
- `MutationSubmitButton { idleLabel*, pendingLabel*, className? }` —
  useFormStatus spinner button; pair with footer hint line.
- `SystemMark { className? }` — rotated diamond logo, aria-hidden.

## 5. Screen-by-screen UX

### Home `/today`

Order: TodayHeader (eyebrow "Daily activity", en-GB date h1, NotificationMenu
bell + StreakButton) → date nav (prev arrow always enabled, 7-day strip with
data-selected disc, future disabled; URL `?date=YYYY-MM-DD` preserving
`labelId`) → TodayPromo banner (dismissible, localStorage
`questly-today-promo-dismissed`) → label filter chips (`All` + per-label) →
task sections grouped by list name ("My tasks" fallback; "Completed" and
"Missed" sections on historical dates) → DailyStudyHistory.

Task card interactions: swipe-left ≥35px reveals Remove (70px tray); swipe-right
(or Note pill) flips card 3D to show note back-face (threshold 52px, damped);
complete via circular check (local `done` flag → server → celebration popup or
toast); missed tasks offer Trash instead of check; deadline ticker schedules a
single refresh exactly when earliest due passes; `daymark:focus-today-task`
CustomEvent glows+scrolls to a card (reduced-motion aware).

Empty: "Your day is clear" / "No active tasks for this date." + Create task CTA;
historical: "Daily archive" variant.

### Tasks `/quests` — Quest Studio

Three tabs (ARIA tablist): **Create** (default unless URL filtered), **Search**
(controlled debounced search + results + "Arrange all tasks" reorder toggle),
**Trash** (`mode="deleted"`). Optimistic creation shows synthetic quest with
`optimistic-{uuid}` id + Saving badge and sr announcements
("`{title}` is being created." → "was created.").

QuestCard variants: active/today (full: badges, description, dates dl,
attachments, inline edit details, labels details, add-subtask details,
Complete/Delete), search-result compact (topline, gradient top bar, Manage
disclosure), trash (amber skin, "Ready to recover"/"Recovery expired"
same-day test, RestoreQuestScheduleDialog + permanent-delete control).

Filters are URL-as-state (`search,status,priority,gateId,labelId,due,sort`),
300ms debounced search, active-count chip, Reset with shareability explainer,
sentinel options for stale references ("Unavailable list"). Reorder:
pointer drag within same parent + Alt+↑/↓ keyboard, version-checked, rollback
with toast. Priority radio-cards in create form (visually-hidden native radios,
focus-visible outlines). Schedule fieldset with presets ("Today · 2 hours",
"Tomorrow · 9–5", Clear), paired date/time pickers (Calendar popover + time
grid of 96 15-min slots with elapsed disabled), recurrence builder with live
preview ("This task happens once." → next occurrence), Ctrl/⌘+Enter submit.

Celebration popup family (shared `task-created-popup__*` skeleton: portal,
ambient sparkles, ringed icon, eyebrow/h2/message, actions, auto-dismiss timer
bar): Created ("Nice move"/"Task created!" + Undo creation, 8s), Completed
("Momentum gained" + `{n} XP`, undo reverses XP), StreakCelebration (fires
INSTEAD of completed when streak increased; dynamic copy by count; flame),
Deleted (permanent/missed/cancelled kinds), Restored, TimerSession
(started/paused/finished, 6s), ProfileUpdate (name/password, 5s).
Precedence: streak > completed; dismissal triggers router.refresh().

Restore dialog: orb media, two moment fields with defaults next-quarter-hour
→ +1h, auto-shift due when start moves, live validation notes.

### Timer `/timer`

Focus card `data-state=running|paused|ready` with orbs; segmented HH:MM:SS
clock (role="timer"), server-clock-offset corrected; idle start form asks
"What will you focus on?"; running offers Pause + Finish ("Stop & leave" in
rooms); paused Resume; inline subject editor; day-rollover refresh; cross-tab
stop via sessionStorage marker + sendBeacon `/api/timer/stop`. Metrics grid
(Today's focus/Sessions/Best session) + history rows with proportional bars.
Group Study: lobby (create with limit 2–20 vs join by 8-char code), pending
request card, live room (join-code copy button, host controls Crown-badged,
participants with initials avatars + per-person clocks, activity feed with
verb copy), 3s version-diff polling backing off to 5s, 30s heartbeat.
Shared history expandable cards with final room summary.

### Lists `/gates` & Labels `/labels`

Same CRUD recipe: PageHeading + create card + sectioned cards (Active/Archived
for lists). GateCard: accent dot/badge, task count badge, View Tasks deep link
(`/quests?gateId=`), archive toggle, delete blocked with guidance while tasks
assigned. LabelCard: color dot + color-name badge, edit details, delete detaches.

### Progress `/progress`

Header "Personal growth"/"Your progress". Summary card (deep gradient, level
badge, progressbar meter with accessible label, "Next milestone" points away).
Goals: daily/weekly pace cards (tone blue/violet) with percent chips + meters.
Streak card (amber, data-active, Current/Best dl, protective note). History:
day-grouped timeline with signed totals (+12 points green / negative red),
reason-mapped labels, links that jump to Today with glow. today-hero variant:
time-based greeting + SVG XP ring + goal block + stat rail.

### Settings `/settings`

Three-card xl 2-col grid: Reminder inbox (30-minute window panel), Task
reminders manager (create/edit/cancel one-shot reminders, channel select
"In app"/"Email + in app", status badges), Install & offline access
(PwaInstallCard platform hints + passcode-gated encrypted offline storage).

Notifications: bell popover, unread count capped "9+", read-state in
localStorage synced cross-tab, items with countdown text + Open task (glow
dispatch) + Mark read; same controller powers full inbox panel.

Push enrollment is zero-UI: auto-enroll when granted; gesture-tied prompt when
default; failures swallowed (inbox remains source of truth).

### Profile `/profile`

Hero (tri-color hairline, initials avatar, verified badge, workspace chip,
member-since tiles) ↔ editor toggle. Identity form with live preview avatar,
char counter, locked email block ("Email changes are disabled..."); password
form with eye toggles + requirements checklist + sessions-signed-out note.
ProfileUpdatePopup celebrations. LogOut tile hosts OfflineLogoutButton (clears
IndexedDB first, pending "Clearing local data").

### Auth `/sign-in`, `/sign-up`

AuthExperience state machine welcome|login|register. Immersive welcome split:
visual side (halo/rings + mascot avatar, wordmark, edition chip) + bottom-sheet
panel (eyebrow "Plan · Focus · Finish", brand headline, CTAs Get started /
I already have an account, trust line "Private by default"). Form column:
segmented Sign in/Register tabs, rotating pending labels every 700ms
("Verifying..."), register triggers push permission request, FieldError
role=alert under each input, global result banner.

### Offline `/~offline`

Hand-built device frame with sticky header (SystemMark + Daymark + Offline
badge). States: loading → locked (passcode unlock) → no snapshot guidance →
snapshot view (saved timestamp, queued/conflicted warning strip, simple cards,
"Queued creation" markers). CTAs: Try reconnecting (/quests), Clear offline
data (always visible outside logout). Conflict resolution lives in-app:
bottom-right destructive trigger → dialog listing your change vs server state
(version shown) with "Keep server state" / "Apply my change to latest".

Offline queue UX: optimistic `offline-{uuid}` quests, toast "queued for
reconnection", sequential replay with exponential backoff (≤5), success toast
"N offline change(s) synchronized", session-end clears private data with
explanatory toast.

### Attachments (in quest cards)

Paperclip header + count; rows with size or "Awaiting verification"; upload
pipeline narrates each phase in an accessible status line with XHR progress
progressbar; MIME allow-list PDF/JPEG/PNG/WebP ≤10 MiB; delete uses
ConfirmationDialog with explicit irreversibility copy.

## 6. Recurring micro-patterns (reuse these)

1. Inline `<details>` edit drawers with shared summary styling; auto-collapse
   on success.
2. MutationSubmitButton + footer hint pairing everywhere.
3. ConfirmationDialog for all destructive flows; special permanent-delete skin.
4. Celebration popup skeleton with phase machines (created/completed ↔
   undone/error) and shortened post-undo timers.
5. Outline tinted Badge vocabulary via token→class maps (priority/label/accent)
   - mono `v{n}` version chips.
6. URL-as-state filters (defaults omitted, shareable, reset explainer).
7. sr-only live-region announcers duplicating toasts for list mutations.
8. EmptyState composition: dashed card + glowing icon tile + italic serif
   guidance + optional CTA.
9. Initials avatars (first letters of first two words).
10. Reduced-motion checks before programmatic smooth scrolling.
11. Optimistic-id conventions: `optimistic-{uuid}` vs `offline-{uuid}`,
    rendered with Saving/"Queued creation" badges.
12. Timezone transparency chips (abbreviation with full-zone title) on all
    schedule surfaces.

## 7. Known gaps / dormant infrastructure

- `NavigationLinks` + `TopCommandArea` built and tested but not rendered.
- `quests/[questId]/` directory exists but route not implemented.
- Naming drift: config says Cleared/Gates, UI copy says Completed/Lists;
  localStorage keys use legacy `questly:` prefix.
- No desktop breakpoint swaps navigation; single phone-frame paradigm.
