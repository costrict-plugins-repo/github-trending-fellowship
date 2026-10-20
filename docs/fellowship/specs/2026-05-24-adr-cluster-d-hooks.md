---
name: adr-cluster-d-hooks
status: implemented
created: 2026-05-24
author: merry
type: adr
implemented_by: gimli
---

# ADR — Cluster D: SessionEnd Reconciliation + Archival Sweep, SessionStart Drift Check

Two new hook bodies for the project-state-contract v1 delivery. They share patterns (fail-silent, polyglot wrapper, subagent guard) and trade-offs (frontmatter handling, output budget, idempotency), so they are documented together. Cluster E (`/fellowship:reconcile` + `contract.yaml`) is deferred to v1.1 and is out of scope.

## Context

The project-state-contract spec (`docs/fellowship/specs/2026-05-15-project-state-contract.md`) defines a canonical shape for `docs/fellowship/` and a status lifecycle (`active → implemented → reviewed → archived`) for every artifact. Two reinforcing levers keep status in sync:

- **Lever 1 (Cluster C1, Gimli's mechanical task):** companion agent files carry a non-negotiable DONE/APPROVED protocol that sets status frontmatter as part of reporting.
- **Lever 2 (this ADR, Hook 1):** a SessionEnd hook reconciles missed transitions, sweeps `reviewed` artifacts into `archive/<type>/`, controls quest-log size, and prints one summary line.

Drift detection is the third safety net: a dedicated SessionStart hook (this ADR, Hook 2) walks the project tree top-level once per session and surfaces files or folders outside the contract.

The hook architecture is already established. `hooks/fellowship-voice-session-start.mjs` and `hooks/fellowship-opener-session-start.mjs` set the fail-silent contract, the polyglot allowlist pattern, and the subagent guard. This ADR extends — not departs from — that architecture.

**Current state of `fellowship-session-end.mjs`:** clears the main-session marker via `clearMainSessionMarker(sessionId)`, then exits 0. The new logic *adds* to this hook (it does not replace the marker cleanup — subagent detection depends on it).

**Current state of `docs/fellowship/`:** drifted. `examples/`, `templates/`, `archive/legacy/` exist outside the canonical tree. Task 8 (project tree migration) is separate from this ADR; the drift-check hook will surface them on next session start, which is the intended behavior.

---

## Shared Decisions (Both Hooks)

### S1. Fail-silent contract applies, unchanged

Every error path exits 0 with no user-facing stdout. Established by voice and opener hooks; non-negotiable here.

**Failure-mode walk-through:**

| Failure | Hook | Behavior |
|---|---|---|
| Stdin payload missing / malformed JSON | both | `readStdinPayloadSync()` returns `{}`; hook continues with empty payload, subagent guard passes, work proceeds. |
| Subagent guard trips (`agent_id` or `agent_type` present) | both | Exit 0 immediately, no stdout. |
| `docs/fellowship/` missing entirely | both | Treat as empty project: nothing to archive, nothing to flag. Exit 0, no stdout. |
| Directory read fails (`readdirSync` throws — permissions) | both | Section yields empty list, hook continues. Trace logged (SessionEnd only). |
| Frontmatter parse error on one artifact | SessionEnd | Skip that artifact, continue the sweep. Trace logged. |
| Atomic move fails (`renameSync` throws — cross-device, permissions) | SessionEnd | Skip that artifact, continue the sweep. Trace logged. Source file untouched. |
| Archive destination directory missing | SessionEnd | Create with `mkdirSync(..., { recursive: true })`. If creation fails, skip that artifact. |
| Trace-log write fails | SessionEnd | Silent. Tracing is diagnostic, not load-bearing. Hook continues. |
| Quest-log file missing or unreadable | SessionEnd | Skip the size-control step. Sweep summary still prints. |

**Trace inside fail-silent:** the trace logger itself must wrap every write in `try/catch` and discard errors. A failed trace must never break a sweep — the sweep is the user-facing work, the trace is diagnostic.

### S2. Subagent guard — confirm pattern, both hooks

`hooks/lib/subagent-detection.mjs` exports `isSubagentContext(payload)` but the voice and opener hooks use only the tier-1 inline check (`agent_id` or `agent_type` non-empty). The tier-2 marker comparison is appropriate for hooks that *fire inside subagents* (PreToolUse, PostToolUse) — neither SessionStart nor SessionEnd does, per the Claude Code lifecycle docs.

**Decision:** both new hooks use the tier-1 inline check, matching voice/opener exactly. Belt-and-braces only; the documented lifecycle says these events do not fire in subagents.

**If wrong:** if a future Claude Code release ships SessionEnd to subagents, the SessionEnd hook would attempt an archival sweep from inside Gimli's subagent context. The sweep operates on shared project files, so the user would see archival happen mid-task. The tier-1 guard catches the documented payload fields; the failure mode is bounded.

### S3. Cross-platform polyglot — both hooks register in two places

Both hooks must be added to `hooks/run-hook.cmd` in BOTH the Windows allowlist (line ~22-28) AND the Unix `case` block (line ~64-66). Gimli already hit this gotcha on the opener hook — the learning is in the codebase. Naming this explicitly so Cluster D doesn't ship with the same regression.

**Hook names** (extensionless, matching established pattern):
- `fellowship-session-end` — file already exists; no rename, just extended logic. Already allowlisted.
- `fellowship-drift-check-session-start` — new file `hooks/fellowship-drift-check-session-start.mjs`. NEW allowlist entries required in both batch and case blocks.

**Hook registration in `hooks.json`:** drift-check appended to BOTH `startup|clear|compact` and `resume` matcher blocks, after `fellowship-opener-session-start`. The opener gates on a marker; drift-check gates on nothing. Ordering matters only for stdout ordering — drift-check emits a notice line that should appear after the opener's status block (drift is housekeeping, status is the headline).

---

## Hook 1 — SessionEnd Reconciliation + Archival Sweep

### Responsibility scope

Extend `hooks/fellowship-session-end.mjs`. Preserve the existing marker-cleanup call (`clearMainSessionMarker(sessionId)`); add four new responsibilities ordered as:

1. **Reconciliation pass** — survey `transcript_path` for companion DONE/APPROVED reports; for each, check the named artifact's frontmatter; if the transition is missed, set the correct status. Log every auto-correction to the trace.
2. **Archival sweep** — find all artifacts in `docs/fellowship/{specs,plans,handoffs,design}/` with `status: reviewed`; move each to `archive/<type>/`.
3. **Quest-log size control** — if `quest-log.md` has more than 50 entries (lines matching `^- \[[ x]\]`), move the oldest 25 to `quest-log-archive.md`.
4. **Summary line** — print one user-facing line summarizing what moved.

Ordering matters: reconciliation runs first so newly-reviewed artifacts land in the same sweep.

### D1. Frontmatter read/write — recommended path

The opener hook reads frontmatter via regex (`/^description:\s*["']?(.+?)["']?\s*$/m`) — read-only, single field, tolerant of malformed input. For SessionEnd, the hook must **write** frontmatter (set `status: archived`, `implemented_by: gimli`, `reviewed_by: legolas`). Regex-write is fragile:

| Approach | Pros | Cons | Fit |
|---|---|---|---|
| **A. Regex read + targeted regex write** | Zero deps, matches opener pattern | Fragile on quoting variants, multi-line values, comments; rewriting a key that does not exist requires "insert before `---`" logic that itself needs parsing | No — write-back is the failure surface |
| **B. Hand-rolled YAML parser scoped to the contract** | Zero deps, predictable | Re-implementation cost; bug surface for edge cases not yet seen | No — cost without buyer |
| **C. Hand-rolled split + line-based key/value rewrite** | Zero deps, contract-shape only (flat scalars), easy to reason about | Will not handle nested YAML — but the contract never produces nested frontmatter, so this constraint fits | **Yes — fits the scale** |

**Decision:** Approach C. The contract's frontmatter is a flat map of scalar keys (`name`, `status`, `created`, `implemented_by`, `reviewed_by`, `author`, `type`). Split the file into `[frontmatter_block, body]` on the second `---` delimiter, parse the block as `key: value` lines, mutate, serialize, rejoin.

**Edge cases the parser must handle:**
- Well-formed: standard read, mutate, write.
- Missing key (`reviewed_by` not present when setting): append the key to the block before serializing.
- Malformed (no opening `---`, no closing `---`, second delimiter not present): skip the artifact entirely, log to trace. Do not attempt to add frontmatter to a file that does not have it.
- Empty body (frontmatter only, no content): preserve the empty body; the file is the artifact.
- Comments or blank lines inside the block: preserve order; rewrite only the touched key.

**If wrong:** if some future artifact uses nested YAML (e.g., a `metadata:` block with subkeys), the parser would flatten or skip it. Trace would show a parse failure; the artifact would be left alone. The recovery path is `/fellowship:reconcile` in v1.1 with a proper YAML library if and only if nested frontmatter ever becomes part of the contract.

### D2. Atomic moves — same-filesystem rename

`docs/fellowship/specs/foo.md` → `docs/fellowship/archive/specs/foo.md` is always within the same project tree, therefore the same filesystem.

| Approach | Pros | Cons | Fit |
|---|---|---|---|
| **A. `renameSync(src, dst)`** | One syscall; atomic on POSIX same-fs; matches opener's write-then-rename pattern | Fails (`EXDEV`) on cross-device; not a concern here | **Yes** |
| **B. `copyFileSync` → `fsync` → `unlinkSync`** | Works across filesystems | Three syscalls; non-atomic window where both files exist; fsync semantics differ by platform | No — over-engineered for current scale |

**Decision:** Approach A — `renameSync`. Failure semantics: if rename throws, the source is untouched and the destination is not created. Skip the artifact, log to trace, continue the sweep. The next session's sweep retries.

**Collision case:** if `archive/specs/foo.md` already exists (rare — same date+slug archived twice), `renameSync` on POSIX silently overwrites; on Windows it throws `EEXIST`. Defensive: `existsSync(dst)` before rename — if collision, log to trace and skip. The duplicate is a contract violation upstream that the user should see.

### D3. Idempotency — artifact frontmatter is the source of truth

The hook can run twice on the same session (crash recovery, manual re-trigger). Two possible truth sources:

- **Session transcript** — the list of DONE/APPROVED reports issued this session.
- **Artifact frontmatter** — the current `status:` value on each artifact.

These can diverge. A DONE report may name an artifact that no longer exists. An artifact may show `status: reviewed` without any APPROVED report this session (set in a prior session, missed by the prior sweep).

**Decision:** **artifact frontmatter is the source of truth for the archival sweep.** Reconciliation uses the transcript only as input to *write* frontmatter; the sweep then reads frontmatter only.

Concretely:

1. Reconciliation pass: walk the transcript, find DONE/APPROVED reports, for each named artifact verify its current frontmatter matches the report's claim, write the missing transition if needed.
2. Sweep pass: walk `docs/fellowship/{specs,plans,handoffs,design}/`, read each artifact's frontmatter, move every one with `status: reviewed`. Ignores the transcript entirely.

**Idempotency property:** running the hook twice produces identical state. After the first run, `reviewed` artifacts are now in `archive/`, so the second run's sweep finds none.

**If wrong:** if the transcript contains a malformed report (e.g., Gimli named an artifact that doesn't exist), reconciliation logs a trace and skips it. The sweep is unaffected because it never trusts the transcript.

### D4. Reconciliation source of truth — Lever 1 is primary, hook is the safety net

Lever 1 (companion-set status as part of DONE/APPROVED) is the primary mechanism. The hook's reconciliation pass exists *only* for the case where Lever 1 misfired — companion shipped a DONE report without setting the frontmatter.

**Design implication:** reconciliation logic stays *narrow*. It compares report claim against frontmatter state and sets the obvious transition. It does NOT:

- Try to infer status from work that wasn't reported (silent commits, etc.)
- Re-derive companion ownership beyond what the report named
- Set `implemented_by` / `reviewed_by` to anyone other than the report's source companion
- Cross-reference against git history or external state

The hook *covers Lever 1 misfires*; it does not *replace* Lever 1. If reconciliation grows into the primary path, the contract has failed and the fix is to harden Lever 1 in agent files — not to add inference to the hook.

**Trace signal:** every auto-correction logged is a Lever 1 miss. Reading the trace tells the user (or future-Frodo) which companion's protocol needs hardening.

### D5. Plugin-internal trace format

| Approach | Pros | Cons | Fit |
|---|---|---|---|
| **A. `$HOME/.claude/fellowship-trace.log`** | Survives project deletion; per-user diagnostic continuity; mirrors `/tmp/fellowship-hook-debug.log` precedent | Cross-project mixing — entries from project A appear next to project B's; needs project path in each record | **Yes** |
| **B. Project-local `.fellowship-trace.log`** | Easy to find per-project; can `.gitignore` cleanly | Lost on `git clean -fdx`; one log per project to consult | No — diagnostic continuity matters more than per-project tidiness |
| **C. `/tmp/fellowship-trace.log`** | Matches debug log path | Lost on reboot; not useful for "what happened last week" | No |

**Decision:** Approach A — `$HOME/.claude/fellowship-trace.log`. Per-user, cross-project, survives reboots and clones.

**Record format** (JSONL, one record per line, for grep + jq):

```json
{"timestamp":"2026-05-24T14:23:11.000Z","hook":"fellowship-session-end","project":"/Users/Karolus/projects/Fellowship","session_id":"abc123","event":"reconcile","artifact":"docs/fellowship/specs/2026-05-15-foo.md","from":"active","to":"implemented","reason":"DONE report from gimli"}
{"timestamp":"2026-05-24T14:23:11.100Z","hook":"fellowship-session-end","project":"/Users/Karolus/projects/Fellowship","session_id":"abc123","event":"archive","artifact":"docs/fellowship/specs/2026-05-15-foo.md","destination":"docs/fellowship/archive/specs/2026-05-15-foo.md"}
{"timestamp":"2026-05-24T14:23:11.200Z","hook":"fellowship-session-end","project":"/Users/Karolus/projects/Fellowship","session_id":"abc123","event":"error","stage":"frontmatter-parse","artifact":"docs/fellowship/plans/2026-05-15-bar.md","detail":"no closing delimiter"}
{"timestamp":"2026-05-24T14:23:11.300Z","hook":"fellowship-session-end","project":"/Users/Karolus/projects/Fellowship","session_id":"abc123","event":"quest-log-archive","moved":25,"remaining":26}
```

**What it captures:** every reconcile transition, every archive move, every skip-with-reason, quest-log archival counts.

**What it does NOT capture:** artifact contents, transcript text, user prompts. The trace is metadata, not content. (Privacy and size both — the debug log can carry payloads; the trace stays slim.)

**Rotation:** none in v1. JSONL with one line per event grows slowly (single-digit lines per session typical). If the file exceeds ~10MB in practice, add naive rotation in v1.1. The `if wrong` here is bounded — disk space is cheap, format is greppable.

### D6. Quest-log size control — trigger and mechanism

**Trigger:** count of lines matching `/^- \[[ x]\]/m` in `quest-log.md`. Both checked (done) and unchecked (open) entries count toward the 50 threshold. Headings, blank lines, and non-entry prose do not count.

**Why both checked and unchecked:** size is about scroll burden, not work-remaining. Closed items still occupy lines.

**Mechanism:**

1. Split file on `\n`.
2. Walk lines, tag each as `entry` or `non-entry`.
3. If `entry` count ≤ 50, no-op.
4. Otherwise, find the indices of the oldest 25 entries (first 25 in document order — entries are append-chronological per spec).
5. Extract those entries plus any preceding non-entry "context lines" that immediately attach to them (the line directly above an entry, if it is a heading or sub-bullet).
6. Append the extracted block to `quest-log-archive.md` (create if missing, with a `---\n# Quest Log Archive\n---` header).
7. Rewrite `quest-log.md` without the extracted block.

**Atomicity:** both writes use write-tmp-then-rename. If the archive append succeeds but the rewrite fails, the next run re-archives the same entries — idempotent if the archive file tolerates duplicates. Defensive: scan the archive for the entries' first-line hashes before appending; skip duplicates. (Hash = first 80 chars of the first line of each entry. Crude but cheap.)

**If wrong:** if the quest-log format ever shifts (e.g., entries use a different bullet style), the matcher misses and no archival happens. The list grows. User-visible failure mode: a long quest-log, which they can manually trim. Acceptable — no data loss, no silent corruption.

### D7. Summary line — wording per case

The spec mandates *one* user-facing line. Cases:

| State | Summary line |
|---|---|
| Nothing moved, no auto-corrections | (no line printed) |
| Archived N items, no auto-corrections | `Archived 3 specs, 1 plan, 2 handoffs to archive/.` (omit zero-count categories) |
| No archives, but K auto-corrections | `Reconciled 2 status transitions. See ~/.claude/fellowship-trace.log.` |
| Archives + auto-corrections | `Archived 3 specs, 1 plan to archive/. Reconciled 2 status transitions.` |
| Archives + quest-log archived | `Archived 3 specs to archive/. Archived 25 quest-log entries to quest-log-archive.md.` |
| Quest-log only | `Archived 25 quest-log entries to quest-log-archive.md.` |
| Everything | `Archived 3 specs, 1 plan to archive/. Reconciled 2 status transitions. Archived 25 quest-log entries to quest-log-archive.md.` |

**Decision principle:** if nothing happened, print nothing — silence is the correct signal that everything was already in order. Otherwise, name only the categories with non-zero counts. The line is plain English, no emoji, no leading prefix; SessionEnd's stdout is brief by design.

**Output channel:** stdout. SessionEnd hooks do not inject `additionalContext` (the session is ending — no context to inject into). The line appears in the terminal at session close.

---

## Hook 2 — SessionStart Drift Check

### Responsibility scope

New file `hooks/fellowship-drift-check-session-start.mjs`. Walk `docs/fellowship/` top-level once; compare against the canonical tree; if drift, emit one stdout line. No prompt, no `additionalContext`, no marker-state change.

### D8. Canonical tree representation — inline constant, v1 only

Cluster E (`contract.yaml`) is deferred. v1 must inline the canonical tree somewhere readable and stable.

| Approach | Pros | Cons | Fit |
|---|---|---|---|
| **A. Inline `Set<string>` of allowed top-level entries** | Trivial; O(1) membership check; impossible to misread | Not extensible to nested rules without rewrite | **Yes — fits v1 scope** |
| **B. Array of glob patterns** | Handles `archive/*` shape | Glob library or hand-rolled matcher; matches more than drift-check needs | No — over-built for top-level walk |
| **C. Inline JSON object with type-per-entry** | Structured for migration to `contract.yaml` | Format invented now and again in v1.1 | No — premature design |

**Decision:** Approach A. A `Set` of allowed top-level names:

```
README.md, product.md, quest-log.md, quest-log-archive.md, codebase-map.md,
ethos-overrides.md (optional, user-opt-in), specs, plans, handoffs, design, archive
```

**Migration path to v1.1 `contract.yaml`:** the `Set` constant is named `CANONICAL_TOP_LEVEL` and lives at the top of the hook file. Cluster E replaces the `Set` literal with a `readFileSync` on `contract.yaml` parsed into the same `Set`. Drift-check logic does not change. The data structure is the contract — only its source changes.

**If wrong:** if the canonical tree shifts (e.g., `codebase-map.md` is renamed), the constant goes stale and the hook flags valid files as drift. Catch in PR review (the spec section "Canonical Project Tree" and this constant must change together). v1.1 with `contract.yaml` removes the dual-source-of-truth concern.

### D9. Drift definition — files and directories, top-level only

**Scope decision:** walk only `docs/fellowship/` top-level, one `readdirSync`. Files AND directories both checked against the allowlist.

**Out of scope for the drift check:**

- Contents of `specs/`, `plans/`, `handoffs/`, `design/` (the artifacts themselves). The naming-convention contract governs those; reconcile (Cluster E, v1.1) enforces.
- Contents of `archive/<type>/` — mis-archived files. Not flagged by this hook. Rationale: archive contents are the long memory; manual curation is acceptable; flagging would create false-positive noise on every session. (Revisit in v1.1 if needed.)
- Nested directories under `specs/`, `plans/`, etc. The contract permits flat artifact folders only; nested dirs *are* drift. **Decision:** flag any directory inside the first-class artifact folders. (Cheap: one more `readdirSync` per artifact folder, filter for `isDirectory()`.) *(Amended 2026-06-11 — Frodo ruling: `design/` is exempt from the flat rule. The directory guide permits `design/{feature-slug}/` and visual-exploration persists mockups under `design/mockups/<session>/`; the original flat list contradicted both. Lifecycle dirs — `specs/`, `plans/`, `handoffs/` — stay flat.)*

**Output line format:**

```
Drift detected — `templates/`, `examples/`, `archive/legacy/` outside the contract.
```

- Each drifted entry backtick-quoted, comma-separated.
- Trailing slash for directories, no slash for files.
- Nested-dir drift renders as the full relative path: `` `specs/old-stuff/` ``.
- If more than 5 drift entries, truncate to first 5 + `(+N more)`. Output budget matters.

### D10. Output budget — separate from additionalContext

The voice and opener hooks inject `additionalContext` (the JSON wrapper Claude Code reads into context). Drift-check emits **plain stdout**, no JSON wrapper. This puts the line in the terminal for the user to read, NOT into Gandalf's context window.

**Rationale:** drift is the user's housekeeping signal. It does not affect Gandalf's reasoning. Burning context-window tokens on every session for a housekeeping notice would compound across sessions.

**Confirmation:** the spec is explicit on this — *"Notice only, no question. No additionalContext injection (the user reads the stdout themselves)."* Lock the channel: stdout only, no `process.stdout.write(JSON.stringify({...}))` wrapper.

**If wrong:** if Claude Code's SessionStart hook contract ever requires JSON-wrapped stdout (it currently accepts plain text as terminal output passed through), the hook would print raw text into the user's terminal — visible, not injected. The user sees the line either way; the "wrong" case here is no worse than the "right" case.

---

## Consequences

### Positive

- Lever 2 fires automatically every session close — the contract's status discipline does not depend on user prompts.
- Reviewed artifacts move to archive without user action; the active folders stay scoped to active work.
- Quest-log stays under 50 entries indefinitely without manual trim.
- Drift surfaces at session start before it normalizes — the user sees `templates/`, `examples/`, `archive/legacy/` flagged on the next session, which is the trigger for Task 8 (project-tree migration).
- Trace log gives Frodo and future-Merry a record of which companions miss Lever 1, so the contract can harden empirically.

### Negative

- SessionEnd now does work beyond the marker cleanup. If it crashes, the marker cleanup still runs (it's first in the sequence), but the sweep may be partial. Mitigation: the sweep is idempotent — next session completes what this one missed.
- The hand-rolled frontmatter parser is a new code path with its own bugs. Mitigation: the parser is scoped to flat scalars, the contract enforces flat scalars, and the test surface is small.
- One more stdout line at session start (drift) and at session end (summary). The user sees more chrome. Mitigation: both lines suppress when there is nothing to say.

### If the contract assumption is wrong

The whole architecture assumes companions will, in practice, set status frontmatter as part of DONE/APPROVED reports (Lever 1) most of the time, and the hook covers the misses. **If wrong** — if Lever 1 fires <50% of the time — the trace fills with reconciliations and the sweep becomes the de-facto status-setter. The architecture still works (the sweep is the safety net), but the design intent shifts: Lever 1 was supposed to be the discipline; the hook would become the discipline. That's not a bug, but it's a signal to revisit agent-file contracts in v1.1.

**Worst case:** the transcript surveying logic cannot reliably identify which artifact a DONE report names. Reconciliation degrades to a no-op; the sweep still works because it trusts frontmatter only. The system falls back to "Lever 1 or nothing" — usable, less robust.

---

## Alternatives Considered

### Alt 1 — Single combined SessionStart hook

Originally the spec said "extend existing SessionStart hook." Revised in the spec on 2026-05-24 to a dedicated new hook because the voice and opener hooks already split by responsibility. Locked in this ADR: **drift-check is its own hook file**. Pro: clean failure isolation, matches voice/opener pattern. Con: one more entry in `hooks.json` and `run-hook.cmd`. Worth the cost.

### Alt 2 — Use a YAML library for frontmatter

Adding `js-yaml` or `gray-matter` would handle every edge case the hand-rolled parser misses. **Rejected** for v1: zero-dep is the established pattern (voice and opener hooks use regex + raw `fs`), the contract enforces flat scalars, and the surface area doesn't justify a dependency. Reassess in v1.1 if nested frontmatter ever becomes contract.

### Alt 3 — Trace to `transcript_path` directory

SessionEnd payload includes `transcript_path`. The trace could live alongside the transcript. **Rejected:** the transcript is per-session and gets cleaned up; the trace needs to outlive transcripts for "what happened last week" diagnostics. `$HOME/.claude/fellowship-trace.log` wins.

### Alt 4 — Reconciliation as an `additionalContext` notice rather than silent write

Inject a notice into Gandalf's context window each session noting auto-corrections. **Rejected:** the spec is explicit that reconciliation is silent (Lever 2 line 145: *"No user prompt"*); auto-corrections are a plugin signal, not a user concern. The trace is the record.

### Alt 5 — Use `contract.yaml` now instead of inline constant

Pull Cluster E forward. **Rejected:** Aragorn's phased delivery defers Cluster E to v1.1. Adding a parser for `contract.yaml` doubles the v1 surface area for a benefit that lands one phase later anyway. Inline constant fits v1; the migration path is clean.

---

## Open Items for Frodo

None blocking. Every decision is recommended.

One judgment call worth surfacing: **D5 trace location** (`$HOME/.claude/fellowship-trace.log`). The choice favors diagnostic continuity over per-project tidiness. If Frodo prefers project-local traces (loseable but tidy), flip to `.fellowship-trace.log` at the project root and add to `.gitignore`. The hook logic is identical either way.

---

## Interface Contracts (For Gimli)

### Contract — `hooks/fellowship-session-end.mjs`

**Preserve:**
- Existing import of `clearMainSessionMarker`, `readStdinPayloadSync`, `debugLogIfEnabled`.
- `clearMainSessionMarker(sessionId)` call. Runs **first**, before any new work.
- Final `process.stdout.write(JSON.stringify({}) + '\n')` and `process.exit(0)`.

**Add (in this order):**

1. After marker cleanup: subagent guard (tier 1 only). Bail with `process.exit(0)` if `agent_id` or `agent_type` present.
2. Reconciliation pass:
   - Input: `payload.transcript_path` (string).
   - Read transcript, parse for companion reports of `Status: DONE` and `Status: APPROVED`.
   - For each report, identify the named artifact (from report `ADR:`, `Spec:`, `Plan:` lines, etc. — depends on report format per companion).
   - Read artifact frontmatter (D1 parser).
   - If `active` and report is DONE, set `status: implemented` + `implemented_by: <companion>`.
   - If `implemented` and report is APPROVED, set `status: reviewed` + `reviewed_by: <companion>`.
   - Log every transition to trace (D5).
3. Archival sweep:
   - For each `dir` in `[specs, plans, handoffs, design]`:
     - `readdirSync(docs/fellowship/<dir>)`, filter `.md` files.
     - For each, parse frontmatter (D1).
     - If `status: reviewed`, set `status: archived`, rename via `renameSync` to `docs/fellowship/archive/<dir>/<filename>`.
     - `mkdirSync(archive/<dir>, { recursive: true })` before rename if needed.
     - Increment counter per type.
     - Log each move to trace.
4. Quest-log size control:
   - Read `docs/fellowship/quest-log.md`. Count lines matching `/^- \[[ x]\]/`.
   - If > 50, extract first 25 entries (D6 mechanism), append to `quest-log-archive.md`, rewrite `quest-log.md`.
   - Log to trace.
5. Summary line (D7) — `process.stdout.write(line + '\n')` before the existing JSON output.

**Trace helper:** new function `traceEvent(record)` in the hook file (or a new `hooks/lib/trace.mjs` if Gimli prefers — single-file is fine for v1). Wraps `appendFileSync` in try/catch; silent on failure.

### Contract — `hooks/fellowship-drift-check-session-start.mjs`

**File header:** match voice/opener style — purpose comment, subagent context note, fail-silent note, spec/ADR reference.

**Imports:**
```javascript
import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readStdinPayloadSync, debugLogIfEnabled } from './lib/subagent-detection.mjs';
```

**Top-level constants:**
```javascript
const CANONICAL_TOP_LEVEL = new Set([
  'README.md', 'product.md', 'quest-log.md', 'quest-log-archive.md',
  'codebase-map.md', 'ethos-overrides.md',
  'specs', 'plans', 'handoffs', 'design', 'archive',
]);
const FIRST_CLASS_ARTIFACT_DIRS = ['specs', 'plans', 'handoffs', 'design'];
const MAX_DRIFT_ENTRIES = 5;
```

**Body (try-wrapped, fail-silent):**

1. Read payload, debug log.
2. Subagent guard (tier 1).
3. Resolve `docs/fellowship/` against `process.env.CLAUDE_PROJECT_DIR || process.cwd()`.
4. If directory does not exist, `process.exit(0)` — empty project, nothing to flag.
5. `readdirSync` top-level. For each entry, check membership in `CANONICAL_TOP_LEVEL`. Collect drifts.
6. For each `dir` in `FIRST_CLASS_ARTIFACT_DIRS`, `readdirSync(docs/fellowship/<dir>)` — flag any entry that is a directory (per D9).
7. If `drifts.length === 0`, `process.exit(0)` — silent.
8. Format the line per D9; if `drifts.length > MAX_DRIFT_ENTRIES`, slice + suffix `(+N more)`.
9. `process.stdout.write(line + '\n')`.
10. `process.exit(0)`.
11. Top-level catch: `process.exit(0)`.

**Registration in `hooks.json`:** append a third entry to the `hooks` array inside BOTH the `startup|clear|compact` matcher block AND the `resume` matcher block. Pattern matches the existing opener entries exactly.

**Registration in `hooks/run-hook.cmd`:**
- Windows block: add `if /i "%HOOK_NAME%"=="fellowship-drift-check-session-start" goto :hook_ok` line.
- Unix `case`: add `|fellowship-drift-check-session-start` to the alternatives list.

---

## Data Model

No persistent state beyond what already exists. Files touched:

| Path | Read | Write | Notes |
|---|---|---|---|
| `docs/fellowship/{specs,plans,handoffs,design}/*.md` | yes | frontmatter only | Mutate `status:`, add `implemented_by:` / `reviewed_by:` when missing |
| `docs/fellowship/archive/{specs,plans,handoffs,design}/*.md` | no | move target | Destination of `renameSync` |
| `docs/fellowship/quest-log.md` | yes | full rewrite | Size-control extracts oldest 25 |
| `docs/fellowship/quest-log-archive.md` | yes | append | Created on first archival |
| `$HOME/.claude/fellowship-trace.log` | no | append | JSONL, created on first event |
| `transcript_path` (from payload) | yes | no | Source for reconciliation pass |
| `.fellowship-main-session` (existing) | no | no | Cleared by existing logic, untouched here. *(2026-06-11: marker relocated to `~/.claude/fellowship/state/<slug>.main-session`; clearing logic unchanged — see `hooks/README.md` § State directory.)* |

No schema migrations. No new top-level files in `docs/fellowship/`. The canonical tree is already what the contract describes; this ADR's hooks enforce it.

---

## References

- Spec: `docs/fellowship/specs/2026-05-15-project-state-contract.md`
- Phased delivery: Aragorn's plan, Cluster D
- Existing hooks (pattern reference):
  - `hooks/fellowship-voice-session-start.mjs`
  - `hooks/fellowship-opener-session-start.mjs`
  - `hooks/fellowship-session-end.mjs` (to be extended)
  - `hooks/lib/subagent-detection.mjs`
  - `hooks/run-hook.cmd`
- Companion file conventions: `agents/*.md` (Lever 1 surface — Gimli's mechanical task in Cluster C1)
