---
name: autoimprove
description: Use when an agent file shows recurring failures in a feedback log, or when running a scheduled improvement pass on a Fellowship companion. Autonomous improvement loop with baseline, cycles, and report phases against eval scenarios.
user-invocable: false
---

# AutoImprove — Agent Improvement Loop

You are running an autonomous improvement loop for a Fellowship agent. You operate entirely inside a git worktree. The live `agents/` directory is never touched. Every change is committed or reverted — nothing is lost.

**Read this file fully before starting. Then follow the 8-step loop exactly.**

---

## What to Improve Toward

Improvement cycles target process outcomes first: planted-defect catch rate, cycles-to-APPROVED, and validation-contract assertions missed. When competing failures are on the table, these outrank voice and register failures. Voice/register evals are a regression floor — a change that drops them gets reverted — not an optimization target. Do not spend cycles polishing register while process assertions still fail.

---

## Invocation Modes

The runner invokes you fresh for each phase. The mode is passed in the prompt as `Mode: <mode>`. Read it and act accordingly.

**`baseline`** — Run Step 2 only (invoke all scenarios, calculate baseline score, append cycle 0 entry to `evals/<target>/history.jsonl`). Do not proceed to Step 3. Exit when done.

**`cycle`** — Run Steps 3–6 only (find worst assertion, propose one change, evaluate, commit or revert, append to `history.jsonl`). Read `history.jsonl` first to understand current state and what has already been tried. Exit after one cycle — do not loop back to Step 3.

**`report`** — Run Step 8 only (write `session-summary.md`, run holdout validation, update `assertion-health.jsonl`, commit). Read `history.jsonl` and `evals/<target>/assertion-health.jsonl` for full session context before writing the summary.

If no mode is specified, run the full 8-step loop (legacy behavior).

---

**CRITICAL: Every action step requires actual tool use — not reasoning about it, not describing it.** File reads use the Read tool; file writes use Write/Edit; running Python and git use the Bash tool. Showing a command in your response is not the same as running it. Do not simulate responses internally — the same model that wrote the agent instructions also knows what "correct" looks like, so simulation is circular. Real invocations are required.

---

## Setup

Your working directory is a git worktree. All paths below are relative to it.

Files you will read and write:
- `agents/<target>.md` — the file being improved
- `evals/<target>/scenarios.jsonl` — training inputs (one JSON object per line)
- `evals/<target>/holdout.jsonl` — holdout inputs (read-only — never used during improvement, only at Step 8)
- `evals/<target>/hard.py` — deterministic assertions
- `evals/<target>/soft.md` — qualitative assertions (may not exist)
- `evals/<target>/history.jsonl` — cycle log (append each cycle)
- `evals/<target>/session-summary.md` — write at the end
- `evals/<target>/assertion-health.jsonl` — assertion health history across sessions (read at Step 1, append at Step 8; create if absent)

---

## The 8-Step Loop

### Step 1 — READ

Read all five files listed above for the target agent. If `soft.md` does not exist, note that — soft scoring is skipped for this agent.

Load `history.jsonl` to understand what has been tried before. Do not repeat discarded hypotheses.

If `evals/<target>/assertion-health.jsonl` exists, load it. Look for:
- **Persistent failures**: assertions that failed in 2+ previous sessions → treat as primary target this cycle, even if another assertion scores slightly worse today
- **Regression signals**: assertions that passed last session but fail now → flag in the session summary as "regression detected"
- **Stable fixes**: assertions passing in 3+ consecutive sessions → note in the summary as "holding"

If the file does not exist, skip this step — it will be created at Step 8.

---

### Step 2 — BASELINE

For each scenario in `scenarios.jsonl`: invoke the agent in a fresh `claude` subprocess, capture the response, run hard assertions against it, and (if `soft.md` exists) judge each soft assertion via Haiku. Record `{scenario_id, assertion_name, passed, response_preview}` for each assertion.

Full Python recipes for invocation and soft-assertion judging: see [`references/invocation-recipes.md`](references/invocation-recipes.md). Load before running baseline.

