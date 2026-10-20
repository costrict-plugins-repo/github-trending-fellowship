# OpenSpace Analysis — What Fellowship Can Learn

**Source:** https://github.com/HKUDS/OpenSpace
**Date:** 2026-03-28
**Summary:** OpenSpace is a self-evolving AI agent skills framework from HKUDS. It solves the same core problem as Fellowship's autoimprove loop — agents improving from real-world failures — but from a different angle and at a different scale. Worth studying carefully.

---

## What OpenSpace Is

OpenSpace is a Python-based framework where AI agents accumulate, evolve, and share reusable **skills** (SKILL.md files with implementation code). It hooks into Claude Code, nanobot, and other MCP-compatible agents via an MCP server. The agent runs a task, OpenSpace records the full execution, analyzes it afterward, and evolves the relevant skills.

Measurable results on their benchmark: 4.2× higher task income, 46% token reduction in Phase 2 (after skill accumulation), 165 skills autonomously evolved — mostly focused on **error recovery and tool reliability**, not domain knowledge.

---

## Core Mechanisms (and How They Map to Fellowship)

### 1. Three Evolution Types

OpenSpace distinguishes three kinds of skill evolution:

| Type | What it does | Fellowship equivalent |
|------|-------------|----------------------|
| **FIX** | Repair a broken skill in-place | What autoimprove does now |
| **DERIVED** | Create a specialized variant from a parent skill | Not implemented |
| **CAPTURED** | Extract a new reusable pattern from a successful task | Not implemented |

Fellowship's autoimprove loop only does FIX — it proposes one change to an existing agent file per cycle. DERIVED and CAPTURED are absent.

**DERIVED** matters when an agent has accumulated specialized knowledge for a domain (e.g. a "Gimli for Next.js projects" derived from Gimli). Fellowship isn't there yet, but the concept is worth planting.

**CAPTURED** is the more immediately useful insight: when a companion successfully handles a novel situation, that pattern should become a new eval scenario. OpenSpace does this automatically. Fellowship does it manually — Gandalf logs feedback, a human converts it to scenarios. That gap is real.

### 2. Three Evolution Triggers

OpenSpace fires evolution from three sources:

| Trigger | What fires it | Fellowship equivalent |
|---------|-------------|----------------------|
| **Post-execution analysis** | After every task completes | Feedback capture (explicit/intent-triggered only) |
| **Tool degradation** | When tools fail repeatedly | Nothing |
| **Metric monitoring** | Periodic health scans | Nothing |

Fellowship's feedback capture is conservative by design (intent-first). OpenSpace's post-execution analysis fires automatically. Neither is wrong — the tradeoff is noise vs. coverage. OpenSpace presumably produces false positives; Fellowship misses failures that weren't explicitly flagged.

The tool degradation trigger is interesting but not directly applicable — Fellowship's companions don't use evolving tool integrations in the same way.

### 3. Execution Recording

OpenSpace records everything:
- `conversations.jsonl` — full agent dialogue per task
- `traj.jsonl` — structured tool invocation records (step, tool, status, error)
- `metadata.json` — task description, skills used, execution outcome

This is significantly richer than Fellowship's one-sentence feedback entries. The recording becomes the input to the post-execution analyzer, which then produces structured `EvolutionSuggestion` objects.

Fellowship's current feedback-log entry:
```json
{"agent":"gimli","trigger":"attribution_question","inferred":true,"failure":"Gimli added unspecified files outside task scope","correction":"Scope creep — stop at task boundary","timestamp":"..."}
```

This is enough for a human to write a scenario. But it's not enough for automated scenario generation — it lacks the actual exchange, what was asked, what the agent produced.

### 4. Skill Lineage DAG

OpenSpace tracks parent/child relationships between skills in SQLite. A DERIVED skill knows its origin. This enables:
- Rolling back to a parent if the derived version regresses
- Understanding how skills evolved over time
- Identifying which parent contributed to failures in derived skills

Fellowship's `history.jsonl` is linear per session. There's no lineage tracking between cycles or sessions. This matters more as the eval suite grows.

### 5. Quality Metrics per Skill

OpenSpace tracks success/failure rates, iteration counts, and error patterns per skill, over time. When a skill's metrics degrade past a threshold, evolution is triggered automatically.

