# Plan — Session Opener

> **Superseded detail (2026-06-11):** marker locations in this plan refer to the project root; markers now live at `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/` — see `hooks/README.md` § State directory.

**Date:** 2026-05-17
**Design spec:** `docs/fellowship/specs/2026-05-17-session-opener-design.md`
**Predecessor:** `docs/fellowship/plans/2026-05-16-voice-persistence.md` (Gandalf v1) and `docs/fellowship/plans/2026-05-17-per-companion-voice.md` (per-companion voice)

## Goal

Make Gandalf's first response in a returning Fellowship session open with *where we left off, what to tackle next, a brief welcome* — before addressing the user's prompt. New SessionStart hook injects content + instruction; voice persistence carries the register.

## Key decisions from brainstorming

- **Continuation-marker gate** — `.fellowship-session-history` file at project root. Absent → first session in this project, opener skipped. Present → opener fires. Gitignored.
- **Separate hook, not merged** — `hooks/fellowship-opener-session-start.mjs` registers on SessionStart alongside the voice hook. Voice hook validated; don't touch it.
- **Content surface, computed at SessionStart:** recent commits (`git log --oneline -5`), open quest-log items (top 3 `- [ ]` lines), in-flight project memories (`description:` from `memory/project_*.md`).
- **Voice-derived format** — hook injects content + instruction; Gandalf produces the opener in his register as three short observations.
- **Fail-silent contract** — any error path exits 0 with no output. A broken opener must never break a session.

## Tech stack

- Node.js (`.mjs`), fail-silent, invoked via `hooks/run-hook.cmd`.
- `$CLAUDE_PROJECT_DIR` fallback to `process.cwd()` for marker path (same pattern as `hooks/lib/subagent-detection.mjs`).
- `child_process.spawnSync` for `git log` (avoid the `Bash` tool dependency; this is a hook, not an agent).
- File I/O via `node:fs`.

## Tier recommendation

**Tier 2 — one companion.**

Dispatch Gimli for the hook implementation. Single-file change with a clear contract (existing hook patterns at `hooks/fellowship-voice-session-start.mjs`, `hooks/fellowship-session-end.mjs`, `hooks/lib/subagent-detection.mjs` provide the shape). Legolas review after for the fail-silent paths and the marker-file lifecycle. No Pippin dispatch in v1 — the hook is testable manually via `FELLOWSHIP_HOOK_DEBUG=1` and a fresh-session probe; full unit test deferred to v1.1 alongside the other untested hooks already on the quest log.

---

## File map

**Created:**
- `hooks/fellowship-opener-session-start.mjs` — the hook body.
- `hooks/fellowship-opener-session-start` — shell shim (if `run-hook.cmd` dispatch pattern requires it; check existing wrappers).

**Modified:**
- `hooks/hooks.json` — register the new hook on SessionStart, after the voice hook.
- `.gitignore` — add `.fellowship-session-history` if not already covered (likely needs an entry).
- `hooks/README.md` — document the opener hook alongside the voice hooks.
- `docs/fellowship/quest-log.md` — mark the session-opener entry done once committed.

---

## Quest Log

### Phase 1 — Implementation

1. ⬜ **Hook implementation** — Gimli. Write `fellowship-opener-session-start.mjs` per the spec contract: marker create-on-absent (silent), output-on-present, fail-silent on every error path, subagent guard via documented agent fields. Read `hooks/fellowship-voice-session-start.mjs` and `hooks/lib/subagent-detection.mjs` for the established patterns. Wire into `hooks.json` after the voice hook. Update `.gitignore` for the marker file.
2. ⬜ **Hook review** — Legolas. Focus areas: fail-silent on every error path (no exception leaks), marker write atomicity (don't corrupt the file on partial write), subagent guard, no I/O in the hot path beyond what the spec calls for, output budget (the additionalContext shouldn't bloat the context window).

### Phase 2 — Validation