Calculate scores:
- `hard_score` = (assertions passing across all scenarios) / (total assertions × scenarios)
- `soft_score` = (soft assertions passing across all scenarios) / (total soft assertions × scenarios) — only if `soft.md` exists
- `overall`:
  - If `soft.md` exists: `(hard_score * 0.7) + (soft_score * 0.3)`
  - If no `soft.md`: `overall = hard_score`

Append baseline entry to `evals/<target>/history.jsonl`:

```json
{
  "run_id": "<ISO timestamp>",
  "cycle": 0,
  "hard_score": 0.00,
  "soft_score": null,
  "overall": 0.00,
  "top_failing_assertion": "<name>",
  "change_applied": "baseline",
  "hypothesis": "baseline — no change",
  "outcome": "baseline",
  "commit": null
}
```

---

### Step 3 — FIND TARGET

In `cycle` mode, run Steps 3–6 once and exit. Do not loop back to Step 3 after Step 6.

Look across all scenarios and all assertions. Which assertion fails most often?

That is the target for this cycle. If two assertions fail equally, pick the one with higher behavioral impact (format failures before voice failures).

---

### Step 4 — PROPOSE

Write ONE change to `agents/<target>.md` that directly addresses the failing assertion.

Rules:
- Change exactly ONE thing: one sentence, one example, one anti-pattern added, one rule clarified.
- Add a hypothesis comment directly above the change in the file:
  ```
  # hypothesis: [specific claim about what this change should fix]
  ```
- Do not change unrelated sections.
- Do not remove existing content unless it directly contradicts the fix.

When the runner spawns a separate "proposer" subprocess instead of having this loop edit directly, the proposer prompt lives in [`propose.md`](propose.md). It enforces these same rules and instructs the proposer to print the full modified agent file to stdout.

---

### Step 5 — EVALUATE

Re-run all scenarios against the changed version of `agents/<target>.md`. Calculate new `hard_score`, `soft_score`, and `overall` using the same method as Step 2 (same recipes in [`references/invocation-recipes.md`](references/invocation-recipes.md)).

---

### Step 6 — DECIDE

Compare new `overall` to the previous cycle's `overall`.

**If improved:**
Use the Bash tool to run:
```bash
git add agents/<target>.md evals/<target>/history.jsonl
git commit -m "exp: +N% <assertion_name> — <hypothesis summary>"
```
Where `N` is the percentage point improvement (e.g. `+7% no_survey_question — named example added`).

Append to `evals/<target>/history.jsonl`:
```json
{
  "run_id": "<ISO timestamp>",
  "cycle": <N>,
  "hard_score": <new>,
  "soft_score": <new or null>,
  "overall": <new>,
  "top_failing_assertion": "<name>",
  "change_applied": "<one-line description of what changed in the agent file>",
  "hypothesis": "<the hypothesis comment text>",
  "outcome": "kept",
  "commit": "<short git hash>"
}
```

**If worse or unchanged:**
Use the Bash tool to run:
```bash
git revert HEAD --no-edit
```
Append to `evals/<target>/history.jsonl`:
```json
{
  "run_id": "<ISO timestamp>",
  "cycle": <N>,
  "hard_score": <new>,
  "soft_score": <new or null>,
  "overall": <new>,
  "top_failing_assertion": "<name>",
  "change_applied": "<one-line description of what was tried>",
  "hypothesis": "<the hypothesis comment text>",
  "outcome": "discarded",
  "commit": null
}
```

---

### Step 7 — REPEAT

In `cycle` mode, skip this step entirely — the runner controls the loop. Exit after Step 6.

In full-loop mode (no mode specified): go back to Step 3. Stop when any of these is true:
- `overall` ≥ 0.85
- 25 cycles completed (or the `--cycles N` value passed by the runner)
- No failing assertions remain

---

### Step 8 — REPORT

Write `evals/<target>/session-summary.md` and (if `holdout.jsonl` exists) run holdout validation. Append per-assertion entries to `evals/<target>/assertion-health.jsonl`. Then commit.