Fellowship has no per-assertion health tracking across sessions. Each autoimprove run starts fresh, reads `history.jsonl`, and relies on that log to avoid re-trying discarded hypotheses. But there's no "assertion X has been failing more over the last 5 sessions" signal.

---

## What Fellowship Shouldn't Copy

**The recording infrastructure.** OpenSpace records every execution in detail — conversations.jsonl, traj.jsonl, SQLite databases, the whole stack. This is necessary when evolution is automated and continuous. Fellowship's autoimprove runs overnight against static scenarios. The overhead would not pay for itself.

**The cloud community.** Sharing evolved skills across projects makes sense for OpenSpace (general-purpose tool skills). Fellowship agents are deeply project-specific and persona-bound. Sharing Gimli's instruction file across projects adds no value.

**Automatic post-execution analysis.** Firing an LLM analysis call after every companion task is expensive. Fellowship's intent-triggered capture is the right tradeoff for a solo-dev plugin.

**The MCP server architecture.** OpenSpace exposes its skill engine as an MCP server so any agent can delegate to it. Fellowship's value is in the companions themselves, not in being a delegatable service.

---

## What Fellowship Should Adopt

### Near-term (worth building now)

**1. Richer feedback entries**

Current feedback entries capture the failure summary but lose the exchange. When Gandalf logs to `~/.claude/fellowship/feedback-log.jsonl`, include a `context` field: the user's input and the companion's response snippet that triggered the log. This makes automated scenario generation possible later — and makes human scenario-writing much faster today.

Updated entry format:
```json
{
  "agent": "gimli",
  "trigger": "attribution_question",
  "inferred": true,
  "failure": "Gimli added unspecified files outside task scope",
  "correction": "Stop at task boundary — don't touch files not named in the task",
  "context": {
    "user_input": "fix the typo in the button label",
    "agent_response_snippet": "...I also noticed the adjacent component had the same issue so I fixed both..."
  },
  "timestamp": "2026-03-28T..."
}
```

**2. CAPTURED evolution type in autoimprove**

When a scenario in `scenarios.jsonl` represents a genuinely novel pattern (not just a variant of an existing one), autoimprove should be able to *create* a new scenario rather than only modifying the agent file. This is the CAPTURED type applied to our context.

Concretely: add a step to SKILL.md where, if the analysis reveals a systematic gap that no existing scenario covers, the loop can propose a new scenario to add. Flag it for human review rather than auto-committing — we don't want the loop writing its own tests unchecked.

**3. Per-assertion trend tracking**

Extend `history.jsonl` with a running aggregate: for each assertion, track its pass rate across all sessions (not just the current one). This would allow autoimprove to identify which assertions are degrading over time vs. which were fixed and stayed fixed.

A lightweight implementation: after each session, append to `evals/<target>/assertion-health.jsonl` — one entry per assertion with `{assertion, passed, cycle, session_date}`. The loop reads this at Step 2 to weight which assertions to target.

### Longer-term (plant the seed)

**4. Session-end analysis hook**

OpenSpace's post-execution analysis runs automatically. Fellowship's equivalent would be a SessionEnd hook that does a lightweight review: did anything go wrong this session? It already stamps the session log. It could also scan for unresolved BLOCKED or DONE_WITH_CONCERNS reports and create a feedback entry if found.

This is lower priority than richer feedback entries — but it closes the coverage gap between "user signals a problem" and "problem is captured".

---

## Verdict

OpenSpace is doing the same thing at a different layer. They evolve task-execution skills (how to call a tool reliably). Fellowship evolves agent instruction files (how a companion reasons and responds). The mechanisms are analogous; the artifacts are different.

The most transferable insight is **evolution type diversity** — FIX is not the only improvement path. The most immediately actionable change is **richer feedback context** in the log entry. Everything else can wait.

The benchmark results (4.2× income, 46% token reduction) are not directly comparable — they're measuring economic output on professional tasks, not agent instruction quality. But the underlying principle is confirmed: accumulated skills from real failures produce measurable gains. Fellowship's autoimprove loop is on the right track. The gap is coverage and richness of input data, not methodology.
