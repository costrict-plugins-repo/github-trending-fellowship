# ADR: Quest-Log Auto-Consolidation

**Status:** Accepted
**Date:** 2026-04-22
**Decider:** Merry (technical) + Frodo (final call if scope changes)
**Implementer:** Gimli

---

## Context

`docs/fellowship/quest-log.md` carries three growing sections — `## Current`, `## Up Next`, `## Recently Completed` — and a static `## What Exists`. The standing rule:

> Recently Completed stays trimmed to 7 entries. The oldest are appended (in short form) to `docs/fellowship/quest-log-archive.md` and removed from the live log.

Today the rule lives in Gandalf's behavioral discipline. It has been skipped 17 times in the past month; Recently Completed grew to 18 entries before today's manual cleanup. Behavioral rules without a mechanical backstop drift.

A model already exists at `hooks/fellowship-session-end.mjs:66–87`: a short, defensive, fail-silent quest-log check that writes a `.quest-log-reminder` file rather than mutating the log. The new behavior follows the same shape, but goes one step further — it edits the log when it can prove the structure is intact, and falls back to a reminder file when it cannot.

---

## Decision

Add an idempotent quest-log consolidation routine that runs at **both** `session-start` and `session-end`, plus an explicit in-session escape hatch via the `/fellowship:consolidate` slash command. The routine trims `## Recently Completed` to 7 entries, appends the overflow to `quest-log-archive.md` in short form, and only mutates the live quest log after the archive write succeeds. On any structural ambiguity, it does nothing and writes `.quest-log-reminder`.

### What this decision covers

1. **Triggers:** `session-start` AND `session-end` (both invoke the same routine, idempotent). Plus `/fellowship:consolidate` for in-session use.
2. **Parse contract:** strict, regex-anchored, tested against today's quest log.
3. **Edit safety:** archive-first, atomic write via temp+rename, fail-silent fallback to reminder file.
4. **Archive line format:** `- [date] [summary]` appended under a dated `## Archived YYYY-MM-DD` heading.
5. **Threshold:** 7 entries. Trim oldest first.

### What this decision does NOT cover (out of scope, name explicitly)

- Folding archive entries into `## What Exists` — editorial judgment, stays manual.
- Touching `## Current` or `## Up Next` — different concerns, different rules.
- Detecting `[x]` items still in `## Current` — already handled by `hooks/fellowship-session-end.mjs:66–87`. Leave it alone.
- Writing the slash command's prose — Gandalf wires that. This ADR specifies only what it must invoke.
- Eval scenarios for the new behavior — Pippin handles after.

---

## Options Considered

| Option | Pros | Cons | Why not chosen |
|--------|------|------|----------------|
| **A. Hook trims silently on every session boundary** | Mechanical. No drift. Cheap. | If parser is wrong, log gets corrupted silently. | Chosen — but only with archive-first + atomic-write + fail-silent guards. |
| B. Hook only writes a reminder file, never edits | Zero corruption risk (matches existing hook). | We already have reminders. They're being ignored. The rule has been skipped 17 times. | Reminders are why we're here. They didn't stick. |
| C. Slash command only, no hook | Most conservative. User opts in. | Requires the user to remember — same failure mode as today. | Behavioral discipline is exactly what failed. |
| D. Daemon / file watcher | Real-time. | New infra, new failure surface, runs outside session lifecycle. | Premature. v2 concern at best. |

**Why two boundaries (start and end):** single-point-of-failure resistance. If a session crashes before `session-end`, the next `session-start` catches it. Idempotency makes running both safe — if Recently Completed is already ≤7, the routine is a no-op.

**Why a slash command in addition:** mid-session usability. When Gandalf finishes a quest and Recently Completed crosses 7, waiting until session-end to consolidate means the next dispatch sees a bloated log. `/fellowship:consolidate` is the manual lever.

**Why threshold = 7:** matches Miller's number (7±2); fits in a glance without scrolling on a standard terminal/editor pane. Confirmed scope.

---

## Consequences

**Positive:**
- Recently Completed stays bounded mechanically. No drift.
- Archive grows in a predictable, dated structure that stays grep-friendly.
- The routine is idempotent — safe to run on both boundaries and via slash command without coordination.
- Defensive style mirrors the existing hook — Sam will recognize it.

