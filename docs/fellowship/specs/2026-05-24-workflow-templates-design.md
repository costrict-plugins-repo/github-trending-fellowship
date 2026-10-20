---
name: workflow-templates-design
status: active
created: 2026-05-24
type: design-spec
implementer: Gimli (workflows.md + SKILL.md edits + tier-scoring.md edits)
reviewer: Legolas (clarity, internal consistency, doctrinal coherence between workflows.md and revised tier doctrine)
---

# Workflow Templates — Design Spec

A workflow layer above the existing atomic cycles in `cycles.md`. Three named recipes (`feature-flow`, `bug-flow`, `security-flow`) that Gandalf cites and adapts when orchestrating Tier 2+ critical or heavy work. The recipes are reference patterns with named variations, not prescriptive scripts. The work also corrects the Tier 2 doctrine, which currently contradicts the cycles in plain view.

## Problem

Two problems, the same underlying gap.

**Gandalf routes per turn but doesn't sequence.** With nine companion voices in place and the session opener landed, the auto-handoff chain (Gimli DONE → Legolas without asking) will sound coherent end-to-end. What's missing is the *workflow* that knows the chain. Today the user re-specifies the workflow each prompt — *"now dispatch Legolas," "now Pippin should test gaps"* — because Gandalf's mental model of multi-step orchestration is invisible. No file names the patterns; nothing makes them citeable.

