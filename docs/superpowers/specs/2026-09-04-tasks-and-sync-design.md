# Tasks panel, open-latency work, and dead-code removal

Date: 2026-09-04
Status: approved, ready for planning

## Context

The dashboard's right-hand column is an iframe embedding an external site
(`EmbedPanel`, mounted once at `src/App.tsx:43`). It is being removed and
replaced with a first-class task list owned by this app.

Separately, persistence needs to be trustworthy across the owner's devices.
The app is single-user, hosted on Vercel, and opened automatically at the start
of a session — so **open latency is the primary quality bar**, ahead of
concurrent-edit correctness.

### Current storage behaviour

The whole dashboard is one JSON document:

- **Paint:** the reducer initialises from `localStorage` (`src/lib/storage.ts`),
  so first paint needs no network.
- **Hydrate:** `GET /api/data` on mount, then `dispatch({type:'reset'})`
  unconditionally (`src/store/DashboardProvider.tsx:74`).
- **Persist:** debounced whole-document `PUT` 800ms after any edit.
- **Backend:** Upstash Redis via REST in production (`api/data.ts`), a Vite
  middleware writing `data/dashboard.json` in dev (`server/fileStore.ts`).
  With no store configured every route answers 501 and the client stays local.

### Known defects this spec addresses

1. **The build is broken.** `noUnusedLocals` is enabled in `tsconfig.json:16`,
   and `src/components/layout/Dock.tsx` has three unused-symbol errors, so
   `npm run build` (`tsc --noEmit && vite build`) fails at the typecheck step
   today. Any Vercel deploy running the standard build command fails.
2. **Unconditional re-render on hydrate.** Every open re-renders every panel and
   chart even when the remote document is byte-identical to the cached one.
3. **Whole-document last-writer-wins** with no staleness check, so a second
   device can silently overwrite the first.
4. **No test runner** exists in the repo.

## Goals

- Replace the embed column with a task list carrying real due dates and
  urgency colouring.
- Make opening the dashboard feel instant.
- Fix the broken build; remove dead code.
- Add a safety net against cross-device overwrites, cheaply.

## Non-goals

- Authentication. Deferred deliberately; OTP + cookie sessions come later.
  `/api/data` remains the seam where that will attach.
- Supabase migration. See "Storage decision" for why this is a regression
  against the stated goal right now.
- Concurrent-edit merging. Conflicts are detected and surfaced, not merged.
- Changing `Goal.due` from its free-form string. Flagged, not fixed.

---

## 1. Task model

New entity in `src/data/types.ts`:

```ts
/** ISO 8601 datetime with offset, e.g. 2026-09-04T15:00:00.000Z */
export type ISODateTime = string

export interface Task {
  id: string
  title: string
  /** Unset means "someday" — the task has no urgency and sorts last. */
  dueAt?: ISODateTime
  done: boolean
  /** Set when `done` flips true, cleared when unchecked. */
  completedAt?: ISODateTime
  /** Optional so quick capture never forces a choice. */
  category?: CategoryId
  createdAt: ISODateTime
}
```

Added to the persisted document as `tasks: Task[]`.

**Deliberately thinner than `Goal`:** no `progress`, no subtask counts, no
`epicId`, no `GoalStatus`. A task is done or it is not. Goals remain the
tracked-work layer and are untouched by this work.

**No trash entry.** `TrashEntry` covers epics and habits because they carry
irreplaceable structure and history (`src/data/types.ts:94-118`). Goals already
bypass the bin; tasks follow goals.

### Reducer actions

Added to `src/store/reducer.ts`, following the existing convention that ids and
timestamps are supplied by the caller so the reducer stays pure:

| Action | Effect |
|---|---|
| `addTask` | Append. Caller supplies `id` and `createdAt`. |
| `updateTask` | Shallow merge a `Partial<Task>` patch by id. |
| `toggleTask` | Flip `done`; set or clear `completedAt` from a caller-supplied timestamp. |
| `removeTask` | Filter by id. |
| `clearCompletedTasks` | Drop every task where `done` is true. |

`toggleTask` is separate from `updateTask` because it owns the `done` ↔
`completedAt` invariant, which a caller passing a raw patch could break.

### Normalisation

`normalizeTask` in `src/data/normalize.ts`, mirroring the existing helpers:

- A document with **no `tasks` key migrates to `[]`**, never to seed data.
  This is the highest-risk line in the change: falling back to seed here would
  inject demo tasks into a real document on the first deploy.
- A `dueAt` that is not a parseable datetime is dropped, leaving the task
  undated rather than rejecting the task.
