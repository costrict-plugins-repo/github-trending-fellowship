# ADR: Three-layer memory boundary schema

**Status:** Proposed
**Date:** 2026-04-26
**Decider:** Merry (technical) + Frodo (final call on enforcement timing — v1.0 doc-only vs v1.1 lint)

## Context

Aragorn's conformance audit (`2026-04-26-comparison-best-practices.md`) flagged that Fellowship maps memory to three semantic layers — **semantic** (specs), **episodic** (per-agent memory), **procedural** (plans) — but the boundaries are conceptual, not enforced. Nothing tells an agent "this kind of fact goes here, that kind goes there." The directory guide (`docs/fellowship/README.md`) names what each directory contains in plain English; it does not name what each directory must *not* contain. Drift is the predictable failure: a spec accretes execution detail; a plan grows scope rationale; a per-agent note duplicates a project fact that belonged in `product.md`.

This ADR locks the schema. Not the lint, not the hook — the rule.

## The three layers

### Layer 1 — Specs (semantic)

**Path:** `docs/fellowship/specs/*.md` (active) and `specs/archive/*.md` (completed).

**What lives here:**
- Aragorn PRDs (what we build, for whom, why).
- Merry ADRs (architectural decisions, options evaluated, "if wrong" consequences).
- Formal scope-locked feature specs that survive the work that produces them.
- Reference: knowledge that other agents must build *against*.

**Anti-examples — never put here:**
- "Step 1, step 2, step 3" execution sequences (those are plans).
- A single agent's transient discovery during craft (that is per-agent memory or a debug-log entry).
- Status notes ("Gimli started Tuesday, finished Wednesday") — quest log territory.
- User preferences that aren't load-bearing for the architecture ("Frodo prefers TanStack Query" without a constraint reason — that is Aragorn's per-agent memory at most, possibly product.md).

### Layer 2 — Plans (procedural)

**Path:** `docs/fellowship/plans/*.md` (active) and `plans/archive/*.md` (completed).

**What lives here:**
- Step-by-step execution plans produced by the planning skill.
- File-level tasks, ownership, verification checkpoints.
- Order-of-operations: who runs first, what dispatch follows, where the merge happens.

**Anti-examples — never put here:**
- The *why* of a design choice (that is an ADR; the plan should reference, not restate).
- Long-lived knowledge ("we always use Drizzle" — that is product.md or an ADR).
- Per-agent observations made during execution (those land in per-agent memory or, if user-visible, in the quest log).

### Layer 3 — Per-agent memory (episodic)

**Path:** `.claude/agent-memory/fellowship-<agent>/*.md` plus `MEMORY.md` index.

**What lives here:**
- The user's working preferences, as observed in conversation (feedback memories).
- Project context the agent learned in passing that isn't formal enough for product.md (project memories — "the auth rewrite is driven by legal, not tech-debt cleanup").
- Pointers to external systems (reference memories — "bugs tracked in Linear project INGEST").
- Surprises and corrections: what the agent should not repeat next session.

**Anti-examples — never put here:**
- Code patterns derivable from `git log` or current source (the global instruction explicitly forbids this).
- Active task state (that is a plan or a TodoWrite item).
- Anything other agents need to know — if it crosses agent boundaries, it belongs in a spec, in product.md, or in a handoff. Per-agent memory is single-agent by construction.

## The boundary — tie-breaker rules

When a fact could plausibly land in two layers:

1. **Cross-agent vs single-agent.** If two agents need the fact, it cannot live only in one agent's memory. Promote to product.md (project-wide ground truth) or a spec (architectural decision). Per-agent memory is a private notebook, not a shared one.
2. **Persistent vs transient.** If the fact survives this quest, it is spec or product.md. If it expires when the quest closes, it is plan or quest-log. If it survives but only matters to one agent, it is per-agent memory.
3. **Decision vs execution.** If it documents a *choice and its consequences*, it is a spec (ADR). If it documents a *sequence of actions*, it is a plan. The plan may cite the ADR; never the inverse.
4. **Worked example.** "Aragorn discovered Frodo prefers TanStack Query over SWR." If the preference is a hard architectural constraint affecting future builds → ADR (with reasoning). If it is a working preference Aragorn should not relitigate → Aragorn's per-agent memory. If it is a project-wide ground truth all agents must honor → product.md. The schema does not collapse the choice; it forces the agent to *make* the choice and write the answer in exactly one place.

## Optional enforcement

A documentation lint is feasible but **not v1.0 work**. Realistic shape: a script that scans `specs/*.md` for stepwise-execution patterns (`1.`, `2.`, `3.` headings followed by file-creation imperatives) and `plans/*.md` for ADR-shaped sections (`Options Considered`, `Consequences`). False-positive rate would be high; the rule shape doesn't lend itself to clean regex. Recommend v1.1 at the earliest, and only if drift becomes observable. For v1.0, ship the schema as documentation and add a one-line invariant to `agents/_shared/companion-protocol.md` ("If your output could plausibly belong in two layers, see `docs/fellowship/specs/2026-04-26-adr-memory-boundary-schema.md` for the tie-breakers.").

## Migration — current artifacts

A targeted scan suggests the schema is largely honored today. Two patterns to verify post-spec (Sam or a follow-up Merry pass, not me):

- **`specs/archive/2026-03-28-autoimprove-spec.md`** mixes ADR-style decisions with literal bash steps (`git worktree add /tmp/...`). Borderline — the bash is illustrative, not procedural intent. Acceptable as long as the canonical sequence lives in a plan or in `evals/_runner/improve.sh`.
- **`docs/fellowship/plans/2026-04-22-p4-p5-p6-plan.md`** restates rationale that arguably belonged in a spec. Borderline — short rationale in a plan is fine; multi-paragraph design defense is not. Spot-check on next plan write, don't rewrite history.

Per-agent memory: not audited here. Recommend each agent run a self-audit on next dispatch ("does anything in your `.claude/agent-memory/` belong in product.md or a spec?"). Not required for v1.0 tag.

## Recommendation

Ship the schema as this ADR. Add the one-line pointer to `companion-protocol.md`. Defer the lint. Treat the tie-breaker rules as the load-bearing artifact — they are what an agent reaches for when uncertain.
