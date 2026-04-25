---
type: scenarios
branch: main
task: move-to-api-2-overrides-cost
state: confirmed
updated: 2026-04-25
---

# Scenarios: Per-Story Overrides + Story-Detail Cost

### SCENARIO 2: User overrides a stage's model on the new-story form
Type: business
Actor: parent

The parent picks the writer dropdown and switches from the universe default to a specific free-tier model. The pipeline uses that model for the writer stage; all other stages keep their universe defaults. The story's `run_snapshots` row records the actually-used writer model.

Acceptance:
  Code:
    [ ] New-story form renders per-stage dropdowns + fallback dropdowns populated from /api/models
    [ ] /api/models endpoint returns rows from model_catalog where deleted_at IS NULL with id, name, input_usd_per_million, output_usd_per_million, is_free, supports_json_schema
    [ ] model-picker.tsx component exists in packages/web/src/components/
  Behavior:
    [ ] Per-story override sent to the API as part of the create-story payload overrides the universe default for that stage only
    [ ] run_snapshots.<stage>Model records the model id actually used (override, not the universe default)
    [ ] Stages with no override keep the universe default in run_snapshots
  Integration:
    [ ] Picker filters: free-only toggle, sort by input_usd_per_million ascending
    [ ] Model dropdown shows price label and free badge from model_catalog
    [ ] Create-story API accepts perStageOverrides as a partial map and forwards it through derivePerStageModels
  Observability:
    [ ] Not applicable
  Tests:
    [ ] derive-per-stage-models.test.ts (already exists from Phase 1) covers override resolution; add test case if not already present asserting per-story override wins over universe default
    [ ] story create endpoint integration test: created story with writer override has the override model in run_snapshots.writerModel and universe defaults elsewhere

### SCENARIO 6: User views cost on a ready story's detail page
Type: business
Actor: parent

The parent opens a story that just reached `status='ready'`. The detail page shows total USD spent for that story (sum of model_calls), a per-stage breakdown (stage, model, input tokens, output tokens, USD).

Acceptance:
  Code:
    [ ] Story-detail page renders a cost-summary block when model_calls rows exist for the story
    [ ] Story-list page shows a total USD column ("—" when no model_calls rows)
    [ ] deriveStoryCostBreakdown pure function in packages/core/src/cost/aggregations/
  Behavior:
    [ ] Total USD = sum(model_calls.usd) where story_id matches
    [ ] Per-stage rows ordered by created_at; multiple attempts for the same stage are listed as separate rows
    [ ] When no model_calls rows exist (legacy), the page renders no cost block (not "$0")
  Integration:
    [ ] Story-detail data fetch joins model_calls
    [ ] Story-list query joins sum(model_calls.usd) per story
  Observability:
    [ ] Not applicable
  Tests:
    [ ] derive-story-cost-breakdown.test.ts: synthetic model_calls rows → expected totalUsd + perStage shape ordered by created_at
    [ ] derive-story-cost-breakdown.test.ts: empty input → totalUsd=0 and empty perStage (caller decides whether to render)
