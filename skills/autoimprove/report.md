Write a session summary for an AutoImprove run.

Target agent: {agent}
Date: {date}
History: (read evals/{agent}/history.jsonl)
Assertion health: (read evals/{agent}/assertion-health.jsonl if it exists)

Write evals/{agent}/session-summary.md in this format:
# AutoImprove Session — {agent} — {date}

## Result
- Cycles run: N
- Starting score: X
- Ending score: Y
- Improvement: +Z%

## Changes That Held
| Cycle | Assertion | Hypothesis | Commit |

## Changes Discarded
| Cycle | Assertion | Hypothesis | Reason |

## Holdout Validation
Run holdout scenarios from evals/{agent}/holdout.jsonl using the same subprocess pattern.
Calculate holdout_overall. Report generalization gap (training − holdout). Flag if > 0.10.

## Assertion Health
For each assertion in the final run: was it passing or failing?
Compare to evals/{agent}/assertion-health.jsonl history. Annotate: persistent / regression / holding.
Append one entry per assertion to evals/{agent}/assertion-health.jsonl.

## Notes
Any observations about plateaus, resistant assertions, or patterns.

After writing the summary, commit:
git add evals/{agent}/session-summary.md evals/{agent}/history.jsonl evals/{agent}/assertion-health.jsonl
git commit -m "exp: session summary — {agent} {date}"