- `completedAt` is cleared when `done` is false, repairing the invariant on read.
- A `category` not in `CATEGORIES` is dropped (undefined), not defaulted to
  `work` — unlike `Goal`, where category is required.

### Seed data

`src/data/seed/tasks.json`, following the existing pattern where entities live
in hand-editable JSON (`src/data/seed.ts`). Two or three sample tasks with
`dueAt` values expressed as **day offsets from today**, resolved at seed time,
so a fresh install demonstrates overdue and due-soon states rather than showing
dates from whenever the file was written.

## 2. Urgency and presentation

### Logic — `src/lib/tasks.ts` (new, pure)

```ts
export type TaskUrgency = 'overdue' | 'soon' | 'upcoming' | 'none'

/** "Due in the next couple of hours." */
export const SOON_MS = 2 * 60 * 60 * 1000

export function urgencyOf(task: Task, now: number): TaskUrgency
export function sortTasks(tasks: Task[]): Task[]
export function overdueCount(tasks: Task[], now: number): number
export function formatDueLabel(dueAt: ISODateTime, now: number): string
```

`sortTasks` takes no `now`: ascending `dueAt` already places overdue items
first, and an unused parameter fails the build under `noUnusedParameters`.

Boundaries, stated explicitly because they are what the tests pin:

- `done` or no `dueAt` → `none`, regardless of the date.
- `dueAt - now < 0` → `overdue`. Exactly `0` is **not** overdue.
- `0 <= dueAt - now <= SOON_MS` → `soon`. Exactly `SOON_MS` is `soon`.
- otherwise → `upcoming`.

**Sort order** (one fixed order, not user-configurable — the due date *is* the
ordering): not-done before done; within not-done, dated before undated, dated
ascending by `dueAt`, undated by `createdAt` descending; done last by
`completedAt` descending.

**`formatDueLabel`** returns relative text near now and absolute text further
out: `"3h overdue"`, `"in 40m"`, `"today 18:00"`, `"tomorrow 09:00"`,
`"Fri 14:00"`, `"12 Oct"`.

### Colour

Uses the two status tokens already reserved for this at `src/index.css:38-41`
(`--color-critical`, `--color-warning`), which the file's comment marks as
never reused as series colours.

| Urgency | Treatment |
|---|---|
| `overdue` | 2px left rail `--color-critical`, due label in critical, ~5% critical background wash |
| `soon` | same construction in `--color-warning` |
| `upcoming` / `none` | no rail, due label in `--color-ink-3` |

Rows are **not** filled solid with red. On the near-black OLED surface a solid
fill destroys the title's contrast and makes the panel shout — the rail plus
tinted timestamp carries the same signal at a glance without it.

Urgency is never encoded by colour alone: the due label text (`"3h overdue"`)
states it, satisfying the non-colour-cue requirement.

### Live tick — `src/hooks/useNow.ts` (new)

Returns `Date.now()`, re-rendering on a 60s interval.

`DashboardProvider` deliberately freezes `today` at mount
(`src/store/DashboardProvider.tsx:33-35`) so an open dashboard does not
re-anchor the period under the user. That decision stands. `useNow` feeds
**only** the urgency math and the badge — it must not be wired into the period
anchor. Without it, a task that comes due while the tab sits open never turns
red and the tab badge never fires.

The interval is cleared when the document is hidden and a fresh value is taken
on `visibilitychange`, so a backgrounded tab does not tick all night.

### Components — `src/components/panels/tasks/`

Split into `TasksPanel.tsx`, `TaskRow.tsx`, `TaskComposer.tsx`.
`GoalsPanel.tsx` is 466 lines and is the pattern not to repeat.

- **`TaskComposer`** — a single text input. Enter creates the task. A
  `<input type="datetime-local">` sets the due date (native pickers on iOS are
  good), alongside three quick chips: *Today 18:00*, *Tomorrow 09:00*,
  *Next week*. Category is optional and set from the row, not the composer.
- **`TaskRow`** — `CheckBox` (reusing `src/components/ui/CheckBox.tsx`), title,
  due label, optional `Tag`, and hover-revealed edit/delete following the
  `RowActions` pattern in `GoalsPanel.tsx:37-62`.
- **`TasksPanel`** — `Card.Root` shell matching the other panels, header with an
  open-count and a *Clear completed* action, then the sorted rows. Empty state
  matches the existing copy style. It respects `state.query` for search, as
  `GoalsPanel` does via `filterGoals`.

`TasksPanel` replaces `EmbedPanel` as the `secondary` of `SplitPane` in
`App.tsx`. The pane's `defaultRatio` drops from 0.72 to 0.68 — a task list wants
slightly more width than an iframe did. Below `lg`, `SplitPane` already stacks
the panes, so mobile gets the task list under the main column with no extra work.

