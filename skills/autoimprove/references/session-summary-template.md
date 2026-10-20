# Session Summary Template

Template for `evals/<target>/session-summary.md`, written at Step 8.

```markdown
# AutoImprove Session — <target> — <date>

## Result
- Cycles run: <N>
- Starting score: <baseline overall>
- Ending score: <final overall>
- Improvement: +<delta>%

## Changes That Held
| Cycle | Assertion | Hypothesis | Commit |
|-------|-----------|------------|--------|
| <N> | <assertion_name> | <hypothesis> | <hash> |

## Changes Discarded
| Cycle | Assertion | Hypothesis | Reason |
|-------|-----------|------------|--------|
| <N> | <assertion_name> | <hypothesis> | no improvement |

## Notes
<Any observations about plateaus, conflicting changes, or assertions that proved resistant>
```

## Holdout block (if `holdout.jsonl` exists)

Run every holdout scenario through the agent (same method as Step 2). Calculate `holdout_hard_score`, `holdout_soft_score`, `holdout_overall` using the same formulas. **Do not use holdout results to drive any changes** — observation only.

```markdown
## Holdout Validation
- Holdout overall: <score>
- Training overall: <final overall>
- Generalization gap: <training − holdout> (>0.10 suggests overfitting to training scenarios)
```

A gap under 0.10 means the improvements generalized. A gap over 0.10 means the agent learned the specific training scenarios rather than the underlying behavior — flag this clearly.

## Assertion-health block

Before committing, append one entry per assertion to `evals/<target>/assertion-health.jsonl`. Use the final cycle's per-assertion results:

```json
{"assertion": "<name>", "type": "hard|soft", "passed": true|false, "session_date": "<YYYY-MM-DD>", "overall_at_session_end": <float>}
```

One line per assertion. Append — never overwrite. Include all hard assertions from `hard.py` and all soft assertions from `soft.md`.

Also append an **Assertion Health** section to the session summary:

```markdown
## Assertion Health

| Assertion | Type | This Session | Prior Sessions |
|-----------|------|-------------|----------------|
| <name> | hard | PASS | PASS (2 sessions) |
| <name> | soft | FAIL | FAIL (2 sessions) — persistent |
```

Annotate: "persistent" when an assertion failed in 2+ prior sessions; "regression" when it passed last session and fails now; "holding" when it passed in 3+ consecutive sessions.

## Commit

```bash
git add evals/<target>/session-summary.md evals/<target>/history.jsonl evals/<target>/assertion-health.jsonl
git commit -m "exp: session summary — <target> <date>"
```
