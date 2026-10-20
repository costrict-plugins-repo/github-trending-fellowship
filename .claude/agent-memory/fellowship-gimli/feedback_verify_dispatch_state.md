---
name: verify-dispatch-state
description: Quest-log dispatch lines in this repo can lag disk by a full release — verify on-disk state and git log before building
metadata:
  type: feedback
---

Before building from a quest-log dispatch line, verify the on-disk state first — `wc -l` the targets and `git log` the paths.

**Why:** The v1.1 skill-bloat dispatch (2026-06-11) described accessibility/SKILL.md as ~906 lines with ~580 lines of inline content. On disk it was 76 lines — the de-inline had already landed in commit `a179898` ("audit-driven cleanup"), and the quest-log line had been re-confirmed twice without checking disk. Of three dispatched tasks, only one paragraph of work remained. Recurred same day: the agent-file de-inlining quest cited the 2026-04-26 audit (bilbo 353, pippin 330 lines, "6 of 9 carry inline templates"); on disk bilbo was 177 and every template already pointed at `agents/references/` — Cut 1 of three had fully landed in an intervening pass.

**How to apply:** When a dispatch cites an audit or spec with line counts or structural claims, check current state before writing a plan. If disk is ahead of the dispatch, report the delta plainly and do only the remaining work — do not redo or "improve" what already landed.