### Overdue surfacing

- **Stat tile** in `DailyView`, alongside Active goals / Blocked / Streak,
  using the existing `StatTile` with `accent="var(--color-critical)"` when the
  count is non-zero — matching how `Blocked` already conditions its accent
  (`src/components/views/DailyView.tsx:27-32`).
- **Tab title + favicon** via `src/hooks/useTaskBadge.ts` (new): sets
  `document.title` to `(2) Dashboard` and draws a 32×32 canvas favicon with a
  critical-coloured badge dot, injecting it as `<link rel="icon">`. There is no
  favicon asset in the repo today, so this also adds the unbadged base icon.
  Canvas failures are swallowed and the title-only path still works.

## 3. Storage and open latency

### Storage decision

**Stay on the single JSON document in Upstash Redis. Do not migrate to
Supabase now.**

A prior note recorded Supabase as the intended destination. Against the stated
priority — open latency, single user — it is the wrong move today: Postgres over
HTTP from a Vercel function is a heavier round trip than an Upstash Redis `GET`,
and per-row writes buy concurrent-edit safety that is explicitly not needed.
The reason Supabase was written down (durable storage with real auth) lands
with the OTP work later, and that is when to revisit it — at which point moving
the data alongside Supabase Auth becomes worth the round trip, because the
alternative is verifying Supabase JWTs in a function that talks to a different
store.

### Latency changes

1. **Edge runtime for `/api/data`.** `api/data.ts` declares no runtime, so it is
   a Node serverless function and pays a cold start on exactly the
   first-thing-in-the-morning open this dashboard is built for. It already uses
   Web-standard `Request`/`Response` handlers and `fetch`, so `export const
   runtime = 'edge'` is the whole change. Biggest single win.
2. **Conditional hydration.** Compare the fetched document against what is
   already rendered and dispatch `reset` only when they differ. The common case
   — nothing changed since this device last wrote — becomes zero re-renders
   instead of a full tree re-render. The `rev` from §"Conflict detection" is the
   comparison key, so this costs nothing extra.
3. **Pre-React fetch.** An inline `<script>` in `index.html` starts
   `fetch('/api/data')` and parks the promise on `window.__dashboardBoot`;
   `DashboardProvider` awaits that promise if present and falls back to its own
   `fetchRemote` if absent. This moves the request off the critical path behind
   bundle download, parse, and mount.
   *Auth interaction:* the boot script reads the optional key from a
   `<meta name="dashboard-key" content="%VITE_DASHBOARD_KEY%">` tag, which Vite
   substitutes at build time. If the variable is unset the content stays the
   literal placeholder; the script detects that and sends no header. Since
   `DASHBOARD_SECRET` is unset today this path is inert, but it must not break
   if the secret is later set.
4. **Self-hosted fonts.** `index.html:8-13` loads Outfit and Inter from Google
   Fonts — a third-party, render-blocking stylesheet plus a second connection
   for the font files, on every cold open. Vendored same-origin via Vite, with
   `font-display: swap` preserved.

### Conflict detection

`rev` is a content hash, not a stored field — the document shape does not
change, so there is no envelope migration.

- **`GET /api/data`** → `{ configured: true, data, rev }` where `rev` is the
  first 16 hex characters of the SHA-256 of the stored payload string, computed
  with WebCrypto (available in the edge runtime). An empty store returns
  `rev: null`. Still **one** Redis operation; the latency-critical path is
  untouched.
- **`PUT /api/data`** sends `If-Match: <rev>` — the last rev this client saw.
  The server reads the current payload, hashes, and compares. Mismatch → `412`.
  Match → write, and return the new `rev`. A request with **no** `If-Match`
  header writes unconditionally, which is what the first-ever write and the
  seed-an-empty-store path at `DashboardProvider.tsx:77` need.
- **Client on 412:** refetch, take the remote document, and surface a
  `conflict` state through the existing `SyncStatus` union and `SyncBadge`.

**Accepted trade-off, stated plainly:** on a conflict the local unsynced edit is
discarded, not merged. Merging a whole-document store correctly is the per-row
migration that is out of scope. The exposure is narrow — it requires editing on
device B and then editing on device A without A ever regaining focus — because
of the next item.

- **Refetch on focus.** `visibilitychange` and `focus` trigger a refetch. This
  is precisely the "just picked up my phone" moment, and it is what makes the
  conflict window small enough for the trade-off above to be acceptable.

