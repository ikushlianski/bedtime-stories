---
type: spec
branch: main
task: Let a parent edit an existing diary entry in place instead of deleting and re-creating it, so a quick bedtime note can be corrected or expanded the next morning without losing its original date/context (GH #245)
complexity: simple
state: confirmed
updated: 2026-08-13
---
# Spec: Editable diary entries after saving

### Why

Issue's own framing: "As a parent, I write a quick diary note at bedtime and then want to add
more detail the next morning — I can edit the existing entry rather than deleting it and starting
over, so the observation stays connected to its original date and context." No dedicated edit
view or special UX is specified beyond that — the issue explicitly frames this as removing
friction from a delete-and-recreate workaround, not as a new page or workflow.

Verified against current code (matches the PM's triage note): `packages/api/src/routes/diary.ts`
supports only `GET /`, `POST /` (`createDiarySchema`), and `DELETE /:id` — no update route.
`packages/web/src/pages/diary.tsx` has no `editingId`/`editText` state and no inline-edit UI, only
create and delete. The `content` column (`packages/core/src/db/schema.ts:203-207`,
`child_diary` table) is already `text`, not `varchar` — no migration needed to store longer or
edited content.

### Precedent: `fragments.tsx`'s inline edit-in-place pattern, confirmed mirrorable with one gap

`packages/web/src/pages/fragments.tsx:22-23,87-98,169-179,200-219` is a genuine, directly
copyable precedent: `editingId: number | null` + `editText: string` state; a `handleSaveEdit(id)`
that calls `api.fragments.update(id, { text: editText.trim() })` then patches the item into local
`items` state; the list item conditionally renders a `<textarea>` (edit mode) or a `<p>` (display
mode) keyed on `editingId === item.id`; a `Сохранить`/`Отмена` button pair replaces the single
`Изменить` button while editing.

Diary entries have no additional lifecycle/permission divergence from fragments worth encoding —
both are simple owner-authored text rows with no draft/published states, no `usedCount`-style
"in use elsewhere" concern (fragments' badge to that effect doesn't apply to diary), and no
per-field partial update (fragments patches `text`/`universeId`/`rank` independently; a diary
entry has exactly one editable field, `content`). This actually makes diary's edit *simpler* than
fragments', not divergent from it.

One real gap, not a blocker: `fragments`' PATCH sets `updatedAt: new Date()` on every edit
(`fragments.ts:90`) because the `fragments` table has an `updated_at` column
(`schema.ts` — confirmed via `usedCount`/`rank` fragment columns list). **`child_diary` has no
`updated_at` column at all** (`schema.ts:203-207`: only `id`, `content`, `created_at`). Adding one
would require a migration, which the PM's triage explicitly says isn't needed and the issue itself
never asks for an "edited" indicator. Decision below.

### Design decision: reuse `createDiarySchema` directly for the update body, no `.pick()`/second schema needed

`createDiarySchema` (`diary.ts:10-12`) is already exactly the update payload's shape —
`{ content: string }`, non-empty, capped at 2000 chars with the Russian message from #119. Unlike
`fragments.ts`, which needs a separate `updateFragmentSchema` because fragment updates can touch
any subset of three fields (`text?`, `universeId?`, `rank?`), a diary edit only ever replaces
`content` — there's no second field to make optional and no subset-update case to support. Adding
a `updateDiarySchema = createDiarySchema.pick({ content: true })` would be a no-op alias: `.pick()`
on a single-key object returns the same shape. **Decision: pass `createDiarySchema` straight into
`validate()` on the new `PATCH /api/diary/:id` route — same import, zero duplication, and the
2000-char cap from #119 is enforced identically on create and edit by construction, not by
convention.**

### Design decision: no `updated_at` column, no migration

The issue doesn't ask for an "edited" timestamp or indicator, and the PM's triage explicitly
scoped this as no-migration. Adding `updated_at` to `child_diary` to mirror `fragments` would be
solving a problem nobody asked for and would pull a migration into a task that doesn't need one.
**Decision: the PATCH handler updates only `content`; `createdAt` is left untouched (it still
correctly reflects when the note was originally written, which is exactly what the issue's "the
observation stays connected to its original date and context" asks for — editing must not shift
the diary's sort order or displayed timestamp).** If a future ticket wants an "edited" badge,
that's a `updated_at` migration to propose against the tech-stack registry then, not now.

### Design decision: reuse `DIARY_CONTENT_MAX_LENGTH`/`isDiaryDraftValid` for the edit textarea too

#119 added `DIARY_CONTENT_MAX_LENGTH = 2000` and `isDiaryDraftValid` (trim-based, non-empty +
≤2000) as exports of `diary.tsx`, used today only on the create textarea. The edit textarea must
be held to the identical rule — same constant for `maxLength`, same predicate to gate the
`Сохранить` button and disable it while invalid, same always-visible counter styling as the create
form. No new constant, predicate, or duplicated length-check logic; the edit path is a second
consumer of the same two exports, not a fork of them.

### Files by scenario

| Scenario | Backend files | Frontend files |
|----------|---------------|-----------------|
| SCENARIO 1 — clicking "Изменить" on a diary entry switches that entry into an editable textarea, pre-filled with its current content, matching `fragments.tsx`'s inline pattern | none | `packages/web/src/pages/diary.tsx` |
| SCENARIO 2 — saving an edit with valid content (non-empty, ≤2000 chars) updates the entry in place; the list re-renders the new content without a full refetch, and the entry stays at its original position (no reorder, no `createdAt` change) | `packages/api/src/routes/diary.ts` | `packages/web/src/pages/diary.tsx` |
| SCENARIO 3 — the edit textarea enforces the same 2000-char cap and counter as the create textarea (`maxLength`, live counter, disabled save button when invalid) — reusing `DIARY_CONTENT_MAX_LENGTH`/`isDiaryDraftValid`, not a second implementation | none | `packages/web/src/pages/diary.tsx` |
| SCENARIO 4 — clicking "Отмена" discards in-progress edits and reverts to display mode without calling the API | none | `packages/web/src/pages/diary.tsx` |
| SCENARIO 5 — a request that bypasses the browser and sends >2000 chars or empty content to `PATCH /api/diary/:id` is rejected with the same Russian message as create (schema reuse, not a new one) | `packages/api/src/routes/diary.ts` | none |
| SCENARIO 6 — `PATCH /api/diary/:id` for a non-existent id returns 404, matching the `fragments.ts` PATCH precedent, rather than silently succeeding | `packages/api/src/routes/diary.ts` | `packages/web/src/pages/diary.tsx` (surfaces the error via existing `StatusCallout` path, same catch-block pattern as `handleDelete`) |

### Data model changes

None. `child_diary.content` is already `text`; no new column, no migration — confirmed by direct
read of `packages/core/src/db/schema.ts:203-207`.

### Files to modify

```
packages/api/src/routes/diary.ts
  + router.patch('/:id', validate(createDiarySchema), async (req, res) => {
      parse id same as existing DELETE handler (parseInt + isNaN guard → 400)
      const { content } = req.body as z.infer<typeof createDiarySchema>
      const [updated] = await db.update(childDiary).set({ content }).where(eq(childDiary.id, id)).returning()
      if (!updated) { res.status(404).json({ error: 'Diary entry not found' }); return }
      res.json(updated)
    })
    (mirrors fragments.ts's PATCH structure; omits `updatedAt` — see "no migration" decision above)

packages/web/src/lib/api.ts
  diary: { ... }
  + update: (id: number, content: string) =>
      request<DiaryEntry>(`/api/diary/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    (mirrors fragments.update's shape at api.ts:746-750)

packages/web/src/pages/diary.tsx
  + const [editingId, setEditingId] = useState<number | null>(null)
  + const [editText, setEditText] = useState('')
  + const handleSaveEdit = async (id: number) => {
      if (!isDiaryDraftValid(editText)) return
      try {
        const updated = await api.diary.update(id, editText.trim())
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content: updated.content } : e)))
        setEditingId(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось изменить запись')
      }
    }
  list item render: conditionally render <textarea> (editingId === entry.id, value={editText},
    onChange sets editText, maxLength={DIARY_CONTENT_MAX_LENGTH}) in place of the current <p>,
    plus a counter span matching the create form's styling, shown only while editing that entry
  action row (next to "Удалить"): while editingId === entry.id, show "Сохранить" (calls
    handleSaveEdit(entry.id), disabled when !isDiaryDraftValid(editText)) and "Отмена" (resets
    editingId to null); otherwise show "Изменить" (sets editingId to entry.id and editText to
    entry.content), matching fragments.tsx's button-swap pattern (fragments.tsx:200-219)