**The tier doctrine contradicts itself.** `tier-scoring.md` says *"Tier 2 — One companion. One skill or one agent dispatch."* `cycles.md` says *"After Gimli DONE on critical paths, dispatch Legolas."* A single-file critical-path feature scores into Tier 2 (1–3 range), where the doctrine says one companion — yet cycles say Legolas is automatic. The two pages have contradicted each other since both were written. The contradiction sits invisible because most work either lands cleanly in Tier 1 (where the question doesn't arise) or escalates by score into Tier 3 (where multi-companion is expected). The borderline Tier 2 cases get routed inconsistently because the doctrine offers no coherent answer.

The two problems share a root: the doctrine names *counts* of companions instead of *shapes* of work. Counts are arbitrary; shapes are recognizable. Naming the shapes — workflows — and re-grounding the tier doctrine in shape rather than count fixes both.

A corroborating observation: the quest-log entry from 2026-04-27 — *"Tier 4 utilization audit. Frodo flagged Fellowship rarely reaches Tier 4 in practice; default conservativism may be over-tuned"* — points at the same gap one tier higher. Without named shapes, the conservatism is mechanical. With names, Gandalf has cues for when complex work *fits* a heavier tier rather than only a score threshold for when it *exceeds* a lighter one.

## Constraints

Three constraints shape the work:

1. **Cycles are atomic and stay atomic.** `cycles.md` defines the three review, testing, and design cycles. Workflows compose cycles; they do not replace them. A workflow that contradicted a cycle would create two competing sources of truth for the same orchestration question.
2. **Workflows must be reference patterns, not prescriptive scripts.** The earliest version of this brainstorm raised the failure mode plainly: a mechanical `bug-flow` running on a one-line typo, a mechanical `feature-flow` dispatching Merry when no architectural choice is at stake. The recipes must name their canonical shape *and* their conditional steps *and* their legitimate variations, so Gandalf can adapt without leaving the recipe.
3. **No always-on overhead.** The session-opener spec just established a ~2 KB output budget conversation for SessionStart hooks. Workflow content is only relevant when Gandalf is doing Tier 2+ orchestration; paying token cost on every turn for a reference most turns don't need is exactly the wrong trade.

## Decision

Six decisions, each load-bearing.

### 1 — Architecture: content-only

Workflows are *nameable reference content*, not enforced infrastructure. No new hook. No marker file. No per-session state. The recipes live in `skills/using-fellowship/references/workflows.md` and Gandalf loads the file when his routing judgment encounters work that fits a recipe shape.

This is the middle path between two rejected alternatives. *Pure judgment* (no doc, no file, just sharpening the routing skill with examples) preserves flexibility but leaves the patterns invisible — the exact problem this work exists to fix. *Stateful workflows* (marker file, active-workflow state per session, UserPromptSubmit anchor reinforcing the current step) ossify what should stay situational; the same failure mode that made a stateful session-opener wrong makes stateful workflows wrong. Content-only preserves Gandalf's judgment while making the patterns nameable, citeable, and consistent across sessions.

### 2 — Recipe set: three end-to-end recipes

`feature-flow`, `bug-flow`, `security-flow`. Each is an end-to-end recipe describing a recognizable shape of Tier 2+ work. *Refactor-flow* is deferred — it is rare enough to start as a noted variant inside `feature-flow` and promoted to its own recipe only if practice shows it earns the space.

Rejected: an orchestration-primitives layer (`sequential-chain`, `parallel-fan-out-reconcile`, `iterate-on-feedback`) authored alongside the recipes. The benefit of primitives is mostly pedagogical — they help a *reader* of the docs, not Gandalf at dispatch time. Recipes already imply their primitives by spelling out the sequence; the separate layer adds maintenance and reader decision-friction (*"is this a known recipe or a one-off composition?"*) without runtime benefit.

### 3 — Recipe register: reference patterns with named variations

Each recipe documents four things:
- **Canonical shape** — one line, the typical path.
- **Companions involved**, with explicit conditions: *when this companion enters*, *when they skip*.
- **Sequence**, including parallel branches and reconcile points.
- **Variations** — legitimate swaps, additions, omissions Gandalf can make. Cross-references to other recipes are soft (*"if security-relevant, consider security-flow"*) rather than hard transitions.
- **When this is the wrong recipe** — the escape clauses. Tier 1 cutoffs, recipe substitutions.

The recipe inspires the dispatch; it does not dictate it. The principle this rests on is already in the voice doc: *"the simplest path that serves the task — that is prudent. The elegant one that serves a future that hasn't arrived — that is folly."* Workflows make that principle citeable for routing.

### 4 — Workflows name companions and modes, not skills

The distinction matters because conflating them couples two layers that should change independently. Skills are *methods* (how a companion does the thing). Workflows are *sequence and composition* (who runs when, in what shape, with what other companions). When Aragorn's brainstorming methodology evolves, no workflow doc should follow. When a workflow adds a step, no skill file should follow.

But the distinction has an edge worth marking, or something legitimate gets lost. **A mode is not a skill.** Pippin has three modes — test-after, test-first, browser-verify — and choosing among them is a *workflow-level* decision because the mode affects when Pippin runs, what input he needs, and what the next step is. Arwen has design-contract compliance vs. full UX audit — same shape. Mode-naming is legitimate orchestration. Skill-naming is overreach.

A two-line meta-rule appears at the top of `workflows.md`:

> *"Workflows name companions and modes where the mode is the orchestration move. Workflows do not name skills — each companion's toolkit lives in their agent file."*

### 5 — Mechanism: on-demand reference

Workflow content is not in the SessionStart cached prefix. The `using-fellowship` routing skill references it; Gandalf reads it when his routing judgment encounters work that fits a recipe shape. This is the natural seam — the routing skill already references `cycles.md` the same way.

Rejected: SessionStart hook injection in the voice-hook pattern. Voice content is in the cached prefix because it shapes every response. Workflow content is only relevant on Tier 2+ orchestration turns. Most turns don't need it, and paying the token cost on every turn for an always-on reference is the wrong trade.

Rejected: a UserPromptSubmit anchor reinforcing the active workflow per turn. Requires per-session state (which workflow is active), which contradicts the content-only architecture above. Also turns workflows into something Gandalf cannot adapt freely mid-session.

### 6 — Selection: Gandalf judgment, Tier 2+ gate

Gandalf invokes a workflow when his routing decision encounters work that is (a) Tier 2 or higher and (b) shaped like one of the recipes. Tier 1 (typos, one-liners, two-three line changes) uses cycles alone — no workflow.

The routing skill (`skills/using-fellowship/SKILL.md`) gets a short *Workflows* subsection in or adjacent to the *Workflow Cycles* area, naming the three workflows and the activation rule, pointing at `references/workflows.md` for the contents.

### 7 — Format: single file in v1, split trigger documented

A single `references/workflows.md` with the meta-rule at the top, three recipes under section headings, cross-references inline. Split into `references/workflows/` (one file per recipe plus an index) when **either** the recipe count passes five **or** any single recipe passes ~200 lines. Trigger documented in the file so future-us doesn't re-debate.

Rejected for v1: per-file from the start. Pays the cost of a two-layer doc structure (file + index) to serve a future scale that hasn't arrived.

### 8 — Tier doctrine correction folded into this work

The tier doctrine fix and the workflows file are the same conceptual change. Without the doctrine fix, the workflows file would contradict the very doctrine that classifies the work it describes. They ship together.

Corrected meanings:

| Tier | Current doctrine (incoherent) | Corrected doctrine (this spec) |
|---|---|---|
| **Tier 1 — Direct** | Gandalf handles. No agents. | Unchanged. |
| **Tier 2 — Focused dispatch** | *"One companion. One skill or one agent dispatch."* | *"Focused work. One primary companion. Cycles still run automatically on critical paths — Legolas review on a Gimli build at Tier 2 is the cycle, not a tier escalation."* |
| **Tier 3 — Workflow-shaped** | *"Sequential chain. Plan first. Gimli → Legolas → Pippin cycle."* | *"Workflow-shaped. The work fits a named recipe — `feature-flow`, `bug-flow`, `security-flow`. Multi-companion sequence with conditional steps. Plan first."* |
| **Tier 4 — Parallel / Teams** | Unchanged in meaning. | Unchanged. |

The distinguishing line between Tier 2 and Tier 3 becomes *focused vs. workflow-shaped*, not *count of companions*. Multi-companion is the default for any non-trivial work because cycles guarantee it. The tier names the *shape* of orchestration, not the count of dispatches.

The score signals in `tier-scoring.md` can stay — they remain useful heuristics for borderline calls. The thresholds and the *"What happens"* column get rewritten to match the corrected meanings.

## Recipe contents (full drafts)

The three recipes as drafted and approved in the brainstorm. These are the canonical content the workflows file will carry. The small revision noted in decision 4 (drop the explicit `fellowship:investigate` skill name from bug-flow) is applied here.

### `feature-flow`

**Canonical shape.** scope → architecture → build → review → test gaps → docs.

**When this applies.** Tier 2+ new feature, new module, or new capability. Multi-file change with meaningful logic. The user is asking for something the codebase does not yet do.

**Companions.**

| Companion | Step | Enter when… | Skip when… |
|---|---|---|---|
| Aragorn | scope | scope is fuzzy, requirements not locked, or risk of scope creep | scope is locked, single well-defined ask |
| Merry | architecture | a real architectural choice exists (data model, module boundary, interface contract) | architecture is obvious — single file, established pattern, no new boundary |
| Gimli | build | always | never |
| Legolas | code review | always on Tier 2+ — this is the auto-cycle from `cycles.md` | never; Legolas runs whenever Gimli reports DONE on meaningful logic |
| Pippin | test gaps | Legolas flags coverage thin, *or* user asked for tests up front (test-first inversion) | Legolas reports coverage adequate and no spec violation |
| Bilbo | docs | the work has an external surface — README, changelog, public API | internal-only refactor or behind-the-scenes change |

**Sequence.** Aragorn → Merry → Gimli → Legolas → (loop Pippin with Gimli for fixes if needed) → Bilbo. Each arrow is conditional on the row above.

**Variations.**
- **Visual design.** Arwen *before* Gimli for visual exploration when the work has a user-facing face; Arwen *after* Legolas for compliance check against her design contract.
- **Test-first inversion.** Pippin → Gimli → Legolas when the spec can be expressed as failing assertions before any code exists.
- **Mid-build architecture loop.** If Gimli reports the architecture doesn't hold mid-build, route back to Merry.
- **Sam early.** When the feature has an infra dependency (Redis, env var, background job), Sam surfaces the requirement before Gimli starts.

**When this is the wrong recipe.** Tier 1 work. Bug-fix work — use `bug-flow`. Pure refactor with no behavior change — same shape works, but Merry leads, Pippin runs the existing test suite as the contract, Bilbo skips.

### `bug-flow`

**Canonical shape.** investigate → root cause → fix → review → verify.

**When this applies.** Tier 2+ defect or unexpected behavior. The system is doing something it shouldn't, or not doing something it should. Distinct from `feature-flow` because *investigation precedes everything* — no fix without root cause.

**Companions.**

| Companion | Step | Enter when… | Skip when… |
|---|---|---|---|
| **investigate** (in-session, Gandalf-led) | investigate | always — this is the discipline that distinguishes bug-flow from feature-flow | never; skipping investigation is how the wrong fix gets shipped |
| Pippin | reproducer test | bug can be expressed as a failing assertion; valuable for regression-proofing | bug is visual/UX and not test-expressible — use browser-verify after the fix instead |
| Gimli | fix | always, *after* root cause is known | never; if no root cause, no Gimli |
| Legolas | code review | always on Tier 2+ fixes touching meaningful logic | trivial fix path where the diff is one safe line and review-cycle would be ceremony |
| Pippin | verification | always — confirm the reproducer now passes, confirm no regressions | never on Tier 2+; verification is the close |

**Sequence.** Investigation (in-session, optionally with Pippin reproducing) → root cause confirmed → Gimli fix → Legolas review → (loop fixes if needed) → Pippin verify → close.

**Variations.**
- **Production incident.** Sam in parallel with investigation to surface infra signals — recent deploys, env changes, log volume.
- **Security-adjacent bug.** Boromir leads or co-leads investigation when the defect is or might be a vulnerability. If it is, the work converts to `security-flow` mid-stream.
- **Spec-was-wrong discovery.** If root cause is "spec is wrong," loop to Aragorn for scope correction *before* any code change.
- **No reproducer.** UI/UX defects where Pippin reproducer isn't practical — skip the reproducer, use Pippin browser-verify after the fix.

**When this is the wrong recipe.** Trivial defect that can be fixed and verified in one breath. A "bug" that is actually a feature request — the system works as designed but the user wants different behavior — that is `feature-flow`.

### `security-flow`

**Canonical shape.** threat-model question → scope → architecture → build → parallel review (Legolas + Boromir) → reconcile → fix → re-review → verify.

**When this applies.** Work touching auth, payments, secrets, public API surface, data mutations with authorization implications, anything where the security boundary is the architecture. Boromir is the recipe's defining companion — he enters twice, and the parallel review is the recipe's defining move.

**Companions.**

| Companion | Step | Enter when… | Skip when… |
|---|---|---|---|
| Boromir | pre-build consultation | threat model is unclear, the change introduces a new boundary, or the work is greenfield in security terms | the threat model is established (e.g., adding a third OAuth provider to an existing auth system) |
| Aragorn | scope | as in feature-flow | scope is locked |
| Merry | architecture | nearly always in security work — the boundary *is* the architecture, even when the change feels small | one-line CSRF token addition or a similarly narrow patch on an established pattern |
| Gimli | build | always | never |
| Legolas | code review | always, in parallel with Boromir | never |
| Boromir | post-build review | always, in parallel with Legolas — this is the recipe's defining move | only when the work is audit-only with no build (see variation) |
| Pippin | test gaps | nearly always for security work — threat-case assertions matter | when the security property can't be tested without breaking abstraction barriers, document why |

**Sequence.** Threat-model question (with Boromir if unclear) → Aragorn scope → Merry architecture → Gimli build → **Legolas ‖ Boromir** (parallel) → consolidate findings → SendMessage Gimli for fixes → re-dispatch both reviewers → Pippin verifies threat-case assertions → close.

**Variations.**
- **Audit-only.** Existing code, no build — Boromir audits → findings → Gimli fixes → Legolas + Boromir re-review. Skips Aragorn, Merry, the build step.
- **Established threat model.** Skip pre-build Boromir consultation when the boundary is well-understood. Keep the parallel post-build review.
- **Small-scope security patch.** Skip Merry when scope is narrow on an established pattern. Keep parallel Legolas + Boromir.
- **No Pippin.** When the security property can't be tested cleanly, rely on Boromir's manual audit as the assurance. Document the why.

**When this is the wrong recipe.** Code that touches no security boundary. Visual changes inside a security-sensitive component that don't change security behavior. A bug *report* in a security-sensitive area starts as `bug-flow` and converts mid-stream only if the investigation surfaces a vulnerability.

## Implementation contract

**Files created:**
- `skills/using-fellowship/references/workflows.md` — meta-rule at top + three recipes under section headings + the v1-to-v1.1 split trigger documented near the end.

**Files modified:**
- `skills/using-fellowship/SKILL.md` — new *Workflows* subsection inside or adjacent to the existing *Workflow Cycles* section. Three or four sentences naming the three workflows, the activation rule (Tier 2+, judgment on whether the work has the shape of a named recipe), pointing at `references/workflows.md` for contents. Also: revise the *Tier 2* and *Tier 3* bullets in the *Tiered Routing* section to match the corrected doctrine.
- `skills/using-fellowship/references/tier-scoring.md` — rewrite the *Thresholds* table's "What happens" column and the prose around it to reflect *focused vs. workflow-shaped*. Score signals and threshold numbers can stay; the *meaning* of each tier changes. The worked example should be revisited and either kept (if it still illustrates the corrected meaning cleanly) or replaced with one that does.

**No new hook. No marker file. No per-session state.**

## Scope

**IN:**
- The three files above (one created, two modified).
- The meta-rule, all three recipe drafts, the split trigger, the corrected tier semantics.
- Quest-log entry update (mark this design-spec landing; carry the implementation as an open item).

**OUT (deferred to v1.1 or later, noted on quest log):**
- A *refactor-flow* recipe. Possible if practice shows it earns its name.
- An *orchestration moves / primitives* section. Possible if practice shows recipes don't cover the long tail.
- Any SessionStart hook for workflow content. Not needed; on-demand reference suffices.
- A repository-wide sweep for other places tier semantics appear (companion agent files, README sections, references). Likely a few stragglers. Add to quest log for v1.1 — directed grep pass.
- Workflow-aware session-opener content. Already noted in the session-opener spec as a future extension; lands separately.
- Eval scenarios for workflow routing. Worth marking on the quest log — per-companion evals can't catch orchestration regressions, the same gap the existing entry on "end-to-end orchestration fixture" already names. The workflow recipes give that fixture concrete shapes to exercise.

## Considered and rejected

**Pure judgment — no workflow files at all.** Sharpen `cycles.md` and the routing skill with composition examples; trust Gandalf's voice and routing to do the work. Cheapest. Rejected because it leaves the patterns invisible — the very problem this work exists to fix.

**Stateful workflows — marker file, active-workflow state per session, UserPromptSubmit anchor.** Most prescriptive. Rejected because it ossifies what should stay situational and re-introduces the brittleness the session-opener spec explicitly designed away from.

**Workflow content injected via SessionStart hook.** Pays token cost on every turn for content most turns don't need. Rejected for the same budget reasoning the session-opener spec established.

**Orchestration primitives as a separate layer.** Pedagogically appealing, runtime irrelevant. Rejected as premature factoring; revisit as a v1.1 addition if recipes prove insufficient for the long tail.

**Two recipes instead of three (security-flow absorbed as a variation of feature-flow).** Tempting on minimalism grounds, but trades naming for that minimalism — and naming is the whole point of the workflow layer. Rejected.

**Per-file recipe format from v1.** Pays the cost of a two-layer doc structure (file + index) to serve a future scale that hasn't arrived. Rejected with a documented split trigger.

**Workflows naming skills.** Couples two layers (sequence/composition and method) that should change independently. Rejected with the meta-rule explicitly capturing the boundary.

**Doctrine fix as a separate spec/plan, sequenced before workflows.** Tempting because the doctrine touches more than just workflow work — but the workflows file is what *gives Tier 3 its meaning*, and shipping the doctrine fix without the recipes leaves Tier 3 named but undefined. The two changes are the same conceptual edit. Bundled.

## Risks and unknowns

**Adoption inertia.** Naming workflows does not guarantee Gandalf uses them. The risk is the workflows file gets written, Gandalf cites it in the first few sessions, then drifts back to the old patterns. Mitigation: the routing skill update names the workflows directly in its *Workflows* subsection, so the activation rule lives in the prompt Gandalf reads on dispatch — not in a reference file he might forget to load. The eval-scenarios entry on the v1.1 quest log is the longer-term answer.

**The corrected Tier 2 meaning may still feel "where most work lives."** If Gandalf continues to over-prefer Tier 2 even with the corrected semantics, the under-utilization of Tier 3 the quest log already flags will persist. Mitigation: the workflow recipes give Tier 3 a clearer shape to recognize than the score signals alone. Worth re-evaluating after a few real Tier 3 dispatches.

**Variations may grow faster than recipes can absorb them.** As practice surfaces edge cases, the *Variations* section of each recipe may bloat. The split trigger (recipe > 200 lines) catches this mechanically; the more interesting question is whether bloated variations are themselves a signal that the recipe-as-pattern register is breaking down. Worth marking — if a recipe's variations outweigh its canonical, the recipe itself may need rethinking.

**Cross-recipe transitions are documented loosely.** *"If the bug turns out to be a vulnerability, convert to security-flow mid-stream"* is the kind of hand-off that sounds clean in prose but may need a sharper protocol in practice. Acceptable for v1; mark for review after real cross-recipe transitions occur.

## Open items

- Whether the `tier-scoring.md` worked example survives the doctrine fix or needs replacement. Decided in implementation when Gimli reads it against the corrected meanings.
- Whether the *Workflows* subsection in `SKILL.md` belongs *inside* the existing *Workflow Cycles* section or as an adjacent peer. Either reads cleanly; pick on layout in implementation.
- Whether the workflows file's meta-rule (*"workflows name companions and modes, not skills"*) deserves a third sentence noting cross-recipe references as the legitimate cross-link form. Possibly clearer with it; possibly clutter without. Decide in implementation.

## Next moves

1. Frodo reviews this spec.
2. Invoke `fellowship:planning` to produce the implementation plan.
3. Tier 2 — focused dispatch. Gimli authors the new file and edits the two existing ones; Legolas reviews for clarity, internal consistency, and the doctrinal coherence between `workflows.md` and the revised tier doctrine.
4. Frodo reads the diff before commit because the tier doctrine is load-bearing across the plugin.
5. Commit. Quest log update marking the workflow-templates entry done; new quest-log items captured for the deferred work (refactor-flow, primitives, doctrine sweep, eval scenarios).
