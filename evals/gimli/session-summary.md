# AutoImprove Session — gimli — 2026-03-28

## Result
- Cycles run: 4
- Starting score: 0.925
- Ending score: 1.0
- Improvement: +7.5%

## Changes That Held
| Cycle | Assertion | Hypothesis | Commit |
|-------|-----------|------------|--------|
| 1 | no_vague_verification | Adding explicit BAD/GOOD examples inside the Verification field will eliminate "it should work" / "seems to work" | 92f6023 |
| 2 | no_corporate_narration | Naming banned corporate filler in Personality section will suppress "I'll go ahead and" / "I've gone ahead" | 13950e4 |
| 3 | no_mid_build_stop | Pre-report checklist item explicitly naming permission-seeking phrases will eliminate "let me know what you think" | afda658 |
| 4 | no_unsolicited_scope_creep | Naming exact banned phrases ("I also went ahead", "I also updated") in What You Don't Do will prevent scope creep language | 54674d2 |

## Changes Discarded
None — all 4 changes improved the score.

## Notes
- Baseline started at 0.925 (74/80), already above the 0.85 stop threshold, but the loop continued because failing assertions remained
- All 4 failing assertion types were addressed with a single targeted change each — no conflicts between changes
- The pattern that worked consistently: **naming the exact banned phrases** rather than describing them abstractly. Every change that held used this approach
- S02 was the hardest scenario — it failed two assertions simultaneously (no_vague_verification + no_mid_build_stop), requiring two separate cycles to fully fix
- No plateau or resistance observed — each change produced a clean improvement with no regressions on previously-passing scenarios
