---
name: transcript-scan-noise-classes
description: Known false-positive classes in session-end transcript scanning (status-line regex) and which are guarded vs accepted
metadata:
  type: project
---

The SessionEnd transcript scan (`hooks/fellowship-session-end.mjs`, `scanTranscript`) matches `Status: <CODE>` lines and feeds both reconciliation and the scorecard ledger. Three noise classes exist:

1. **Pipe-form template lines** (`Status: DONE | DONE_WITH_CONCERNS | ...`) quoted in agent files — land in transcripts via Read tool_results. **Guarded** since the 2026-06-11 scorecard change: rest-of-line opening with `|` is skipped. The guard also hardened reconcile, which previously matched these.
2. **Bare example status lines** in docs/fixtures (non-piped). **Not guarded** — accepted v1 noise, documented in hooks/README.md.
3. **Verbatim quotes** of companion reports by the orchestrator near an artifact path → double-counted ledger rows. **Accepted v1 noise**, documented.

**Why:** scorecard ledger v1 is data capture only; its noise floor is a known product decision, not a bug. Reviews of future scan changes should check guards against class 1 regressions and not re-litigate classes 2-3.

**How to apply:** when reviewing changes to `scanTranscript`, the status regex, or a future ledger reader — verify the pipe guard survives, and expect the reader to skip unparseable lines (torn appends merge a torn line with the next append's first record).
