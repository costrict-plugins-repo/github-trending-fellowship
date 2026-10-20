# Dual-Mode Architecture & Tier Scoring — Design Spec

**Date:** 2026-03-23
**Status:** Approved — implementation plan at `docs/fellowship/plans/2026-03-23-core-solidification.md`
**Goal:** Add objective Tier scoring to task classification, and support both subagent and Agent Teams execution modes with Teams reserved for Tier 4.

---

## Problem

Two gaps in the current orchestration:

1. **Tier classification is subjective.** Gandalf assigns Tiers 1-4 based on judgment with no anchors. The same task could be classified differently across sessions. There's no vocabulary for explaining *why* a task is a certain tier.

2. **No Agent Teams support.** All companion dispatch uses subagents (sequential, report-back-to-Gandalf). Tier 4 tasks that involve parallel, independent work streams have no coordination model beyond "dispatch multiple subagents and wait."

---

## Part 1: Tier Scoring System

### Signals

Signals are characteristics of a task that push the classification up or down. Gandalf evaluates these before classifying.

**Signals that push UP (toward higher tiers):**

| Signal | Score | Examples |
|--------|-------|---------|
| Multiple files affected | +2 | Feature spanning 3+ files |
| Touches critical path (auth, payments, data mutations, public APIs) | +3 | Auth middleware, payment webhook, database migration |
| Cross-domain (frontend + backend, or code + infrastructure) | +2 | API route + UI component + database schema |
| New feature (not fix/tweak) | +2 | New page, new API, new workflow |
| Complex logic / many edge cases | +2 | State machine, data transformation pipeline |
| User signals thoroughness ("careful", "thorough", "review this") | +2 | Explicit quality request |
| Spec exists with multiple requirements | +1 | Written plan with 5+ tasks |

**Signals that push DOWN (toward lower tiers):**

| Signal | Score | Examples |
|--------|-------|---------|
| Single file | -2 | One component, one config file |
| Config / copy / styling only | -3 | Tailwind classes, env var, button text |
| Clear fix with known solution | -2 | Bug with obvious cause, documented pattern |
| User signals speed ("quick", "just", "simple") | -2 | "just fix the typo" |
| Similar work done recently (pattern exists) | -1 | Second API endpoint following established pattern |
| No tests needed (pure cosmetic) | -1 | Color change, spacing adjustment |

### Thresholds

| Score | Tier | Mode | What happens |
|-------|------|------|-------------|
| <= 0 | **Tier 1 — Direct** | Gandalf handles | No agents. Quick fix, question, brainstorm, simple edit. |
| 1-3 | **Tier 2 — One specialist** | One subagent | Load a skill or dispatch one companion. |
| 4-6 | **Tier 3 — Sequential chain** | Multiple subagents | Plan first. Gimli -> Legolas -> Pippin cycle. |
| >= 7 | **Tier 4 — Parallel / Teams** | Subagents or Agent Teams | Plan first. Parallel branches. Teams mode when enabled and beneficial. |

### How Gandalf uses scoring

Scoring is **a reasoning aid, not a formula.** Gandalf evaluates signals mentally and arrives at a tier. He doesn't need to write out the math every time — but when explaining a classification to the user, he can reference specific signals:

> "This is Tier 3 — multiple files (+2), touches auth (+3), new feature (+2) gives us 7, but there's an established pattern to follow (-1) so we're at 6. Sequential chain: Gimli builds, Legolas reviews."

For borderline cases (score near a threshold), Gandalf uses judgment to break the tie. **Always err toward the lower tier** — a solo dev's time is precious.

### What scoring does NOT do

- Replace judgment — it anchors it
- Require calculation in every response — just when classification matters
- Apply to user-overridden tiers — if the user says "just do it quick," that's Tier 1 regardless of signals

---

## Part 2: Dual-Mode Execution

### Architecture

The plugin supports two execution modes for companion dispatch. Mode selection is based on Tier classification and feature availability.

```
Tier 1-2: Gandalf handles directly or dispatches one subagent
Tier 3:   Sequential subagent chain (current model, unchanged)
Tier 4:   Agent Teams (when enabled) OR parallel subagents (fallback)
```

