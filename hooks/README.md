# Fellowship hooks

Hooks live here; registration lives in `hooks.json`. Each registered hook has
a `<name>.mjs` Node entry point and a matching extensionless bash wrapper of
the same name. Claude Code invokes the wrapper through
`hooks/run-hook.cmd <name>`, which dispatches to bash on Unix and to Git Bash
on Windows. The wrapper allowlist in `run-hook.cmd` must be updated whenever a
new hook is registered.

Shared mechanisms live under `hooks/lib/`. Currently:
- `hooks/lib/subagent-detection.mjs` — marker-file based subagent detection
  plus the state-directory path resolution every marker-writing hook shares.
  Imported by every hook that needs to behave differently for the main
  thread vs. a Fellowship companion subagent.

## State directory

Fellowship hooks never write runtime files into the user's project tree.
Both session markers and the scorecard ledger live in a per-project state
directory outside it:

```
${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.main-session
${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.session-history
${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.scorecard.jsonl
```

`<slug>` is the absolute project dir with every character outside
`[A-Za-z0-9]` replaced by `-` — Claude Code's own `~/.claude/projects/`
convention (e.g. `/Users/x/Fellowship` → `-Users-x-Fellowship`). Files are
flat (no per-project subdirectories); the dir is created with `mkdir -p`
semantics, best-effort. Path resolution lives in one place —
`stateMarkerPath(kind)` in `hooks/lib/subagent-detection.mjs` — so the slug
logic cannot drift between hooks.

If the state dir cannot be created, hooks SKIP the write — there is no
fallback into the project tree. Subagent detection then degrades to the
tier-1 payload fields and the opener treats every session as first; both are
documented degradations (see the failure-mode table below).

**Legacy migration.** Releases up to v1.1 wrote `.fellowship-main-session`
and `.fellowship-session-history` into the project root — untracked clutter
in every non-Fellowship repo. On SessionStart, `migrateLegacyMarkers()`
(called by both the voice and opener hooks; idempotent, best-effort, silent)
moves the history marker's content to the new location (only when no
new-location file exists yet) and deletes both legacy files plus any orphaned
`.fellowship-session-history.*.tmp`. The legacy main-session content is not
migrated — it is a stale session id; SessionStart claims a fresh marker
immediately after.

## Current hooks

| Name | Event | Async | Purpose |
| ---- | ----- | ----- | ------- |
| `session-start` | SessionStart (`startup\|clear\|compact`, `resume`) | false | Bootstraps Fellowship context: skill loading, quest-log/codebase-map staleness checks, project state. |
| `fellowship-voice-session-start` | SessionStart (`startup\|clear\|compact`, `resume`) | false | Voice persistence — claims the main-session marker, injects `skills/using-fellowship/references/voice.md` into the main-agent context. |
| `fellowship-opener-session-start` | SessionStart (`startup\|clear\|compact`, `resume`) | false | Session opener — on a *returning* session, injects project state (recent commits, open quest-log items, in-flight memories) so Gandalf opens with orientation. Gated by a history marker; silent on the first session. Registered after the voice hook. |
| `fellowship-plan-gate` | PreToolUse (`Edit\|Write\|MultiEdit`) | false | Tier 3+ plan-before-build check for subagent dispatches. Fail-open in v1.0. |
| `fellowship-context-monitor` | PostToolUse | true | Emits context-window warnings at 35% (warning) and 25% (critical) remaining. Evaluated for removal 2026-06-11, kept: Claude Code surfaces context pressure only to the *user* (`/context` UI) and auto-compacts reactively — it injects no signal into the *model's* context. This hook fills that gap so the model can wrap up or hand off before compaction hits. |
| `fellowship-drift-check-session-start` | SessionStart (`startup\|clear\|compact`, `resume`) | false | Walks `docs/fellowship/` top level, flags any file or directory outside the project-state contract's canonical tree, emits one notice line on drift. Registered after the opener hook. Fail-silent. |
| `fellowship-session-end` | SessionEnd | false | Clears the main-session marker, runs the reconciliation pass over the transcript, appends per-dispatch outcome records to the state-dir scorecard ledger, executes the archival sweep, applies quest-log size control, emits a proportional summary line, traces every action to `$HOME/.claude/fellowship-trace.log`. |