The `PUT` read-compare-write is not atomic. For a single user this is fine;
if it ever matters, Upstash REST supports `EVAL`, making it a Lua compare-and-set.

`server/fileStore.ts` implements the same `rev` and `If-Match` contract so dev
and production do not diverge.

## 4. Dead code removal

The build must pass with `noUnusedLocals` and `noUnusedParameters`, both already
enabled.

**`src/components/layout/Dock.tsx`** — the doc comment at lines 115-119 describes
macOS-style magnification that does not happen: `scaleFor` ignores its `index`
and returns `1` unconditionally (lines 136-138). Remove the effect rather than
restore it, per instruction. That deletes `MAX_SCALE`, `RANGE`, `scaleFor`,
`pointerX`/`setPointerX` and the pointer handlers, `magnify`/`setMagnify` and
its `matchMedia` effect, `listRef`, the `transform`/`transition` inline styles,
and the now-inaccurate doc comment. `BASE_SIZE` stays. Hover labels, the add
form, and remove buttons are untouched.

**Genuinely unreferenced, verified by grep across `src`, `api`, `server`, and
`vite.config.ts`:**

- `clearStored` — `src/lib/storage.ts:29`
- `categoryBreakdown` — `src/lib/selectors.ts:232`
- `MacroKey` — `src/lib/colors.ts:29`

**Explicitly kept**, because a first pass flagged them and they are not dead:
`rollUpEpic` and `endOfMonth` are called within their own modules;
`dashboardFileStore` is used by `vite.config.ts`; the exported types
(`Action`, `DashboardState`, `TrendPoint`, `HabitDraft`, …) are used in-file or
are legitimately their module's public surface. Removing an export keyword from
a working module is churn, not cleanup.

## 5. Testing

Vitest, added as a dev dependency with a `test` script. Coverage is **pure
logic only** — no component rendering, no DOM harness.

| Target | What it pins |
|---|---|
| `urgencyOf` | The four boundaries in §2, including exactly-`0` and exactly-`SOON_MS`; done and undated tasks returning `none`. |
| `sortTasks` | Full ordering, including undated-after-dated and done-last. |
| `formatDueLabel` | Relative vs absolute thresholds; the overdue phrasing. |
| `normalizeTask` / `normalizeData` | A document with **no `tasks` key** yields `[]`, not seed. Junk `dueAt` drops. `completedAt` cleared when not done. Existing entities survive untouched. |
| `reducer` task actions | `toggleTask` maintains the `done`/`completedAt` invariant both ways. |

`normalizeData` is the one that matters most: it is what stands between a deploy
and a silently reset document.

A fixed injected `now` is used throughout; no test reads the system clock.

## 6. Files

**Deleted:** `src/components/panels/EmbedPanel.tsx` (single use site).

**New:** `src/lib/tasks.ts`, `src/hooks/useNow.ts`, `src/hooks/useTaskBadge.ts`,
`src/components/panels/tasks/{TasksPanel,TaskRow,TaskComposer}.tsx`,
`src/data/seed/tasks.json`, test files alongside their targets.

**Edited:** `src/data/types.ts`, `src/data/normalize.ts`, `src/data/seed.ts`,
`src/store/reducer.ts`, `src/store/DashboardProvider.tsx`, `src/store/context.ts`,
`src/lib/sync.ts`, `src/lib/storage.ts`, `src/lib/colors.ts`,
`src/lib/selectors.ts`, `src/components/layout/Dock.tsx`,
`src/components/ui/SyncBadge.tsx`, `src/components/views/DailyView.tsx`,
`src/App.tsx`, `index.html`, `api/data.ts`, `server/fileStore.ts`,
`package.json`, `README.md`.

## Risks

| Risk | Mitigation |
|---|---|
| `normalizeData` regression resets a live document | Test it first; the no-`tasks`-key case is the primary assertion. |
| Edge runtime lacks a Node API used by `api/data.ts` | It only uses `fetch`, `Request`/`Response`, `process.env`, and WebCrypto — all available. Verify by deploying a preview before promoting. |
| Self-hosted fonts change rendering | Same families and weights; visual check against the current build. |
| Boot-script fetch races the provider's own | Provider awaits `window.__dashboardBoot` when present, never both. |

## Deferred

- OTP sign-in with cookie sessions, and the Supabase reassessment that comes
  with it.
- `Goal.due` as a real datetime. `src/data/types.ts:41` already flags this;
  once tasks carry real dates next to goals reading `"due Fri"`, the
  inconsistency will be visible. Out of scope by choice.
- Web app manifest and `apple-touch-icon` for Add to Home Screen.
- Per-row storage and real conflict merging.
