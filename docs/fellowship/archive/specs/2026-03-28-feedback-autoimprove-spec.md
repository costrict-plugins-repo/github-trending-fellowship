# Spec: Feedback Loop & AutoImprove Hardening

**Date:** 2026-03-28
**Status:** Draft
**Informed by:** OpenSpace analysis (`docs/fellowship/openspace-analysis.md`)

---

## Problem

Fellowship has two improvement mechanisms that don't yet talk to each other well.

**Feedback capture** (`~/.claude/fellowship/feedback-log.jsonl`) records when companions go wrong — but the entries are too thin to be useful without significant human reconstruction work. The failure summary is there; the context that would let you write a scenario is not.

**AutoImprove** (`evals/_runner/improve.sh`) runs an eval-driven improvement loop — but it has no memory between sessions. Every run starts blind: it knows what hypotheses to avoid (from `history.jsonl`), but it doesn't know which assertions are trending down, which gaps in the eval suite are most costly, or whether a fix that held in one session degraded in the next.

The two mechanisms are independent. The spec connects them.

---

## What This Spec Does Not Do

OpenSpace's post-execution analysis (analyzing every task execution automatically, from full conversation + tool trajectory recordings) is **not** in scope. That requires recording infrastructure Fellowship doesn't have and doesn't need at this stage.

OpenSpace's DERIVED and CAPTURED evolution types don't map onto Fellowship's artifacts cleanly — Fellowship evolves behavioral specifications, not executable scripts. They're not specced here.

The cloud skill community, SQLite lineage tracking, and tool degradation triggers are all OpenSpace-specific. Not relevant.

---

## Changes

### 1. Richer Feedback Entries

**File:** `agents/gandalf.md` (behavioral rule update)
**File:** `~/.claude/fellowship/feedback-log.jsonl` (format change)

#### Motivation

Current entries:
```json
{
  "agent": "gimli",
  "trigger": "attribution_question",
  "inferred": true,
  "failure": "Gimli added unspecified files outside task scope",
  "correction": "Stop at task boundary",
  "timestamp": "2026-03-28T..."
}
```

This is enough to know *that* something went wrong. It's not enough to write a scenario without reconstructing the exchange from memory. The context is in the conversation — Gandalf should capture it at the moment of logging, not leave it to be recovered later.

#### New Format

```json
{
  "agent": "gimli",
  "trigger": "attribution_question",
  "inferred": true,
  "failure": "Gimli added unspecified files outside task scope",
  "correction": "Stop at task boundary — don't touch files not named in the task",
  "no_scenario": true,
  "context": {
    "user_input": "fix the typo in the button label",
    "agent_response_snippet": "I also noticed the adjacent component had the same issue so I fixed both..."
  },
  "timestamp": "2026-03-28T..."
}
```

New fields:
- **`context.user_input`** — the user's message that led to the companion action being logged. Verbatim, truncated to 300 chars if long.
- **`context.agent_response_snippet`** — the most relevant portion of the companion's response that illustrates the failure. The phrase or sentence that crossed the line, not the full response. 200 chars max.
- **`no_scenario`** — `true` if Gandalf judges that no existing scenario covers this failure pattern. `false` or omitted if an existing scenario already tests this. See Change 3.

#### Behavioral Rule Update (gandalf.md)

The feedback capture rule gains two additions:

```
When writing a feedback entry:
- Include context.user_input: the user's message that preceded the failure. Exact quote, max 300 chars.
- Include context.agent_response_snippet: the specific phrase or action that was wrong. Not the full response — the key line. Max 200 chars.
- Both fields are required. If either is unavailable (e.g. failure inferred from outcome, not a specific phrase), write what you can and note "unavailable" for the missing field.
```

---

### 2. Inferred Failure Confirmation

**File:** `agents/gandalf.md` (behavioral rule update)

#### Motivation

When the trigger is `explicit_report`, the failure is clear — the user named it. When the trigger is `attribution_question` and `inferred: true`, Gandalf is interpreting the failure from context. This is higher risk: a frustrated question ("why did Gimli touch that file?") might be about curiosity, not a genuine failure.

OpenSpace does a confirmation step before rule-based triggers fire: "is this actually worth evolving?" Fellowship needs the same gate for inferred failures.

#### Rule

Before writing an inferred failure to the log, Gandalf applies a one-question self-check:

> *Did the companion do something objectively contrary to its instructions — or is this ambiguous, external, or a user preference that isn't in the spec?*