## Voice persistence (v1)

See `docs/fellowship/specs/2026-05-16-voice-persistence-spec.md` and
`docs/fellowship/plans/2026-05-16-voice-persistence.md` for the design.
Mechanism is single-layer:

- **`fellowship-voice-session-start`:** reads `voice.md` from the plugin
  root and writes it to stdout. Claude Code's SessionStart contract
  injects hook stdout into the main agent's context. Also claims the
  main-session marker file (see "Subagent detection" below).

The hook is `async: false` — SessionStart stdout must land in the cached
prefix before the model's first response; async would race.

The hook is fail-silent: any error path exits 0 with empty output. A
broken voice hook must never break a session.

**Layer 2 removed 2026-06-11.** The design originally carried a second
hook that re-anchored the voice with ~90 tokens of `additionalContext` on
every user message (UserPromptSubmit). The vp001 evals showed the per-turn
anchor cannot push past the additive-prompting ceiling (2/3 regardless of
anchor formulation), so it bought nothing for its per-turn cost. The
SessionStart injection is now the sole voice layer; drift on very long
sessions is accepted.

## Session opener (v1)

See `docs/fellowship/specs/2026-05-17-session-opener-design.md` and
`docs/fellowship/plans/2026-05-17-session-opener.md` for the design. The opener
makes Gandalf's first response in a *returning* session lead with project state
— where we left off, what to tackle next, a brief welcome — before he addresses
the user's prompt. It is the complement to voice persistence: voice carries the
register, the opener carries the orientation.

Mechanism is two-layer, parallel to voice:

- **Layer 1 — history marker.** A file `<slug>.session-history` in the state
  directory (see "State directory" above — NOT the project root) records that
  a Fellowship SessionStart has run for this project. Its *existence* is the
  gate. First session in a project: marker absent → the hook creates it (with
  a `last_session_ended` ISO timestamp), emits nothing, exits 0 — no opener,
  because there is nothing to recap. Subsequent sessions: marker present →
  the opener fires and the timestamp is refreshed. Unlike
  `<slug>.main-session` (created on SessionStart, deleted on SessionEnd,
  scoped to one session), this marker is *history* — never deleted, only
  updated. Conflating the two would break both, so it is a separate file.
- **Layer 2 — content + instruction.** When the marker is present, the hook
  computes three sections — recent commits (`git log --oneline -5`), the top
  three open quest-log items (`- [ ]` lines), and in-flight project memories
  (`description:` from `memory/project_*.md`) — and emits them as
  `additionalContext` framed by an instruction telling Gandalf to open in his
  register. The hook supplies *content*; Gandalf supplies *voice*. There is no
  bullet template in the response — three short observations, then the prompt.

The marker write uses write-then-rename (`<target>.<pid>.tmp` → `renameSync`)
so a partial write cannot corrupt the marker; the temp lives in the state dir
(same filesystem, so the rename stays atomic, and a leaked temp never touches
the project tree) and is unlinked best-effort on any rename failure. The
output budget is ~2 KB of soft guidance — the
instruction prose stays full-strength because it is what shapes the opener's
voice; per-line truncation (80-char commit subjects, 200-char quest/memory
lines) bounds the rest. Memory-dir resolution derives a project slug from
`CLAUDE_PROJECT_DIR`; on any miss the memory section silently empties and a
record is written under `FELLOWSHIP_HOOK_DEBUG=1`.

Like the voice hooks, the opener is `async: false` (its stdout must land in the
cached prefix before the first response) and fail-silent on every error path —
missing git, missing quest log, missing memory dir, marker read/write failure
all degrade to "emit nothing, exit 0." A broken opener must never break a
session. It registers *after* the voice hook on SessionStart so the voice
register lands before the opener instruction.