3. ⬜ **Manual fresh-session validation** — Frodo. Open a fresh Claude Code session in this project. Confirm:
   - First session: marker created, opener does NOT fire (no status preamble in Gandalf's first response).
   - Second session: marker present, opener DOES fire — Gandalf's first response opens with three short observations (welcome, left-off, next), then addresses the user's prompt.
   - Marker timestamp updates on each session start.
4. ⬜ **README and quest log close** — direct work in-session. `hooks/README.md` documents the opener; `docs/fellowship/quest-log.md` marks the entry done; commit.

---

## Task detail

### Task 1: Hook implementation

**Assigned to:** Gimli.
**Depends on:** None — single-file new code.

**Files:**
- Create: `hooks/fellowship-opener-session-start.mjs`
- Create: `hooks/fellowship-opener-session-start` (shim if convention requires)
- Modify: `hooks/hooks.json` (add SessionStart entry)
- Modify: `.gitignore` (add `.fellowship-session-history` line)

**What to build:**

A SessionStart hook per the design spec at `docs/fellowship/specs/2026-05-17-session-opener-design.md`. The hook:

1. Reads stdin payload via `readStdinPayloadSync()` from `hooks/lib/subagent-detection.mjs`.
2. Bails (exits 0 silently) if `agent_id` or `agent_type` is present (defensive — SessionStart should not fire in subagent context per docs, but match the existing voice hook's belt-and-braces).
3. Resolves marker path: `$CLAUDE_PROJECT_DIR/.fellowship-session-history` (fall back to `process.cwd()`).
4. *Marker absent:* writes `{"last_session_ended": "<ISO 8601 now>"}` to the marker, exits 0 with no stdout.
5. *Marker present:* reads it (best-effort, ignore parse errors), computes:
   - `git log --oneline -5` via `spawnSync` (cwd = project dir, timeout small).
   - Top 3 `- [ ]` lines from `docs/fellowship/quest-log.md` (regex match; cap each line at ~200 chars).
   - `description:` field from up to 5 `memory/project_*.md` files (regex on YAML frontmatter; resolve memory path via `~/.claude/projects/<slug>/memory/` using project slug computed from `$CLAUDE_PROJECT_DIR`).
6. Emits stdout structured per the spec — heading, instruction prose, three content sections.
7. Updates marker timestamp.
8. Exits 0.

**Acceptance criteria:**
- [ ] Marker create-on-absent path exits 0, writes the file, emits no stdout.
- [ ] Marker present path emits structured additionalContext to stdout, exits 0.
- [ ] Subagent guard fires when `agent_id` or `agent_type` is present.
- [ ] Every error path (missing git, missing quest log, missing memory dir, marker write failure, etc.) is caught and exits 0 silently.
- [ ] No unhandled exceptions reach the process.
- [ ] `hooks.json` lists the new hook on SessionStart AFTER the voice hook (registration order matters per spec).
- [ ] `.gitignore` excludes `.fellowship-session-history` (or confirms an existing pattern covers it).

**Verification:**
- Manual: run the hook directly with sample stdin — `echo '{"session_id":"test"}' | node hooks/fellowship-opener-session-start.mjs` — and inspect stdout. Should be empty on first run, structured on second run.
- Manual: `FELLOWSHIP_HOOK_DEBUG=1` exercises the debug log path via `debugLogIfEnabled` if the lib helper is used.

**Notes:**
- Read `hooks/fellowship-voice-session-start.mjs` for the established hook pattern (stdin payload, subagent guard, fail-silent exit).
- Read `hooks/lib/subagent-detection.mjs` for `readStdinPayloadSync`, `markerPath`-style resolution, and `debugLogIfEnabled`.
- Memory path resolution: the project slug is the encoded form of the project path. `$CLAUDE_PROJECT_DIR=/Users/Karolus/projects/Fellowship` maps to `~/.claude/projects/-Users-Karolus-projects-Fellowship/memory/`. If this slug derivation feels fragile, fall back to globbing `~/.claude/projects/*/memory/project_*.md` and matching the project dir from a sentinel — or simply skip the memory section and log a debug message. Memory inclusion is best-effort.
- Output budget: the full additionalContext should be under ~2 KB to stay well within the context budget. Truncate long commit subjects to 80 chars, long quest-log lines to ~200 chars.

### Task 2: Hook review

**Assigned to:** Legolas.
**Depends on:** Task 1.

**What to review:**
- Fail-silent contract on every error path. No `throw` reaches the process.
- Marker write atomicity. If the write fails partway, the file should not be corrupted (write-then-rename pattern preferred over write-in-place).
- Subagent guard. Documented `agent_id`/`agent_type` fields checked correctly.
- Output budget. additionalContext should be bounded; verify the truncation logic.
- Code quality per Legolas's standard lens.

**Acceptance criteria:**
- [ ] Status: APPROVED or APPROVED_WITH_CONCERNS with no Critical findings.

### Task 3: Manual fresh-session validation

**Assigned to:** Frodo (in-session work).
**Depends on:** Task 2 approved.

**What to verify:**
- Delete `.fellowship-session-history` if it exists (this is the first-session test).
- Open a fresh Claude Code session. Gandalf should NOT open with status — first session. Marker should be created.
- Close the session (or simply start another). Gandalf SHOULD open with status — second session. Marker timestamp should update.
- Open with a trivial prompt ("hi"). Confirm the opener still fires and is short.
- Open with a focused prompt ("fix the auth bug"). Confirm the opener fires before Gandalf addresses the bug.

**Acceptance criteria:**
- [ ] First-session-in-project does not produce an opener.
- [ ] Continuation sessions produce a short opener in Gandalf's register.
- [ ] Opener does not crash the session if git/quest-log/memory are missing.
- [ ] Marker timestamp updates on each continuation.

### Task 4: README and quest log close

**Assigned to:** Direct work in-session (or Bilbo if the README update warrants depth).
**Depends on:** Task 3 passed.

**What to do:**
- `hooks/README.md` — add a section describing the opener hook (purpose, marker file, content surface, fail-silent contract). Mirror the existing voice-hook section's structure.
- `docs/fellowship/quest-log.md` — mark the session-opener entry done.
- Commit with a message referencing the spec and the validation outcome.

**Acceptance criteria:**
- [ ] README section explains the hook in 2–3 paragraphs.
- [ ] Quest log entry marked closed.
- [ ] Commit message references both spec and plan paths.

---

## Execution notes

- **Reuse, don't reinvent.** The `subagent-detection.mjs` lib already provides `readStdinPayloadSync`, `markerPath`-style resolution, and `debugLogIfEnabled`. Use them. The opener marker is a *different* marker (history, not session-id), but the path-resolution and stdin-reading helpers apply.
- **Order matters in `hooks.json`.** Voice hook first, opener hook second. Verify empirically that this maps to stdout concatenation order in additionalContext; adjust if not.
- **Memory path resolution is the hairiest part.** The hook needs to find `~/.claude/projects/<slug>/memory/`. If the slug-derivation logic is brittle, accept best-effort: skip memory section, log debug, opener still fires with commits + quest-log content.
- **No tests in v1.** The hook is small enough to validate manually; full unit-test coverage is on the quest log already as "v1.1 — hook unit tests" for all four hooks together. Don't break that work into pieces here.

## Risks

- **`hooks.json` registration order may not map to stdout order.** Per the spec, this is an unknown to verify in implementation. If the order is wrong, the opener instruction lands before the voice context — Gandalf might open in default register, not his voice. Mitigation: if order is wrong, merge the opener output into the voice hook (back to the rejected "merge" option), accepting the small regression risk.
- **Memory path slug derivation.** If the `$CLAUDE_PROJECT_DIR` → memory-dir slug computation is wrong, the memory section silently empties. Acceptable; opener still has commits + quest log. Worth a Gimli verification step in implementation.
- **The opener annoys on tiny prompts.** "Hi" gets a status paragraph. If this proves tedious in practice, the opener can be tightened (one observation instead of three) in a v1.1 content-only revision — no mechanism change needed.