Full template (result block, holdout block, assertion-health block, commit command): see [`references/session-summary-template.md`](references/session-summary-template.md).

When the runner spawns a separate "reporter" subprocess instead of having this loop write the summary directly, the reporter prompt lives in [`report.md`](report.md). It instructs the reporter to read `history.jsonl` and `assertion-health.jsonl`, run holdout validation, and write + commit the summary.

---

## Soft Assertion Judging (LLM-as-judge)

Use `claude-haiku-4-5` (or the fastest/cheapest available model) for soft assertions. Do not use a large model — these are simple binary judgments.

Soft assertions in `soft.md` are written as yes/no questions. A TRUE answer means the assertion passes. A FALSE answer means it fails. Parse the verdict from the **last non-empty line** of the output — not the whole response.

The brief reasoning step is not full chain-of-thought — it's a single explanatory sentence that aids debugging when an assertion fails unexpectedly. Do not ask for step-by-step reasoning; that increases token cost without improving accuracy for simple qualitative judgments.

Keep soft assertions simple. If an assertion requires aesthetic judgment or nuanced interpretation, it should not be in `soft.md`. The spec author already wrote them to be Haiku-compatible.

Full prompt template: see [`references/invocation-recipes.md`](references/invocation-recipes.md).

---

## Growing the Eval Suite from Real Usage

The synthetic scenarios in `scenarios.jsonl` are the starting point — not the ceiling. As Fellowship is used on real projects, failures get captured in `~/.claude/fellowship/feedback-log.jsonl`. Periodically, those entries should be converted into new scenarios and added to the relevant `scenarios.jsonl`.

The conversion process:
1. Review `~/.claude/fellowship/feedback-log.jsonl` — look for entries where `inferred: false` first (explicit reports are higher confidence)
2. For each entry worth converting: write a new scenario that recreates the failure context as a concrete input
3. If the failure is deterministic (the agent did something objectively wrong), add a corresponding assertion to `hard.py`
4. If the failure is behavioral (wrong tone, wrong routing, wrong register), add an assertion line to `soft.md`
5. Add the scenario to `scenarios.jsonl` — it becomes part of the permanent training set
6. Run autoimprove — the loop now improves against the real failure

The synthetic and real-project scenarios coexist in the same files and run through the same loop. The pipeline is identical — only the origin of the inputs changes over time.

Real usage may also reveal that an existing scenario was measuring the wrong thing — the assumed correct behavior turns out to be wrong in practice. In that case, update the scenario directly. Bad measurement is worse than inconsistent history. If you're making a scenario harder or more specific, add a new one instead. If you're correcting what "correct" means, update the existing one and note the reason in `history.jsonl`. Scenario adaptation is a human-only activity — the autoimprove loop never modifies `scenarios.jsonl`.

---

## Scoring Reference

| Situation | Formula |
|-----------|---------|
| `soft.md` exists | `(hard * 0.7) + (soft * 0.3)` |
| No `soft.md` | `overall = hard_score` |
| Target pass rate | ≥ 0.85 |

---

## Safety

- You are in a git worktree. The live project is not affected.
- Every cycle either commits or reverts. Nothing is left in limbo.
- `--dangerously-skip-permissions` was passed by the runner — you have full file access in this worktree.
- **Do not modify `evals/<target>/hard.py`, `evals/<target>/soft.md`, `evals/<target>/scenarios.jsonl`, or `evals/<target>/holdout.jsonl`.** These are the measurement tool, not the lever. The loop improves `agents/<target>.md` only.
- **Do not modify any file outside `agents/<target>.md` and `evals/<target>/`.** README, docs, other agents, other skills — all off-limits. If you find yourself editing anything else, stop and revert.
- Run assertions against `/tmp/fellowship_eval_<target>_hard.py` (the protected copy) — never the one in `evals/<target>/hard.py`, which could have been inadvertently changed.
- Do not read or modify files outside this worktree (except `/tmp/fellowship_eval_*` files placed there by the runner).
- Do not push to remote. The human reviews and merges in the morning.
