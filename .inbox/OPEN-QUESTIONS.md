# Open Questions

## Langfuse Trace Coverage Gaps

### Issue: Many pipeline entry points are not wrapped with `withPipelineTrace()`

**Problem:**
- Individual LLM generations are traced to Langfuse, but many are orphaned (no parent trace)
- When `synthesizeSashaContext()`, `runQuestionsPhase()`, `runPlotterOnly()`, etc. are called directly, they create generations without a parent `story-pipeline` trace
- This makes it hard to correlate all AI calls for a single story in the Langfuse dashboard

**Entry points NOT currently wrapped:**

| Function | Call Sites | Wrapped? |
|----------|-----------|----------|
| `synthesizeSashaContext()` | telegram.ts:85, pipeline.ts:94, pipeline-plan-trigger.ts:44, pipeline-text-redo.ts:29, stories-series.ts:38 | ❌ |
| `runQuestionsPhase()` | telegram.ts:89, pipeline.ts:98 | ❌ |
| `runPlotterOnly()` | pipeline-plan-trigger.ts:48 (via `triggerPlanPhaseFromAnswers`) | ❌ |
| `runPlanPhase()` | pipeline-text-redo.ts:33 (via `triggerTextRedoWithAnnotations`) | ❌ |
| `runTextPhase()` | pipeline-text-redo.ts:55 (via `triggerTextRedoWithAnnotations`) | ❌ |
| `runWriterOnly()` | (potential call sites) | ❌ |
| `runTextCritique()` | (potential call sites) | ❌ |
| `runAnnotatedRewrite()` | (potential call sites) | ❌ |
| `runPipeline()` | pipeline.ts (full pipeline flow) | ✅ |

### Questions

1. **Scope: Should ALL pipeline phase calls be wrapped with `withPipelineTrace()`?**
   - Each of these entry points represents work on a story
   - Should each create its own parent trace, or only the main pipeline?
   - What about `synthesizeSashaContext()` which is called from unrelated contexts (not always tied to a story)?

2. **Design: How should trace hierarchy work?**
   - Option A: Flat — all generations are direct children of one `story-pipeline` trace
   - Option B: Hierarchical — intermediate spans for phases (Plotter span → multiple generations, Writer span → multiple generations)
   - Option C: Mixed — Plotter/Writer get spans when called via `runPipelinePhase`, but not when called standalone

3. **Special case: `synthesizeSashaContext()` tracing**
   - Called from 5 different places, some tied to stories, some not
   - Should it wrap itself internally? Create a trace only if not already in one?
   - Or should callers be responsible for wrapping it?

4. **Validation: How to verify coverage?**
   - Write a script to check all `await runXPhase/runXOnly/synthesize` calls and flag if not wrapped?
   - Add a Langfuse integration test that verifies parent traces exist for all pipeline runs?