```

### Files to create

```
packages/api/src/routes/diary.test.ts (extend existing file, not a new one)
  — no new schema tests needed: the PATCH route reuses createDiarySchema verbatim, and its
    boundary/empty/message cases are already covered by #119's existing tests in this file.
    (If this repo's convention shifts toward route-level integration tests in a later ticket,
    that's a separate concern from this task's schema-reuse-only scope.)

packages/web/src/pages/diary.test.ts (extend existing file, not a new one)
  — no new pure function is introduced: handleSaveEdit is a side-effecting handler (matches
    fragments.tsx's handleSaveEdit, which also has no direct unit test — fragments.test.ts only
    tests the pure universeName helper). isDiaryDraftValid is reused unchanged and already has
    full coverage from #119.
```

### Implementation order

1. `diary.ts`: add the `PATCH /:id` route reusing `createDiarySchema`.
2. `api.ts`: add `diary.update`.
3. `diary.tsx`: add `editingId`/`editText` state, `handleSaveEdit`, and the conditional
   textarea/display render + button swap in the list item.
4. Manual verification (no new automated test files — see "Files to create" above for why).

### Definition of Done — per layer

**Backend:** `npx tsc --noEmit` clean. Existing `npx vitest run packages/api/src/routes/diary.test.ts`
still passes unchanged (schema reused, not modified). Manual check: `curl -X PATCH
localhost:8020/api/diary/<id> -d '{"content":"..."}'` returns 200 with updated content; a >2000-char
body returns the same Russian message as `POST`; a nonexistent id returns 404.

**Frontend:** `npx tsc --noEmit` clean. Existing `npx vitest run packages/web/src/pages/diary.test.ts`
still passes unchanged. Manual check in local dev (`npm run docker:up`): click "Изменить" on an
entry, edit its text, confirm the counter and 2000-char cap behave identically to the create
textarea, click "Сохранить" and confirm the list updates in place at the same position (no
reorder), click "Изменить" then "Отмена" on another entry and confirm no request fires and the
original text is unchanged.

**Infrastructure:** none — no migration, no new endpoint deploy concern beyond the normal
push-to-`main` pipeline.

### Scope boundary

Out of scope for this task:
- Any `updated_at` column or "edited" indicator on diary entries — not asked for by the issue, and
  adding one would require a migration the PM's triage explicitly says isn't needed. Flagged above
  as a possible fast-follow only if a future ticket wants it.
- Any change to `GET /api/diary` or `DELETE /api/diary/:id` — both are untouched by this task.
- Any new dedicated "edit entry" page/route — the issue's own framing ("edit the existing entry
  rather than deleting it and starting over") and the `fragments.tsx` precedent both point to
  inline edit-in-place, not a separate view.

### Risk/effort verdict

**Low risk, small effort.** This is a direct structural copy of an already-shipped pattern
(`fragments.tsx`'s inline edit) onto a strictly simpler case (one field instead of three, no
`usedCount`/`universeId` concerns), plus one schema-reuse PATCH route that adds zero new
validation logic (`createDiarySchema` is imported, not duplicated) and zero migration risk (`text`
column already supports it). The only place with real latitude — worth naming, not smoothing
over — is the "no `updated_at` column" decision: it's a deliberate scope cut consistent with the
PM's own no-migration framing and the issue's silence on an edited-indicator, not an oversight,
but a reviewer disagreeing with it would need a follow-up migration, not a change to this task's
files.