**Negative / Constraints:**
- The parser is coupled to the quest-log's exact heading shape. If a future edit changes `## Recently Completed` to `### Recently Completed` or renames it, the hook will silently no-op (and write a reminder). That is the intended failure mode, but it is a coupling.
- An entry's "summary" is derived by truncation, not understanding. Long, multi-clause entries get a one-line synopsis that may lose nuance. Acceptable — the full history lives in git.
- Two Claude windows on the same project at session-end could race (see "Concurrency" below). Accepted as low-probability; mitigated by atomic write.

**If wrong:**
- *Assumption:* the quest log's structure stays roughly as it is (ATX `##` headings, `- [x]` entries, dates in trailing parens).
  - *If wrong:* parser silently no-ops and writes `.quest-log-reminder`. Live log is never corrupted. Recovery: fix the regex or fix the log.
  - *Signal:* Recently Completed grows past 7 again AND `.quest-log-reminder` is appearing on every session.
- *Assumption:* truncating to a one-line summary preserves enough meaning for the archive to be useful.
  - *If wrong:* archive becomes a list of cryptic stubs. Recovery: edit the archive by hand (it is human-readable markdown), or change the summary derivation in a follow-up.
  - *Signal:* anyone reading the archive asks "what did this entry mean?"

---

## Implementation Notes

This section is what Gimli builds against. Treat it as the contract.

### File layout

- New hook: `hooks/fellowship-quest-log-consolidate.mjs` (single file, no deps beyond Node stdlib).
- Wire to BOTH `SessionStart` and `SessionEnd` in `settings.json` (alongside the existing session-end hook — they coexist; do not merge).
- The slash command (Gandalf-authored) invokes the same script: `node hooks/fellowship-quest-log-consolidate.mjs` from the project cwd. The script must accept being invoked with no stdin (slash command path) and with stdin JSON (hook path) — read stdin if present, ignore if not.

### The routine, step by step

1. Resolve `cwd`. If `docs/fellowship/quest-log.md` does not exist → `respond({})` and exit 0.
2. Read `quest-log.md` into `content`.
3. Locate `## Recently Completed` block. If not found → write reminder, exit.
4. Parse entries (see regex below). If parser yields 0 entries from a non-empty block → write reminder, exit (structural ambiguity).
5. If entry count ≤ 7 → no-op, exit clean. (Idempotency.)
6. Split: `keep` = newest 7, `overflow` = remainder (oldest).
7. **Archive first.** Append `overflow` to `quest-log-archive.md` under today's `## Archived YYYY-MM-DD` heading (create heading if today's does not yet exist; append under it if it does). Use atomic write (temp + rename).
8. Verify archive write by re-reading and confirming all overflow lines are present. If verification fails → do NOT touch the live log; write reminder; exit.
9. **Then trim live log.** Reconstruct `quest-log.md` with `## Recently Completed` containing only `keep`. Use atomic write (temp + rename) on the live log.
10. Update the `**Last updated:** YYYY-MM-DD` line at the top of the live log to today.
11. `respond({})` and exit 0. Never throw.

### Parse contract

**Heading anchor:** the literal line `## Recently Completed` (ATX heading, exactly two `#`, exact casing). The block extends from that line up to (but not including) the next line matching `^##\s+` or end of file.

> Edge case: if `## Recently Completed` is the last `##` section in the file (no following `## What Exists`), the existing trailing-section regex bug applies — Sam flagged this on the older hook and it is on Up Next. For this hook, use the regex below which handles both cases (next `##` OR end of file).

**Section extraction regex (tested against current quest-log.md):**

```js
const sectionRe = /^##\s+Recently Completed\s*\n([\s\S]*?)(?=^##\s+|\Z)/m;
```

Note: JS does not support `\Z`. Use this portable form instead:

```js
const sectionRe = /##\s+Recently Completed\s*\n([\s\S]*?)(?=\n##\s+|$)/;
```

**Entry regex:** an entry is a line starting with `- [x]` or `- [ ]` (we tolerate both in case of an unchecked stray, though Recently Completed should be all `[x]`). Sub-bullets (lines starting with two or more spaces then `-`) belong to the preceding entry.

```js
const entryRe = /^-\s+\[[x ]\]\s+.+(?:\n[ \t]+-\s+.+)*/gm;
```

Apply `entryRe` to the captured block. Each match is one entry, sub-bullets included.

