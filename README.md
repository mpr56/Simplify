# Dashboard

Personal tasks, goals, habits, and macros tracker. Vite + React 19 + TypeScript
+ Tailwind v4.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # typecheck + production bundle
npm test           # vitest, pure logic only
```

Tests cover the logic that has no business being wrong: task urgency
boundaries, task ordering, and the `normalizeData` migration that stands
between a deploy and a silently reset document. No component rendering — if
something needs a DOM to test, it belongs in a `lib/` module instead.

## Data

Everything is editable in the UI — long-term goals, goals, tasks, habits, macro
entries and their targets, bookmarks — and every edit is written to
**`data/dashboard.json`** by the dev server, so it survives a restart, a
different browser, and a cleared cache. The file is created on first write,
pretty-printed, and safe to hand-edit while the server is stopped.

```bash
rm data/dashboard.json   # start over from the seed files
```

[`server/fileStore.ts`](server/fileStore.ts) is the Vite plugin behind it: it
serves the same `GET`/`PUT` contract on `/api/data` that the deployed function
does, and runs in `dev` and `preview` only. Point it elsewhere with
`DASHBOARD_DATA_FILE=…/somewhere.json npm run dev`.

The browser also keeps a localStorage copy, used only when the store cannot be
reached, so an edit is never lost to a dropped request.

### Seeds

Starting data lives in [`src/data/seed/`](src/data/seed/) and is used until the
store has a document of its own:

| File | What it holds |
|---|---|
| `epics.json` | Long-term goals — the thing goals roll up into |
| `goals.json` | Goal list — title, category, status, `epicId`, subtask counts, progress |
| `habits.json` | Habit definitions, weekly targets, sample-history parameters |
| `macro-targets.json` | Daily calorie and macronutrient targets |
| `bookmarks.json` | Dock bookmarks |

Habit completion history and macro logs are **generated** demo filler
(deterministic, so charts stay stable across reloads). Once a store is
connected, real history lives there — 120 days of sample logs would just be
noise in the repo.

Categories are fixed in [`src/data/types.ts`](src/data/types.ts). Adding one
means adding a series color to the palette — see *Colors* below.

[`normalize.ts`](src/data/normalize.ts) migrates stored documents forward on
read and is the guard for everything the UI can now write: goals predating the
status workflow are mapped from their old `done` boolean, out-of-range numbers
are clamped, unusable entries are dropped, a goal pointing at a deleted
long-term goal falls back to standalone, habit histories are rebuilt so a stray
`false` cannot count as a logged day, and macro entries take their date from
their own key. A stored document is never discarded wholesale over a schema
change.

Every write goes through one pure reducer in
[`reducer.ts`](src/store/reducer.ts) — ids and timestamps are passed in by the
action creators, so the whole document's behaviour is deterministic and
testable on its own.

## Tasks

The right-hand pane is a task list — it previously embedded an external site.
Tasks are deliberately thinner than goals: a title, an optional due datetime,
and done. No progress bar, no subtask counts, no epic, no status workflow.
Goals stay the tracked-work layer; tasks are the layer with a deadline.

Urgency is derived from the due date rather than stored, so it can never go
stale:

| State | When | Shown as |
| --- | --- | --- |
| **Overdue** | past the due time | red rail, red timestamp, faint red wash |
| **Soon** | due within 2 hours | amber rail, amber timestamp, faint amber wash |
| **Upcoming** | further out | no rail, muted timestamp |
| **None** | done, or no due date | no rail |

Rows are never filled solid — on the near-black surface that destroys the
title's contrast. Colour is never the only cue either: the timestamp says
`3h overdue` or `in 40m` in words.

Ordering is fixed and not configurable, because the due date *is* the order:
open before done, dated before undated, dated ascending (so overdue floats to
the top), undated newest-first, done last.

A 60s clock ([`useNow`](src/hooks/useNow.ts)) drives the colours so a task that
comes due while the tab sits open actually turns red. It feeds urgency only —
the dashboard's `today` stays frozen at mount by design. It stops ticking while
the tab is hidden.

Overdue work also surfaces outside the panel: an **Overdue** stat tile in the
daily view, and a counted tab title plus a badged favicon
([`useTaskBadge`](src/hooks/useTaskBadge.ts)) so you can see it without
switching to the tab.

## Goals

Two levels, and only two: a **long-term goal** (the epic) and the **goals** that
roll up into it. Everything is editable in place — **new** / **new goal** in a
panel header to add, the pencil on a row to change it; `Esc` cancels a form.

### Long-term goals roll up, they are never set

A long-term goal owns no state of its own. Its status and percentage are always
computed from its children ([`rollUpEpic`](src/lib/selectors.ts)), so finishing
the last goal under it finishes it, and nothing can drift out of sync:

| Children | Long-term goal reads |
|---|---|
| none yet | To do, 0% |
| all done | **Done** |
| every unfinished one blocked | Blocked |
| any started | In progress |
| none started | To do |

Percentage is the *average of the children's own progress*, not the share of
them finished — one goal sitting at 90% should not read as zero. Expand a row to
see the goals underneath.

Deleting a long-term goal keeps its goals and makes them standalone. It never
deletes work.

### Status, not a checkbox

Goals move through **To do → In progress → Blocked → Done**. `Blocked` is a
state rather than a flag because work stalled on something external reads
differently from work nobody has started — and it gets its own stat tile, since
that is the number that should make you do something today.

The row checkbox is still the fast path for done/not-done; the pill next to it
covers the other states. Both are on every card in board view too.

### List and board

The toggle in the panel header switches between a **list** grouped by long-term
goal and a **board** with a column per status. Cards drag between columns;
because drag-and-drop is pointer-only, every card also carries the status pill
as a real `<select>`, so the board is fully keyboard-operable. The layout choice
is remembered per device.

### Progress

Progress is deliberately *not* derived from the sub-task counts — a goal that is
90% done on one hard remaining task should be able to say so. **match
sub-tasks** sets it from the ratio when that distinction does not matter.

Due dates are free-form text ("due Fri", "ongoing"). They become real dates when
goals get scheduling.

Worth adding next, in rough order of value: priority (and sorting by it within a
group), sub-tasks as real checkable items rather than a count, and a `done`
timestamp to drive a burndown of the long-term goals.

## Habits

**new** in the panel header adds one; the pencil on a row edits its name,
category, and weekly target. A new habit starts with a genuinely empty history —
backfilling it would put days in the charts that never happened.

The weekly target is a 1–7 picker rather than a free number field: history holds
one boolean per day, so an 8× target could never be hit and should not be
offerable.

Delete lives inside the edit form, not on the row. A habit carries logged days
that cannot be reconstructed, so the form states the cost first — *"deleting
also discards 72 logged days"* — and the habit goes to the recycle bin with its
history rather than evaporating.

## Macros

**log** (or **edit**) writes the macros for whichever day is anchored, so
backfilling yesterday is just stepping the date back first. **Clear day** removes
the entry entirely — an unlogged day is not the same as a zero one, and the
charts treat it that way.

Calories are entered, not computed: a label's figure rarely matches 4/4/9
exactly, and the logged number should be the one on the label. **match macros**
fills it from the grams when there is nothing better to go on.

The slider icon edits the **daily targets** — what a full ring means. Targets
take the same four fields, with one difference: calories must be at least 1,
since a zero target is a gauge divided by nothing.

## Recycle bin

Deleting a long-term goal or a habit moves it to the bin instead of destroying
it. The bin lives behind the trash button in the header
([`RecycleBinMenu.tsx`](src/components/layout/RecycleBinMenu.tsx)), which carries
a count badge and opens a dropdown. **Restore** puts an item back:

- a habit returns with its logged history intact
- a long-term goal returns *and re-attaches its goals* — the bin records which
  ones were under it, since deleting it left them standalone rather than
  deleting the work

A goal reassigned to a different long-term goal in the meantime keeps its newer
home; restoring never steals it back. Restoring something twice cannot duplicate
it.

The bin holds the last 25 deletions. The button stays in the header even when
the bin is empty: a recovery affordance that appears only once you have needed
it is one you will not find when you do. **empty bin**, or the × on a row,
discards for good. The dropdown closes on `Esc` — returning focus to the
button — and on a click outside.

Goals themselves are not binned: they are cheap to retype, and every delete
passing through a bin makes the bin useless. Extending it to goals is a `kind`
in [`types.ts`](src/data/types.ts) and a case in
[`reducer.ts`](src/store/reducer.ts).

The bin does **not** cover the header's reset button, which replaces the whole
document — that is why reset takes two clicks and turns red to ask.

## Cross-device sync

`data/dashboard.json` covers local development, but it lives on one machine — a
deployment has no filesystem to write back to. For that, connect a store.
Without one, a deployed build runs entirely on localStorage: fully functional,
but each browser keeps its own copy and they never converge. The header badge
reads **This device** in that state.

To sync, connect a Redis store — the whole dashboard is stored as one JSON
document under a single key:

1. Vercel dashboard → **Storage** → **Upstash Redis** → connect it to this project.
   That injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. Redeploy. The badge should read **Synced**.
3. For local development: `vercel env pull .env.local`.

[`api/data.ts`](api/data.ts) serves `GET` and `PUT`. With no store configured it
answers `501` and the client falls back to localStorage rather than erroring, so
the app never hard-fails on a missing store. Locally that same route is served
from the JSON file instead — see *Data* above.

**On the optional `DASHBOARD_SECRET`:** setting it makes the API reject requests
without a matching `x-dashboard-key` header. The client sends that from
`VITE_DASHBOARD_KEY`, which is compiled into the bundle and readable by anyone
who opens devtools. It deters crawlers; it is **not** authentication. Anyone with
the URL can read and overwrite your data. If that matters, put real auth in front
of it — Vercel's password protection is the cheapest option.

Writes are debounced 800ms and replace the whole document. Two guards keep that
from silently losing work:

- **`rev` + `If-Match`.** `GET` returns a `rev` alongside the data — a content
  hash of the stored payload, not a stored field, so the document shape never
  changes. `PUT` sends it back as `If-Match`; if the store has moved on, the
  write is rejected with `412` instead of overwriting. A request with no
  `If-Match` writes unconditionally, which is what the first-ever write and the
  seed-an-empty-store path need.
- **Refetch on focus.** Returning to the tab pulls the current document — the
  "just picked up my phone" moment. A refetch is skipped while a local edit is
  still unsent, so it can never overwrite something you just typed.

On a `412` the remote wins and this tab's unsent edit is dropped, surfacing as
**Reloaded** on the badge. Merging a whole-document store properly means moving
to per-row writes, which is deliberately out of scope — the exposure is narrow
because focus-refetch pulls before you start typing.

### Why not Supabase

Considered and declined for now. The priority here is *open latency* for a
single user, and Postgres over HTTP from a Vercel function is a heavier round
trip than an Upstash Redis `GET`; per-row writes would buy concurrent-edit
safety that one person does not need. Revisit alongside OTP sign-in, where
Supabase Auth plus RLS would justify the round trip. See
[the design doc](docs/superpowers/specs/2026-09-04-tasks-and-sync-design.md).

## Opening fast

The dashboard opens automatically at the start of a session, so cold-open
latency is treated as a feature:

- **`api/data.ts` runs on the edge runtime.** It only needs `fetch`,
  `Request`/`Response`, `process.env`, and WebCrypto, and a Node serverless cold
  start was the single largest cost on the open path.
- **First paint needs no network.** The reducer initialises from localStorage;
  the remote document lands after.
- **Hydration is conditional.** If the returned `rev` matches the one this
  device last saw, nothing is dispatched — the common case becomes zero
  re-renders instead of re-rendering every panel and chart into an identical tree.
- **The fetch starts before React exists.** An inline script in
  [`index.html`](index.html) kicks off `/api/data` and parks the promise on
  `window.__dashboardBoot`; [`sync.ts`](src/lib/sync.ts) consumes it exactly
  once, so the request is not queued behind bundle parse and mount.
- **Fonts are self-hosted** via `@fontsource-variable/*`, removing a
  render-blocking third-party stylesheet and a second connection on every open.

## The dock

Bottom bookmark dock. Icons go in [`public/icons/`](public/icons/) — see the
README there. Icon resolution falls back local PNG → the site's favicon → a
lettered tile, so a missing file never leaves a gap.

Bookmarks are part of the synced document, so they follow you across devices.
Add via the **+** tile; remove with the × on hover.

## Colors

Series colors in [`src/index.css`](src/index.css) are validated for the dark
surface: OKLCH lightness 0.48–0.67, ≥3:1 contrast, adjacent-pair colorblind
separation ΔE ≥ 8.

**Do not hand-tweak one hue.** Colorblind separation is a property of the whole
set — changing one can break its neighbors. Re-run the validator on the full
palette after any change.

## Layout notes

- **Every panel collapses.** Click a panel's title — the chevron next to it is
  the affordance — and it folds to just its header. Give a card a `panelId` in
  [`Card.tsx`](src/components/ui/Card.tsx) and it becomes collapsible; the state
  is remembered per panel per device, like the split ratio, since which panels
  you keep folded is a property of the screen, not of the data.

  The title becomes a button *inside* its heading rather than the header itself
  becoming clickable: a header also holds "new goal", "edit", and the layout
  toggle, and those must not end up nested inside a button. The animation is a
  `0fr → 1fr` grid row, which grows to the content's natural height without
  measuring it and keeps children mounted, so a half-typed form survives a
  collapse. Collapsed content is `inert` — clipped to zero height is not the
  same as hidden, and it must leave the tab order.
- The split between the dashboard and the embedded app panel is draggable
  ([`SplitPane.tsx`](src/components/layout/SplitPane.tsx)) and keyboard-operable:
  arrows nudge, `PageUp`/`PageDown` jump, `Home`/`End` go to the limits, `Enter`
  or double-click resets. The ratio persists per device. Below 1024px the panes
  stack.
- The embed panel takes a `src` prop, set in [`App.tsx`](src/App.tsx). Sites that
  send `X-Frame-Options` or `frame-ancestors` cannot be embedded — that is the
  remote site's decision and nothing here can override it.
- Adding a period (quarterly, yearly) means adding a case to `rangeFor` in
  [`src/lib/date.ts`](src/lib/date.ts) and a view; every view reads its data
  through `rangeFor` + `sliceRange`.