### Mode: Subagent (default, all tiers)

Current model. Gandalf dispatches companions via `Agent()`. They execute, report back with structured status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED). Gandalf coordinates handoffs.

**Characteristics:**
- Sequential or parallel dispatch (parallel = `run_in_background: true`)
- Companions report only to Gandalf
- Lower token cost
- Gandalf maintains full visibility and control

### Mode: Agent Teams (Tier 4, opt-in)

Uses Claude Code's experimental Agent Teams feature. Gandalf acts as team lead. Companions become teammates that coordinate via shared task list and direct messaging.

**Characteristics:**
- Teammates communicate directly (Legolas can message Gimli without Gandalf relaying)
- Shared task list with dependency tracking and self-claiming
- Higher token cost (each teammate = separate Claude instance)
- Gandalf as lead: decomposes work, assigns file ownership, synthesizes results

**When Teams mode activates:**
1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is set to `1`
2. Task is classified as Tier 4
3. Task has genuinely independent parallel work streams

If any condition is false, fall back to parallel subagents.

### Agent dual-mode communication

Each companion's agent definition includes a COMMUNICATION MODE section:

```markdown
## Communication Mode

**Teammate mode** (Agent Teams): Communicate with other teammates via
SendMessage for coordination. Write substantial output to files. Send
brief completion message to the lead when done. Never call TeamCreate.

**Subagent mode** (default): Report back to Gandalf using the standard
reporting protocol (Status, What was built, Files changed, Verification,
Concerns).
```

The companion doesn't need to check which mode it's in — the context makes it clear. If spawned with `team_name` parameter, it's a teammate. Otherwise, it's a subagent.

### Gandalf's team-lead behavior

When operating in Teams mode, Gandalf's orchestration changes:

1. **Task decomposition with file ownership** — each teammate gets exclusive file boundaries. No two teammates touch the same file.
2. **Interface contracts first** — if teammates share boundaries (e.g., Gimli builds API, another instance builds frontend), define the contract (types, response shapes) before spawning.
3. **Spawn teammates** — `Agent(team_name="...", subagent_type="fellowship:gimli", prompt="...")`
4. **Monitor via task list** — teammates claim and complete tasks. Gandalf checks progress, redirects if needed.
5. **Synthesize results** — when all teammates complete, Gandalf reviews the combined output.
6. **Cleanup** — shut down teammates, clean up team resources.

### Teams mode use cases for Fellowship

| Scenario | Team composition | Why Teams helps |
|----------|-----------------|----------------|
| **Parallel review** | Legolas (code quality) + Boromir (security) | Two review dimensions simultaneously, findings don't overlap |
| **Cross-layer feature** | Gimli (backend) + Gimli (frontend) | File ownership boundaries, parallel build |
| **Research sprint** | Sam x3 (different questions) | Parallel web research, findings shared |
| **Full feature cycle** | Gimli (build) + Legolas (review) + Pippin (test) | Review can start on early files while Gimli builds later ones |

### What changes per file

| File | Change |
|------|--------|
| `skills/orchestration/SKILL.md` | Add Tier scoring signals + thresholds. Add Teams mode section with team-lead behavior. |
| `agents/gandalf.md` | Add note about dual-mode support in description. |
| `agents/gimli.md` | Add COMMUNICATION MODE section. |
| `agents/legolas.md` | Add COMMUNICATION MODE section. |
| `agents/pippin.md` | Add COMMUNICATION MODE section. |
| Future agents | Include COMMUNICATION MODE section from the start. |

### What does NOT change

- Agent skills (code-review, testing, engineering) — mode-independent
- Hook system — no new hooks needed for MVP (quality gate hooks are a future enhancement)
- Plugin manifest — no structural changes
- Subagent dispatch for Tier 1-3 — completely unchanged

---

## Implementation Plan

### Phase 1: Tier scoring (can ship independently)
1. Update `skills/orchestration/SKILL.md` with scoring signals and thresholds
2. Test: Gandalf classifies 5 sample tasks and explains scoring

