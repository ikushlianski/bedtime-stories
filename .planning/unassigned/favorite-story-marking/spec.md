---
type: spec
branch: main
task: Let a parent mark a story as a favourite and filter the library down to favourites only (GH #71)
complexity: medium
state: confirmed
updated: 2026-08-13
---
# Spec: Favourite story marking

### Why

The issue's own text: "As a parent, I tap a favourite icon on any story in the library and from
then on I can filter the collection to show only our best stories — so when Gosha asks for 'the
dragon story' I find it in two taps, not by scrolling back through every night since we started."
Two acceptance criteria live in that sentence: (1) a tap-to-toggle favourite icon on stories in the
library, (2) a filter that narrows the list to favourited stories only. The issue body has no
further UX detail (no mention of the reader page, no mention of a dedicated favourites page) — the
library grid/list is the only surface this spec targets.

### Label mismatch (flag only, no relabeling performed)

The issue currently carries `priority:urgent`. Checked against every other `priority:urgent` issue
in the repo (#259, #261, #262 — all `type:project`/`type:initiative` epics: "Content safety
guardrails", "Story library access control", "Story planning flow"): this repo's own convention
reserves `priority:urgent` for safety/access-control-scale epics, never a single `type:story` item.
#71 is `type:story`. Note: the label the PM suggested as a replacement, `priority:highest`, does
not exist in this repo (`gh label list` shows only `priority:high`, `priority:medium`,
`priority:low`, `priority:lowest`, `priority:urgent`) — `priority:high` is the label that actually
fits a `type:story` item this well-scoped and low-risk. Flagging only; no label was changed.

### Implementation Phases

Single phase. The column, the endpoint, and the two UI surfaces (toggle + filter) are one
cohesive, same-day slice — none of the three is independently useful without the others.

### Design decisions made autonomously

- **Endpoint shape: `PATCH /api/stories/:id/favorite` with an explicit `{ favorite: boolean }`
  body**, not a stateful flip-with-no-body toggle. The PM's shape note said "toggle endpoint," but
  every existing boolean/enum-like mutation on this resource (`PATCH /:id/status`, `PATCH
  /:id/tags`, `PATCH /:id/title`) takes an explicit target value, not a server-side flip. An
  explicit value is idempotent (a retried request can't double-flip the state) and keeps the
  client's optimistic UI update trivially correct. The UI still behaves like a single-tap toggle —
  the client just always sends the state it wants to end up in.
- **No new auth/ownership scoping.** The PM's shape note asked to "make sure favoriting is scoped
  to the right user/family." Checked `packages/core/src/db/schema.ts` and every route in
  `packages/api/src/routes/stories.ts`: there is no `userId`/`familyId` column on `stories` or any
  related table, and no per-user filtering anywhere in the existing story routes. The whole app
  sits behind one shared `requireAuth` gate (`packages/api/src/middleware/auth.middleware.ts`,
  mounted once via `app.use('/api', requireAuth)` in `server.ts`) — this is a single-family app
  with one shared login, not a multi-tenant one. Favouriting needs no scoping beyond the
  `requireAuth` gate every other story mutation already relies on; adding a family/user dimension
  here would be new architecture the rest of the resource doesn't have, not a consistent extension
  of it.
- **Filter surface: `favoriteOnly: boolean`, styled exactly like the existing `mixedOnly`
  boolean filter** in `story-filters.tsx` (checkbox in the filter panel + removable chip), not a
  new dropdown/tab and not a new status value. `mixedOnly` is the closest precedent for "a boolean
  narrowing filter orthogonal to status," and reusing its exact shape (schema field, default,
  `activeFilterCount`/`hasCustomFilters` inclusion, chip) is the literal PM claim under
  verification — confirmed genuinely reusable, see "UI reuse verification" below.
- **Toggle placement: an icon button in `StoryCard`'s existing badge row** (next to the
  series/mixed/status badges, to the left of them), not a new row and not a menu action. It needs
  its own `<button>` (not a `<span>` badge) since it's interactive, with `stopPropagation` so
  tapping it never also fires `onTitleClick`.
- **Default `false`, additive migration, no backfill needed.** Every existing story simply starts
  unfavourited — this is the expected empty state, not a data gap to fill.

### UI reuse verification (commit `ead094d`)

Read `packages/web/src/components/story-filters.tsx` in full, and `story-card.tsx`. Confirmed
reusable:
- `FilterChip` (lines 127-143) is a generic `{ label, onRemove }` component with no `mixedOnly`- or
  status-specific logic — directly reusable for a `favoriteOnly` chip.
- `StoryFilterState`, `DEFAULT_FILTERS`, `storedFiltersSchema` (Zod), `activeFilterCount`,
  `hasCustomFilters` all already carry `mixedOnly: boolean` end-to-end (state shape → persistence
  schema → active-count → reset-detection → chip). Adding `favoriteOnly` is a same-shaped diff in
  each of those five spots, not a new mechanism.
- The filter panel's `mixedOnly` checkbox block (lines 228-238) is a literal template for a
  `favoriteOnly` checkbox — same `label`/`checkbox checkbox-sm` markup.
- **Not reusable as-is:** `StoryCard` has no icon-button slot today — `actions` renders full
  labelled buttons below the card body, and the badge row (lines 118-133) only renders static
  `<span>` badges. The favourite toggle needs a new small interactive element in that row; it is
  not a drop-in reuse of an existing card affordance, only of the filter-chip infrastructure.

### Files by scenario

| Scenario | Backend files | Frontend files |
|----------|---------------|-----------------|
| SCENARIO 1 — parent taps the favourite icon on a story card, it fills in and persists | `packages/api/src/routes/stories.ts` | `packages/web/src/components/story-card.tsx`, `packages/web/src/pages/story-list.tsx`, `packages/web/src/lib/api.ts` |
| SCENARIO 2 — parent taps it again, it un-favourites | `packages/api/src/routes/stories.ts` | same as above |
| SCENARIO 3 — parent turns on "favourites only," list narrows to favourited stories | `packages/api/src/routes/stories.ts` | `packages/web/src/components/story-filters.tsx`, `packages/web/src/pages/story-list.tsx` |
| SCENARIO 4 — favourite filter chip appears when active and clears the filter on remove | none | `packages/web/src/components/story-filters.tsx` |
| SCENARIO 5 — favourite state round-trips through page reload (persisted filter + fetched data, not local-only state) | `packages/api/src/routes/stories.ts` | `packages/web/src/components/story-filters.tsx` (persisted `favoriteOnly` in `localStorage`, same as `mixedOnly`) |
| SCENARIO 6 — existing stories default to unfavourited after migration | `packages/core/src/db/migrations/` (new file) | none |

### Data model changes

```
packages/core/src/db/schema.ts
  stories table gains: favorite: boolean('favorite').notNull().default(false)

packages/core/src/db/migrations/
  <next-number>_<generated-name>.sql  — generate via `npx drizzle-kit generate` after the schema
                                         edit (do not hand-author; this is a single boolean column,
                                         none of the pgvector-style exceptions apply). Expected
                                         output: ALTER TABLE "stories" ADD COLUMN "favorite" boolean
                                         DEFAULT false NOT NULL; — purely additive, no backfill,
                                         no data loss risk.
  meta/_journal.json, meta/<n>_snapshot.json — regenerated automatically by drizzle-kit generate

Apply with: npm run db:migrate (never drizzle-kit migrate directly — hangs on Neon, per this
repo's CLAUDE.md)
```

### Files to create

```
packages/api/src/routes/
  stories-update-favorite.test.ts   — unit tests for the new PATCH schema, same shape as
                                       stories-update-title.test.ts: accepts { favorite: true },
                                       accepts { favorite: false }, rejects missing field, rejects
                                       non-boolean value (e.g. "true" as a string)
```

### Files to modify

```
packages/core/src/db/schema.ts
  + favorite column on stories (see Data model changes)

packages/api/src/routes/stories.ts
  + updateFavoriteSchema = z.object({ favorite: z.boolean() })
  + router.patch('/:id/favorite', validate(updateFavoriteSchema), async (req, res) => { ... })
    — identical shape to the existing PATCH /:id/status handler: parseIntParam, 400 on invalid id,
    db.update(stories).set({ favorite, updatedAt: new Date() }).where(eq(stories.id,
    storyId)).returning(), 404 if no row, res.json(toSnakeCase(story as Story))
  toSnakeCase(row)
    + favorite: row.favorite  — single conversion function reused by GET /, GET /:id, and every
      PATCH handler's response, so this one change is sufficient for all read paths
  GET / (list endpoint)
    + read favoriteOnly from req.query
    + if (favoriteOnly === 'true') conditions.push(eq(stories.favorite, true))
      (same pattern as the existing mixedOnly handling immediately above it)

packages/web/src/lib/api.ts
  Story type + favorite: boolean
  stories.list(params) + favoriteOnly?: boolean in the params type, appended to the query string
    the same way mixedOnly already is
  stories.* + updateFavorite: (id: number, favorite: boolean) =>
      request<Story>(`/api/stories/${id}/favorite`, { method: 'PATCH', body: JSON.stringify({
      favorite }) })
    (placed alongside updateStatus/updateTags/updateTitle)

packages/web/src/components/story-card.tsx
  + favorite?: boolean and onToggleFavorite?: () => void props
  + a small icon <button> in the badge row (before seriesId/isMixed/status badges), filled star
    when favorite, outline star when not, aria-label toggles between "Добавить в избранное" /
    "Убрать из избранного", onClick calls e.stopPropagation() then onToggleFavorite()
  (only rendered when onToggleFavorite is passed — keeps the component usable without it, same
  convention as onTitleClick being optional)

packages/web/src/components/story-card.test.tsx
  + tests: renders outline star when favorite is false/undefined, renders filled star when true,
    clicking the star calls onToggleFavorite and does not also call onTitleClick

packages/web/src/pages/story-list.tsx
  SortableStoryCard
    + favorite prop, onToggleFavorite prop, threaded into <StoryCard favorite={...}
      onToggleFavorite={...} />
  main list component
    + handleToggleFavorite(id, next) calling api.stories.updateFavorite(id, next), updating local
      state on success (same optimistic-update-then-reconcile shape already used for other
      per-story mutations in this file — reuse whatever helper already exists for status/tag
      updates here rather than introducing a new pattern)
    fetch params
    + favoriteOnly: effectiveFilters.favoriteOnly || undefined (same line/pattern as the existing
      mixedOnly: effectiveFilters.mixedOnly || undefined)

packages/web/src/components/story-filters.tsx
  StoryFilterState + favoriteOnly: boolean
  DEFAULT_FILTERS + favoriteOnly: false
  storedFiltersSchema + favoriteOnly: z.boolean().default(false)
  activeFilterCount + if (f.favoriteOnly) count++
  hasCustomFilters + f.favoriteOnly !== DEFAULT_FILTERS.favoriteOnly
  StoryFilters component
    + a checkbox block identical in shape to the existing mixedOnly block ("Только избранное"),
      placed directly below it
    + a FilterChip for favoriteOnly ("Избранное"), placed alongside the existing mixedOnly chip
    lockedStatus count/hasActive expressions gain the same + (value.favoriteOnly ? 1 : 0) /
      || value.favoriteOnly terms as the existing mixedOnly terms

packages/web/src/components/story-filters.test.ts
  + activeFilterCount counts favoriteOnly; hasCustomFilters detects it; stored-filter round-trip
    covers favoriteOnly (mirrors every existing mixedOnly-equivalent assertion in this file)
```

### Implementation order

1. Schema + migration: add the column, run `npx drizzle-kit generate`, review the generated SQL is
   purely additive, apply locally with `npm run db:migrate`.
2. Backend: `updateFavoriteSchema` + `PATCH /:id/favorite` handler + `toSnakeCase` field +
   `favoriteOnly` list-query condition, with `stories-update-favorite.test.ts` for the schema.
3. `api.ts`: type + `updateFavorite` + `favoriteOnly` list param.
4. `story-filters.tsx`: state shape, persistence schema, count/reset helpers, checkbox, chip —
   with `story-filters.test.ts` coverage mirroring the `mixedOnly` assertions.
5. `story-card.tsx`: icon button + tests.
6. `story-list.tsx`: wire the toggle handler and the favourite-only fetch param through.

### Definition of Done — per layer

**Backend:** `npx vitest run` passes, including new `stories-update-favorite.test.ts` coverage
(accepts both boolean values, rejects missing/non-boolean). `npx tsc --noEmit` clean.

**Frontend:** `npx vitest run` passes, including new `story-card.test.tsx` and
`story-filters.test.ts` assertions listed above. Manual check in local dev
(`npm run docker:up`): tapping the star on a card flips it immediately and survives a page
reload; turning on "Только избранное" narrows the list and shows a removable "Избранное" chip;
removing the chip restores the full list.

**Infrastructure:** the migration is additive only (`ADD COLUMN ... DEFAULT false NOT NULL`) — no
existing row's data changes meaning, no downtime concern, no rollback complexity beyond a normal
`DROP COLUMN` if ever needed.

### Scope boundary

Out of scope for this task:
- Any favourite toggle on the story-reader page — the issue text scopes this to "the library,"
  and the reader page isn't mentioned; can be a fast follow-up if wanted, reusing the same
  `updateFavorite` endpoint.
- A dedicated "/favourites" route or nav entry — the filter chip inside the existing library view
  satisfies the issue's stated acceptance criteria ("filter the collection").
- Any per-user/family favourite (e.g. two children favouriting differently) — no such data model
  exists anywhere in this app today (see "No new auth/ownership scoping" above); out of scope
  unless the app grows real multi-user story ownership later.
- Relabeling the GitHub issue — flagged in this spec's "Label mismatch" section only, left for a
  human to action.