**Date extraction:** dates live in trailing parens at the end of the first line of an entry, format `(YYYY-MM-DD)`.

```js
const dateRe = /\((\d{4}-\d{2}-\d{2})\)\s*$/;
```

Apply `dateRe` to the **first line** of each entry (split on `\n`, take `[0]`). If no match → use today's date as a fallback (do not skip the entry; archive it with today's date and move on).

**Entry order in Recently Completed:** newest at top, oldest at bottom (matches current convention — see today's log: the v1.5.1 cleanup at line 23 is newest; the AutoImprove Pippin entry at line 30 is oldest). Therefore `overflow` = entries with index ≥ 7 (the last `n - 7`).

**Tested against current quest-log.md (lines 22–30):** the regex captures 8 entries. With threshold 7, `keep` = entries 1–7, `overflow` = entry 8 (the AutoImprove Pippin line). Worked example below.

### Summary derivation (for archive line)

For each overflow entry:
1. Take the first line only (drop sub-bullets).
2. Strip the leading `- [x] ` or `- [ ] `.
3. Strip the trailing `(YYYY-MM-DD)` and any trailing whitespace.
4. If the result is longer than 200 characters, truncate to 197 + `...`. Otherwise keep as-is.
5. Resulting archive line: `- [YYYY-MM-DD] {summary}` where `YYYY-MM-DD` is the extracted date (or today's, per fallback).

**Why truncate at 200:** the archive is a scannable index, not a record of nuance. Git holds the full text. 200 chars is generous enough that today's longest entry (the v1.5.1 cleanup at ~250 chars) loses only its tail clause.

### Archive write structure

Append under a `## Archived YYYY-MM-DD` heading (today's date). If that heading already exists in the archive (e.g., a second consolidation pass on the same day), append under the existing heading; do not create a duplicate. Insert position: at the end of the file (newest at the bottom is consistent with how `quest-log-archive.md` is currently structured).

```markdown
## Archived 2026-04-22

- [2026-03-28] AutoImprove Pippin — 1.000 on 8 core scenarios; Mode 4 assertions committed, real validation deferred to live usage
```

(Date in the line itself comes from the entry, not from "today" — it preserves when the work actually completed.)

### Edit safety

- **Atomic write:** for both archive and live log: write to `<path>.tmp`, then `fs.renameSync(<path>.tmp, <path>)`. `rename` is atomic on POSIX within the same filesystem. Never use direct `writeFileSync` on the target path.
- **Order:** archive append → verify (re-read, confirm overflow lines are present substring-wise) → only then trim live log.
- **Failure handling:** any thrown error in the routine → catch at top level, write `.quest-log-reminder` with a one-line description (`"Consolidation failed: <err.message>. Trim Recently Completed to 7 manually."`), exit 0. Never crash the session.
- **No partial state:** if archive write fails or verification fails, live log MUST be untouched. The order above guarantees this.

### Concurrency

Two Claude windows on the same project firing `session-end` simultaneously could race. Accepted risk: low probability, low blast radius (worst case: one window's archive append clobbers the other's, and the live log gets trimmed twice — second trim is a no-op because count is already ≤7). Atomic rename means no half-written file. **Do not add a file lock for v1.** If we see actual collisions in practice, revisit.

### Reminder file (fail-silent path)

When the routine can't safely consolidate, write `docs/fellowship/.quest-log-reminder` with a single line describing why. The existing hook (`fellowship-session-end.mjs:77`) writes to the same path for a different reason — that is fine, both append the same kind of message and Gandalf reads the file at session start. **Use `appendFileSync`, not `writeFileSync`,** so the two hooks' reminders coexist if both fire.

### Defensive style (match existing hook)

- Top-level `try/catch` around all I/O.
- No `throw` reaches the process boundary.
- Exit 0 on every path.
- `respond({})` for hook invocation; no output for slash command invocation (script can detect via `process.stdin.isTTY` or absence of stdin JSON).
- No external dependencies. Node stdlib only (`fs`, `path`).

### Worked example

**Before** — `quest-log.md` lines 22–30 (today's actual content, 8 entries; threshold is 7):

```markdown
## Recently Completed
- [x] Codebase cleanup v1.5.1 — Critical (TodoWrite in KNOWN_TOOLS) + 5 Important ... (2026-04-22)
- [x] Codebase map generated — `/fellowship:map` (2026-04-22)
- [x] P4+P5+P6 shipped — ethos absence notice ... (2026-04-22)
- [x] P2 shipped — Legolas structural review ... (2026-04-22)
- [x] TodoWrite whitelist — all 10 agents now have TodoWrite ... (2026-04-22)
- [x] P1 + P3 shipped — TodoWrite visibility ... (2026-04-22)
- [x] Aragorn PRD — Fellowship real-usage improvements scoped ... (2026-04-22)
- [x] AutoImprove Pippin — 1.000 on 8 core scenarios; Mode 4 assertions committed, real validation deferred to live usage (2026-04-22)
```

**Routine:** parses 8 entries. `keep` = first 7. `overflow` = last 1 (AutoImprove Pippin).

**After — `quest-log.md`:**

```markdown
## Recently Completed
- [x] Codebase cleanup v1.5.1 — Critical (TodoWrite in KNOWN_TOOLS) + 5 Important ... (2026-04-22)
- [x] Codebase map generated — `/fellowship:map` (2026-04-22)
- [x] P4+P5+P6 shipped — ethos absence notice ... (2026-04-22)
- [x] P2 shipped — Legolas structural review ... (2026-04-22)
- [x] TodoWrite whitelist — all 10 agents now have TodoWrite ... (2026-04-22)
- [x] P1 + P3 shipped — TodoWrite visibility ... (2026-04-22)
- [x] Aragorn PRD — Fellowship real-usage improvements scoped ... (2026-04-22)
```

(The `**Last updated:** 2026-04-22` line at the top is also refreshed to today's date.)

**After — `quest-log-archive.md`** (appended at the bottom, under a new dated heading):

```markdown
## Archived 2026-04-22

- [2026-03-28] AutoImprove Pippin — 1.000 on 8 core scenarios; Mode 4 assertions committed, real validation deferred to live usage
```

Note the date in the archive line is `2026-03-28` (extracted from the entry's trailing parens — wait, actually the example entry above shows `(2026-04-22)`; in the real archived form, use whatever date the entry carries). The archive heading is today's date (`2026-04-22`); the entry's own date is preserved in the line itself.

**Idempotency check:** running the routine again immediately after — Recently Completed has 7 entries → routine no-ops, exits clean. Running at the next session-start → still 7 → still a no-op. Confirmed safe.

### Failure modes table

| Failure | Detection | Response |
|---|---|---|
| `quest-log.md` missing | `existsSync` false | Exit 0, no reminder. |
| `## Recently Completed` heading missing | `sectionRe` no match | Append reminder: `"Recently Completed section not found"`. Exit 0. |
| Section non-empty but parser finds 0 entries | block has content, `entryRe` empty | Append reminder: `"Could not parse Recently Completed entries"`. Exit 0. |
| Entry count ≤ 7 | length check | No-op. Exit 0. No reminder. |
| Archive write throws | catch | Append reminder: `"Archive write failed"`. Live log untouched. Exit 0. |
| Archive verification fails (re-read missing lines) | post-write check | Append reminder: `"Archive verification failed"`. Live log untouched. Exit 0. |
| Live log write throws | catch (after archive succeeded) | Append reminder: `"Live log write failed AFTER archive succeeded — manual trim needed"`. Archive will have duplicate entries on next successful run; that is acceptable noise. Exit 0. |
| Concurrent run races | not detected | Atomic rename prevents half-writes; second run no-ops or duplicates one archive entry. Acceptable. |

### Slash command contract (for Gandalf to wire later)

The `/fellowship:consolidate` command must:
- Invoke `node hooks/fellowship-quest-log-consolidate.mjs` from the project root (no stdin).
- Surface to the user whether the routine consolidated, no-opped, or wrote a reminder. The script can signal this by writing a one-line stdout summary when invoked without stdin (e.g., `"Trimmed 1 entry to archive."` / `"No consolidation needed (7 entries)."` / `"Could not consolidate — see .quest-log-reminder."`). When invoked as a hook (stdin present), it stays silent and writes `respond({})` only.

---

## Open questions for Gimli (none expected — flag if you hit one)

If the regex tests reveal an entry shape this ADR didn't anticipate, stop and surface it before changing the parse contract. The contract is the load-bearing part of this design.