### Phase 2: Dual-mode agent definitions
1. Add COMMUNICATION MODE section to all active agent files (gimli, legolas, pippin)
2. Update `agents/gandalf.md` description to mention team-lead capability
3. Test: Agents work identically in subagent mode (no regression)

### Phase 3: Orchestration skill Teams section
1. Add Teams mode section to `skills/orchestration/SKILL.md`
2. Cover: when to use, team-lead behavior, file ownership, spawn pattern, cleanup
3. Test: Gandalf can explain when it would use Teams vs subagents

### Phase 4: Live Teams test (requires feature flag)
1. Enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
2. Run a Tier 4 task with actual Teams mode
3. Document findings, adjust orchestration guidance

---

## Reference implementations

- **barkain/workflow-orchestration** — dual-mode with scoring (`examples/barkain-workflow/`). Key files: `CLAUDE.md` (architecture), agent files (COMMUNICATION MODE sections).
- **wshobson/agents** — Teams-focused plugin (`examples/wshobson-agents/plugins/agent-teams/`). Key files: `README.md`, skills (`team-composition-patterns`, `task-coordination-strategies`).
- **Superpowers** — subagent-only, but strong verification and review patterns (`examples/superpowers/`).

See `docs/fellowship/reference-implementations.md` for full analysis.

---

## Part 3: Model Routing per Companion

### Principle

Keep `model: inherit` as the default in all agent definitions. Gandalf chooses the model per-dispatch based on task complexity, not static config. This ties to Tier scoring — lower-tier dispatches use cheaper/faster models, higher-tier dispatches inherit the user's model.

### Routing guidance

| Companion | Default model | When to use opus/inherit | When to use sonnet |
|-----------|--------------|--------------------------|-------------------|
| **Gimli** | inherit | New features, critical paths, complex logic | Simple fixes, config changes, following established patterns |
| **Legolas** | sonnet | Reviewing complex architecture decisions | Standard code review (most dispatches) |
| **Pippin** | sonnet | Complex test infrastructure setup | Writing tests from specs (most dispatches) |
| **Merry** | inherit | Always — architecture decisions need strong reasoning | — |
| **Aragorn** | inherit | Always — product strategy needs nuance | — |
| **Boromir** | sonnet | Novel security concerns | OWASP checklist audits (most dispatches) |
| **Sam** | sonnet | — | Research is breadth, not depth (all dispatches) |
| **Arwen** | sonnet | Complex design system decisions | Design audits, a11y checks (most dispatches) |
| **Bilbo** | sonnet | — | Copy polish (all dispatches) |

**Pattern:** Companions that follow checklists and structured protocols run on sonnet. Companions that make judgment calls inherit the user's model.

### Implementation

Gandalf uses the `model` parameter at dispatch time:
```
Agent(fellowship:pippin, model: "sonnet")
```

No changes to agent frontmatter needed. The orchestration skill documents the routing guidance.

---

## Part 4: Agent Color Coding

Add a `color` field to each agent's frontmatter for visual distinction in Teams mode tmux panes.

| Companion | Color | Rationale |
|-----------|-------|-----------|
| **Gandalf** | — | Lead session, default color |
| **Gimli** | red | Builder, action |
| **Legolas** | green | Reviewer, approval |
| **Pippin** | yellow | Testing, caution |
| **Merry** | blue | Architecture, planning |
| **Aragorn** | magenta | Product, strategy |
| **Boromir** | red | Security, warnings |
| **Sam** | cyan | Research, exploration |
| **Arwen** | magenta | Design, creativity |
| **Bilbo** | cyan | Writing, communication |

Added to agent frontmatter as:
```yaml
---
name: gimli
color: red
---
```

No functional impact in subagent mode — only visible in Teams mode split panes.

---

## Open questions

1. **Should Gandalf log tier scores?** Even informally — "Tier 3 (score: 5)" in the quest log — to build a record of classification decisions we can review later.
2. **Teams mode hooks?** `TaskCompleted` hook for verification gates, `TeammateIdle` for reassignment. Valuable but not needed for MVP.
3. **Direct mode interaction during Teams?** If Gandalf is running a team and the user wants to talk to Arwen directly in another terminal, does that create conflicts? Probably not — they'd be separate sessions — but worth considering.