## Project-state contract enforcement (Lever 2 hooks)

See `docs/fellowship/specs/2026-05-15-project-state-contract.md` for the
contract and `docs/fellowship/specs/2026-05-24-adr-cluster-d-hooks.md` for the
hook design. Two hooks carry the discipline: drift detection at SessionStart,
auto-reconciliation and archival at SessionEnd. Companion contracts (Lever 1)
set status frontmatter; these hooks (Lever 2) catch anything missed.

### Drift check (`fellowship-drift-check-session-start`)

On every SessionStart, the hook walks the top level of `docs/fellowship/` and
compares against the canonical tree from the project-state contract. Anything
outside that set is drift; the hook emits one stdout line:

> *Drift detected — `<paths>` outside the contract.*

The canonical set is an inline `Set` in v1 (`README.md`, `product.md`,
`quest-log.md`, `quest-log-archive.md`, `codebase-map.md`, `ethos-overrides.md`,
`specs/`, `plans/`, `handoffs/`, `design/`, `research/`, `archive/`;
`research/` admitted 2026-06-11). v1.1 migrates it to
`skills/using-fellowship/references/contract.yaml` as the single source of
truth shared with `/fellowship:reconcile`; the walk logic does not change.

The hook also checks nested directories under the first-class artifact folders
(`specs/`, `plans/`, `handoffs/`, `design/`) — the contract permits flat
folders only, so any subdirectory there is drift. The notice caps at 5
entries with a `(+N more)` suffix on overflow.

Output is plain stdout (terminal text), not `additionalContext` — drift is the
user's housekeeping signal; it does not occupy Gandalf's context window.
Notice only, no question. Registered *after* the opener hook on SessionStart
so the orientation message lands first. Fail-silent on every error path —
permission errors, missing `docs/fellowship/`, unreadable directories all
degrade to "exit 0 with no output."

### SessionEnd reconciliation + archival (`fellowship-session-end`)

The SessionEnd hook now does six things in a fixed order. The order matters:
marker cleanup runs first so a later sub-step failure can never block it;
each sub-step is wrapped in its own try/catch so one failure cannot take down
the others.

1. **Subagent guard.** Bail silently if running inside a subagent.
2. **Marker cleanup.** Clears the state-dir `<slug>.main-session` marker
   (guarded by `session_id`) — preserves the voice-persistence/
   subagent-detection contract.
3. **Reconciliation pass.** Scans the transcript at `transcript_path` for
   `Status: DONE` and `Status: APPROVED` blocks. For each, locates referenced
   `docs/fellowship/{specs,plans,handoffs,design}/*.md` paths within a
   symmetric ~2 KB window and applies the missing status transition —
   `active → implemented` for DONE (with `implemented_by` inferred from the
   nearest companion mention), `implemented → reviewed` for APPROVED (with
   `reviewed_by: legolas` hardcoded per the Lever 1 contract). Narrow logic:
   no inference beyond what the report explicitly names. De-duped per
   `(artifact, status)`. The transcript is parsed once; the scan also feeds
   the scorecard ledger (next step), which records all seven protocol
   statuses while reconciliation acts only on these two.
4. **Scorecard ledger.** Appends one JSONL record per companion report block
   detected by the same scan to the state-dir ledger (see "Scorecard ledger"
   below). Data capture only — no rendering, no analysis.
5. **Archival sweep.** Walks `docs/fellowship/{specs,plans,handoffs,design}/`;
   for each artifact at `status: reviewed`, sets `status: archived` and
   `renameSync`s to `docs/fellowship/archive/<type>/`. The rename runs
   *before* the frontmatter rewrite so a partial failure leaves the source
   intact for the next sweep; if the destination frontmatter write fails,
   the file is rolled back to source. Collision guard: if
   `archive/<type>/<file>` already exists, the source is left untouched and
   the violation is traced.
