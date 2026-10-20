# Quest Log Format

The quest log carries decisions and commitments — not work history. One section, one line per entry, dated.

```markdown
# Quest Log

**Last updated:** YYYY-MM-DD

## Open

Decisions and commitments that survive across sessions. One line per entry, dated.

- [ ] [Decision or commitment] — [why it stays, what unblocks closing it] (YYYY-MM-DD)
- [x] [Completed decision — leave for ~7 days as a recent-decisions trace, then prune] (YYYY-MM-DD)
```

## Rule: decisions in, commits out

- **In:** scope decisions, architectural choices, deferred work, things a future contributor would want to know that the diff won't tell them. The reasoning lives outside the diff — record it.
- **Out:** typos, obvious bug fixes, routine refactors. `git log` is the record for work where the commit message tells the full story.

## Pruning

Completed `- [x]` entries linger for about a week so a session two days later can still see them. Older completed entries move to `quest-log-archive.md` under a `## Archived YYYY-MM-DD` heading. Open entries (`- [ ]`) stay as long as the commitment stands — close them when the decision is reversed, executed, or no longer relevant.

## Historical structure (retired 2026-05-12)

Earlier versions used four sections — `## Current`, `## Up Next`, `## Recently Completed`, `## What Exists`. They were retired because:

- `## Recently Completed` duplicated `git log`.
- `## What Exists` duplicated `docs/fellowship/codebase-map.md`.
- The discipline rule for writing entries (the old "update silently when a step completes") was being skipped silently in practice.

The single `## Open` section is what survived the cut. The automated consolidator was retired alongside the structure — there is nothing to trim now that completed work goes to `git log` and the structural snapshot to `codebase-map.md`.