- **Objectively wrong** (scope creep, wrong voice, wrong routing, incorrect report format) → log it
- **Ambiguous or external** (tool failure, missing context, unclear task) → don't log; if the user seems genuinely frustrated, ask one clarifying question instead
- **User preference drift** (user wants something the spec doesn't require) → don't log as a failure; note the preference separately if it seems stable

The self-check is silent — no announcement, no "I'm checking whether to log this." It's a half-second judgment before writing, not a conversational step.

---

### 3. Scenario Gap Flagging

**File:** `agents/gandalf.md` (behavioral rule update)
**Files:** `evals/gimli/scenarios.jsonl`, `evals/legolas/scenarios.jsonl`, `evals/gandalf/scenarios.jsonl` (reference only — Gandalf reads, doesn't write)

#### Motivation

Not all feedback entries are equal. An entry describing a failure pattern already covered by an existing scenario adds little value to autoimprove — the loop already tests for it. An entry describing a gap — a failure pattern no scenario touches — is the highest-value input for scenario expansion.

Without a flag, a human reviewing the feedback log must read every entry and cross-reference the scenario files manually. That friction means it doesn't happen.

#### Rule

When writing a feedback entry, Gandalf checks the relevant `evals/<agent>/scenarios.jsonl` file. The check is lightweight: does any existing scenario's `input` or `context` describe roughly the same failure mode?

- **No match found** → `"no_scenario": true`
- **Match found** → `"no_scenario": false` (or omit the field)

The flag doesn't mean "create a scenario now." It means "this entry is a priority candidate when a human next reviews the feedback log."

#### Scenario Conversion Process (human step, documented here for completeness)

When reviewing `~/.claude/fellowship/feedback-log.jsonl`:

1. Filter for `"no_scenario": true` entries — these are the gaps
2. For each: write a new `scenarios.jsonl` entry that recreates the failure as a concrete input
3. If the failure is deterministic (agent did something objectively wrong), add an assertion to `hard.py`
4. If the failure is behavioral (wrong tone, wrong routing, wrong register), add a line to `soft.md`
5. Run `./evals/_runner/improve.sh <agent> --cycles 15` — the loop now improves against the real failure

This process is already documented in `skills/autoimprove/SKILL.md` under "Growing the Eval Suite from Real Usage." The `no_scenario` flag is the mechanism that makes step 1 fast.

---

### 4. Assertion Health Tracking

**File:** `skills/autoimprove/SKILL.md` (Step 8 addition)
**New files:** `evals/<target>/assertion-health.jsonl` (one per agent, written by autoimprove)

#### Motivation

AutoImprove's `history.jsonl` records what changed each cycle. It does not record which assertions passed or failed in isolation across sessions. The current loop reads history to avoid repeating discarded hypotheses — but it has no signal for *which assertions are trending down* since a previous session or *which fixes are holding*.

An assertion that passes in cycle 1 and fails in cycle 8 indicates regression. An assertion that consistently fails across three separate sessions despite two attempted fixes needs a different approach, not another FIX cycle.

#### Format

`evals/<target>/assertion-health.jsonl` — one entry per assertion per session, appended at session end (Step 8):

```json
{"assertion": "no_survey_question", "type": "soft", "passed": true, "session_date": "2026-03-28", "overall_at_session_end": 0.91}
{"assertion": "status_line_present", "type": "hard", "passed": true, "session_date": "2026-03-28", "overall_at_session_end": 0.91}
{"assertion": "no_vague_verification", "type": "hard", "passed": false, "session_date": "2026-03-28", "overall_at_session_end": 0.91}
```

Fields:
- **`assertion`** — the assertion name (from `hard.py` or `soft.md`)
- **`type`** — `"hard"` or `"soft"`
- **`passed`** — boolean, based on final cycle's results
- **`session_date`** — ISO date of the session
- **`overall_at_session_end`** — the session's final overall score (for context)

#### Step 2 Integration (reading health data)

At the start of each new session, before establishing baseline, autoimprove reads `assertion-health.jsonl` if it exists. It looks for:

- **Persistent failures**: assertions that failed in 2+ previous sessions → treat as the primary target even if another assertion has a slightly lower score this cycle
- **Regression signals**: assertions that passed in the most recent session but fail now → flag in the session summary as "regression detected"
- **Stable fixes**: assertions that have passed in 3+ consecutive sessions → note in the summary as "holding"

This is read-only at Step 2. The loop still targets the worst-failing assertion per the normal scoring — but the health history breaks ties and adds context to the session summary.

#### Session Summary Addition

Append to the session summary's ## Notes section:

```markdown
## Assertion Health

| Assertion | Type | This Session | Prior Sessions |
|-----------|------|-------------|----------------|
| no_survey_question | soft | PASS | PASS (2 sessions) |
| status_line_present | hard | PASS | PASS (1 session) |
| no_vague_verification | hard | FAIL | FAIL (2 sessions) — persistent |
```

A "persistent" annotation when an assertion has failed in 2+ sessions. A "regression" annotation when it passed last session and fails this one.

---

## Implementation Order

These are independent changes. No dependency between them.

| Change | Effort | Value | Build first? |
|--------|--------|-------|-------------|
| Richer feedback entries | Low — format change + gandalf.md rule | High — directly enables scenario creation | Yes |
| Inferred failure confirmation | Low — one behavioral rule | Medium — reduces noise in the log | Yes, same pass |
| Scenario gap flagging | Low — gandalf.md + one read per log entry | High — makes review fast | Yes, same pass |
| Assertion health tracking | Medium — SKILL.md update + new file format | Medium — improves targeting across sessions | Second pass |

Changes 1–3 are one Gimli task: update `agents/gandalf.md`. Change 4 is a separate Gimli task: update `skills/autoimprove/SKILL.md`.

---

## What This Does Not Change

- The 8-step autoimprove loop structure — unchanged
- The Sonnet/Haiku model split — unchanged
- The holdout.jsonl validation — unchanged
- The feedback trigger conditions (explicit report OR attribution question) — unchanged
- The scenario files themselves — not modified by the loop, only by humans