6. **Quest-log size control.** If `quest-log.md` exceeds 50 entries (counted
   by `^- \[[ x]\]` lines), the oldest 25 are appended to
   `quest-log-archive.md` and removed from `quest-log.md`. Dedup against the
   archive uses a hash of the first 80 chars per entry, so a partial-failure
   retry won't double-append.
7. **Summary line.** One proportional stdout line summarizing what moved —
   *"Archived 3 specs, 1 plan, 2 handoffs to archive/. Reconciled 2 status
   transitions. Archived 25 quest-log entries to quest-log-archive.md."* —
   omitting clauses that have nothing to report. Silent if nothing happened.
   The scorecard ledger never appears here — it is instrumentation, not
   project-state movement.

#### Scorecard ledger

Accumulates the evidence base that answers "does Fellowship's orchestration
earn its cost" — cycles to approval, failure shapes — with real per-dispatch
data. v1 is data capture only.

**Location:** `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.scorecard.jsonl`
(the state directory, never the project tree — path resolved through the same
`stateMarkerPath` helper as the session markers). Append-only JSONL, one
record per companion report block detected in the transcript — any of the
seven protocol statuses (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`,
`BLOCKED`, `APPROVED`, `APPROVED_WITH_CONCERNS`, `CHANGES_REQUESTED`). No
de-dupe: a repeated DONE on the same artifact is re-dispatch signal.

**Fields:**

```json
{"ts": "...", "session_id": "...", "companion": "gimli", "status": "DONE",
 "artifact": "docs/fellowship/specs/....md", "review_cycle": 1,
 "source": "session-end-v1"}
```

- `ts` — write time (session end), ISO 8601.
- `companion` — nearest-mention inference from the report window; may be
  `unknown`.
- `artifact` — present only when the window names exactly one artifact path;
  zero or several → omitted rather than guessed.
- `review_cycle` — present only on reviewer verdicts (`APPROVED`,
  `APPROVED_WITH_CONCERNS`, `CHANGES_REQUESTED`) with a derivable artifact:
  the nth verdict on that artifact this session, in transcript order.
- `source` — `session-end-v1`, so later capture mechanisms can coexist in
  the same file.

A `Status:` line followed by `|` on the same line is the report-format
*template* quoted in agent files and docs, not a report — the scan skips it
so reading an agent file mid-session cannot fabricate records.

**Failure posture:** fail-silent, like every sub-step. State dir uncreatable
→ the write is skipped (same posture as the markers, no project-tree
fallback). Any other ledger failure traces to the trace log and never
affects the reconciliation pass or the exit code. The data is best-effort:
if Gandalf quotes a companion report verbatim near an artifact path, the
outcome can be double-counted — accepted v1 noise.

Every action — every reconcile, every archive, every error path — appends a
JSON record to `$HOME/.claude/fellowship-trace.log` (falls back to
`/tmp/fellowship-trace.log` if `homedir()` is empty). The trace is plain JSONL,
diagnostic only; a failing trace must never break the sweep.

Frontmatter writes use a hand-rolled flat-scalar parser (per ADR D1) — only
recognizes `key: value` lines, preserves unknown lines verbatim, and uses
write-then-rename for atomicity. Artifact frontmatter is the authoritative
source of truth for the archival sweep; the transcript is only an input to the
reconciliation pass.

Fail-silent on every path: the user's session is already terminating, so a
noisy hook here is worse than a quiet one. If `docs/fellowship/` does not
exist, the hook emits `{}` and exits 0.

## Subagent detection

Some hooks must behave differently when running inside a Fellowship companion
subagent. The plan-gate hook is the load-bearing case: `PreToolUse` fires for
both main-thread and subagent tool calls, and plan-gate must only enforce its
"plan before editing" rule on subagents.

The voice hook is belt-and-braces: per Claude Code's documented hook
lifecycle, `SessionStart` only fires at the top level — it does not fire
inside subagent processes. The voice hook still calls into the shared
subagent detector defensively, so a documentation change in a future
release would not silently break the gate.

### What does NOT work

The obvious first attempt — checking environment variables for an agent
identity — is a no-op in Claude Code 2.1.142. Legolas's empirical inventory
of CLAUDE-prefixed env keys present in a subagent process found six:

```
CLAUDECODE
CLAUDE_CODE_ENTRYPOINT
CLAUDE_CODE_EXECPATH
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
CLAUDE_CODE_SESSION_ID
CLAUDE_EFFORT
```

None of `CLAUDE_AGENT_TYPE`, `CLAUDE_SUBAGENT_TYPE`, or `CLAUDE_AGENT` is
set. None of the six that *are* present identify the agent type. The
previous env-var heuristic in `fellowship-plan-gate.mjs` was a silent no-op
for the entire time it shipped; the hook's fail-open posture masked the
bug.

### What works: two-tier detection

The shared module `hooks/lib/subagent-detection.mjs` exports
`isSubagentContext(payload)`. It checks two signals in priority order:

**Tier 1 — documented payload fields.** Per the Claude Code hook docs:

> When running with `--agent` or inside a subagent, two additional fields
> are included: `agent_id` and `agent_type`. Present only when the hook
> fires inside a subagent call.

If either field is present on the stdin payload, the hook is unambiguously
inside a subagent. The docs describe these as the official signals.

**Empirical status in 2.1.142.** Legolas observed both fields as `null` in
his own subagent debug logs during Round 2 review (`payload_agent_id: null`,
`payload_agent_type: null`). So in 2.1.142 the tier-1 check is dormant — it
matches what the docs describe but Claude Code does not actually populate
the fields. Tier 2 carries the real load today. Tier 1 stays in place as
forward compatibility: when (if) Anthropic ships the documented behavior,
the gate switches over automatically with no code change.

**Tier 2 — marker-file fallback.** The empirically-validated mechanism that
carries the gate today. Works regardless of what Claude Code chooses to
expose:

1. The main thread's `fellowship-voice-session-start` hook fires on
   `SessionStart` (which the docs guarantee runs only on the main thread).
   It unconditionally writes its `session_id` from the stdin payload to the
   state-dir marker `<slug>.main-session` (see "State directory" above),
   overwriting any stale marker from a previous session.
2. `PreToolUse` hooks like plan-gate compare their own stdin `session_id`
   against the marker. Match → main thread. Mismatch → subagent.
3. `fellowship-session-end` removes the marker on graceful shutdown,
   guarded by session_id so a concurrent session's marker is never
   stomped (see failure-mode table below).

The atomicity claim: per Claude Code's lifecycle, the main thread's
`SessionStart` fires before any tool call that could dispatch a subagent.
The marker is therefore always in place before any subagent's `PreToolUse`
can run.

### Failure modes

| Scenario | Behavior | Cost |
| -------- | -------- | ---- |
| Crash before SessionEnd | Stale marker survives. Next SessionStart unconditionally overwrites with its own session_id. | None — overwrite resolves it. |
| Two `claude` sessions in same project dir | Whoever's SessionStart runs second overwrites. First session's plan-gate sees a marker that doesn't match its session_id and treats its own subagents as main (fail-open). SessionEnd is guarded by session_id, so the older session does NOT delete the newer session's marker on shutdown. | First session's plan-gate fails open silently for the rest of its life. Voice hook unaffected (SessionStart doesn't fire in subagents). |
| Subagent PreToolUse runs before main ever wrote a marker | Tier 1 catches it if `agent_id`/`agent_type` is populated. Otherwise treated as main → plan-gate silent. | Plan-gate fails open. Documented v1.0 posture. |
| Marker file empty (zero bytes) | `isSubagentContext` returns false — can't differentiate, so treat as main. Next SessionStart overwrites with a real session_id. | Plan-gate fails open once. |
| Marker file unreadable / corrupted (permissions, partial write, etc.) | Read throws → caught → treated as main (false negative). Tier 1 still catches the subagent if `agent_id`/`agent_type` is populated. | Plan-gate fails open. |
| `CLAUDE_PROJECT_DIR` not set, `cwd` differs across hook invocations | Project slug differs per invocation → marker keyed under a different name; subagent reads a missing marker → treated as main. | Plan-gate fails open. Tier 1 still catches the subagent if `agent_id`/`agent_type` is populated. |
| State dir uncreatable (read-only home, permissions, `CLAUDE_CONFIG_DIR` pointing at a file) | All marker writes skipped — NO fallback into the project tree. Reads behave as "marker missing" → treated as main. Opener treats every session as first. | Plan-gate fails open; opener stays silent. Tier 1 still catches subagents if populated. |
| SessionEnd payload has no session_id (malformed, crash-on-exit) | `clearMainSessionMarker` no-ops — won't delete a marker it can't verify ownership of. | Marker survives until next SessionStart overwrites it. |
| Slug collision — distinct project paths mapping to one slug (`/a/b` vs `/a-b`) with concurrent sessions | Both projects share one `<slug>.main-session`; the later SessionStart overwrites it, and the earlier project's main thread then reads a mismatch and is classified as *subagent* — a false **positive**, the one mode that inverts the treat-as-main posture. | Plan-gate disabled silently for the earlier session's remainder. Probability negligible (Claude Code's own `~/.claude/projects` slugging carries the identical collision); accepted, no code change. |

The conservative posture is on the *false negative* side: when in doubt,
treat as main. Plan-gate's v1.0 contract is fail-open, so a false negative
becomes a missed warning, not a regression. Tier 1 (`agent_id`/`agent_type`)
covers the gap whenever Claude Code chooses to populate those fields.

### Empirical verification: FELLOWSHIP_HOOK_DEBUG=1

The shared module exports `debugLogIfEnabled(hookName, payload)`. Every hook
calls it. When `FELLOWSHIP_HOOK_DEBUG=1` is set in the environment, each
invocation appends a JSON record to `/tmp/fellowship-hook-debug.log` with:

- timestamp, hook name, pid, ppid, cwd
- the keys present on the stdin payload, plus `session_id`,
  `hook_event_name`, and `transcript_path`
- every CLAUDE-prefixed env var visible to the hook
- the marker path, whether the marker exists, and its current value

Use this to verify the mechanism in a fresh Claude Code release, or to
investigate any future regression. The log file is plain JSONL — one record
per line, easy to grep and diff.

### Plan-gate scope note

Plan-gate previously aimed at Gimli specifically (its docstring still names
him). Without an agent-identity signal, the new shared mechanism can only
answer "is this a subagent at all?" — not "is this Gimli?". In practice
Gimli is the only Fellowship companion expected to run plan-gated tasks, and
the file-presence check (`gimli-plan-*.md`) works regardless of which agent
is dispatching. Documented behavior change: the gate now fires for *any*
subagent that edits without a plan file, not Gimli alone. Fail-open posture
unchanged — still v1.0 — so the worst case is a slightly broader stderr
warning, not a regression.

## Cross-platform polyglot

`run-hook.cmd` is a single file that acts as both a Windows batch script and
a Unix bash script. The leading `: << 'CMDBLOCK'` is a no-op on bash; on
Windows, cmd.exe runs the batch portion through `@echo off`. The bash portion
follows after `CMDBLOCK`.

Hook scripts use extensionless filenames (e.g. `fellowship-voice-session-start`,
not `fellowship-voice-session-start.sh`) because Claude Code's Windows
auto-detection prepends `bash` to any command containing `.sh`, which would
double-invoke the wrapper.

Both branches of `run-hook.cmd` carry the same allowlist of registered hook
names. Updating one without the other will silently break the hook on the
other platform. When adding a new hook: register it in `hooks.json`, add it
to both allowlists in `run-hook.cmd`, then create the `.mjs` and wrapper.
