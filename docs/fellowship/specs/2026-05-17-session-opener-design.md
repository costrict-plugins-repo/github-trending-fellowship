---
name: session-opener-design
status: active
created: 2026-05-17
type: design-spec
implementer: Gimli (hook implementation), Pippin (hook unit test)
companion: Sam (hooks.json wiring review)
---

# Session Opener — Design Spec

> **Superseded detail (2026-06-11):** this spec places the history marker at the project root (`.fellowship-session-history`, gitignored). Markers now live outside the project tree at `${CLAUDE_CONFIG_DIR:-~/.claude}/fellowship/state/<slug>.session-history` — see `hooks/README.md` § State directory. The opener's gating logic is unchanged.

How Gandalf's first response in a returning Fellowship session opens with project state — *where we left off, what to tackle next, a welcome* — before addressing the user's prompt. Extension of the voice persistence work; same SessionStart hook surface, distinct concern.

## Problem

Today, Claude Code does not speak first. The user opens a session in a Fellowship-set-up project, has to type something to trigger Gandalf's first response, and typically types an orientation prompt (*"where are we?"*, *"continue"*, *"what's next?"*) just to get the survey back. The friction is real with a growing quest log, multiple in-flight memory threads, and nine companions — orientation has measurable cost on every return.

The voice persistence work (`5a4e40a`, 2026-05-16) made Gandalf carry his register from turn 1. The opener is the complementary work: make turn 1 itself carry the orientation, so the user no longer has to ask.

## Constraints

Three constraints shape the mechanism. All three derived from voice-persistence work or Claude Code hook docs:

1. **Claude Code does not speak unsolicited.** No hook event triggers a model response without user input. SessionStart injects context; UserPromptSubmit requires a user prompt. The opener cannot be "Claude speaks first" in the literal sense — only "Gandalf leads with status on his first response, whatever the user types."
2. **SessionStart fires for main-thread sessions only.** Per `hooks/lib/subagent-detection.mjs`, the documented behavior. Subagent context is not in scope — companions do not open with status; only Gandalf does.
3. **First sessions in a project have nothing to recap.** A marker is needed to distinguish *first session ever in this project* from *returning session* — otherwise the opener fires on greenfield Claude with no useful content to surface.

## Decision

**Two-layer mechanism, parallel to voice persistence:**

### Layer 1 — Marker file gates opener activation

A small file `.fellowship-session-history` at the project root records that a Fellowship SessionStart has run in this project. v1 contents: a single JSON object recording the last-session timestamp. Existence is the signal; the timestamp is optional context the opener may use.

**Lifecycle:**
- *First SessionStart in project:* marker absent → opener hook creates the marker (writes current timestamp), skips opener output, exits 0.
- *Subsequent SessionStarts:* marker present → opener hook reads the timestamp, computes opener content, emits the additionalContext, updates the marker timestamp.

**Why a separate file rather than reusing `.fellowship-main-session`:** the existing marker has a different lifecycle — created by SessionStart, deleted by SessionEnd, scoped to a single session's lifetime. The opener marker is a *history* marker — never deleted, only updated. Conflating them breaks both.

**Gitignored** so the marker stays project-local and does not pollute other developers' clones.

### Layer 2 — SessionStart hook injects status as additionalContext

A new hook `hooks/fellowship-opener-session-start.mjs` registers on SessionStart alongside the existing voice hook. When the marker is present, it:

1. Computes recent commits — `git log --oneline -5`.
2. Computes open quest-log items — first three lines matching `^- \[ \]` in `docs/fellowship/quest-log.md`.
3. Computes in-flight project memories — `description:` field from `description:` frontmatter of files matching `memory/project_*.md` (up to five).
4. Emits structured additionalContext with an instruction to Gandalf to open his first response with a brief orientation in his register, drawing from the content sections.

The hook's output concatenates with the voice hook's output in additionalContext. Order is determined by `hooks.json` registration order; both are SessionStart hooks producing stdout that Claude Code combines.

### Layer 3 — Format is voice-derived, not template-derived

The hook injects CONTENT and an INSTRUCTION. Gandalf's first response transforms both into voice: three short observations — welcome, what was left off, what to tackle next — then he addresses the user's actual prompt. No bullet template, no headers in the response. The opener IS Gandalf voice applied to status.

The exemplar to study (composed):

> *"The voice work landed in your absence — both Gandalf v1 and the nine-companion sweep. Two threads sit open: workflow templates is the brainstorm waiting, the opening message is what we built last. The road forward is workflows; I would start there."*

Three short clauses, weight at the end. Then the next paragraph addresses whatever the user actually typed.

## Hook contract

**Location:** `hooks/fellowship-opener-session-start.mjs` (new file), with `hooks/fellowship-opener-session-start` shim if the existing run-hook.cmd pattern requires it.

**Stdin payload:** Standard SessionStart payload — `session_id`, `transcript_path`, `hook_event_name`. The hook also checks the `agent_id`/`agent_type` fields defensively — though SessionStart does not fire in subagent context per the documented lifecycle, the same belt-and-braces pattern as `fellowship-voice-session-start.mjs` applies (bail if agent fields are present).

**Stdout (additionalContext):** structured prose framed by `# Session Continuation — Open With Status` heading and concluded with `## Recent commits`, `## Open quest-log items`, `## In-flight project memories` sections.

**Output budget:** ~2 KB is *soft guidance*, not a hard ceiling. The instruction prose (~470 bytes) is fixed overhead and stays full-strength — it is what shapes Gandalf's opener voice, and trimming it to save bytes weakens the thing the opener exists to do. Per-line truncation is bounded (commit subjects 80 chars; quest-log and memory lines 200 chars; caps of 5/3/5 items). Measured output against this project: **2056 bytes** (Frodo's call, 2026-05-22 — accept and document the ceiling rather than tighten). Worst case (five long commits, three maxed quest lines, five maxed memory descriptions) runs further past 2 KB; acceptable. If the opener ever proves too heavy in practice, the lever is capping memory to 3 entries — the least load-bearing section — not cutting the instruction.

**Exit contract:** fail-silent on every error path. Permissions, missing git, missing quest log, missing memory directory — all degrade to "emit nothing, exit 0." A broken opener must never break a session.

**Marker resolution:**
- Default location: `$CLAUDE_PROJECT_DIR/.fellowship-session-history` (or `process.cwd()` fallback, same pattern as `markerPath()` in `subagent-detection.mjs`).
- File format v1: `{"last_session_ended": "2026-05-17T22:14:00Z"}` — single key, ISO 8601 timestamp. Empty file also acceptable as "marker exists, no metadata."
- Future evolution: may carry recent-session count or a "last status snapshot" if useful for the opener; out of scope for v1.

## Composition with voice hook

Both hooks register on SessionStart. Both emit to stdout. Claude Code concatenates their output as a single additionalContext block.

**Order:** the voice hook should run first (its output sets register); the opener hook runs second (its output instructs Gandalf to open in that register with status). Order is set in `hooks.json` by listing the voice hook before the opener.

**Subagent guard:** both hooks bail in subagent context (the documented agent fields, plus the marker-file mechanism for belt-and-braces). Companions never open with status — they report per their own contract.

## Scope

**IN:**
- New hook file `hooks/fellowship-opener-session-start.mjs` + shim.
- `hooks/hooks.json` updated to register the new hook on SessionStart.
- `.gitignore` updated to exclude `.fellowship-session-history` if the file is not already covered by existing patterns.
- Unit test: `hooks/test-opener-session-start.mjs` (or similar) — tests marker create-on-absent, output-on-present, fail-silent on missing git/quest log/memory.
- Documentation update: `hooks/README.md` adds a section on the opener hook alongside the voice hooks.

**OUT:**
- *Live status snapshot at SessionEnd.* v1 derives state fresh each SessionStart from git + quest log + memory. SessionEnd snapshotting is a v2 idea.
- *Configurable opener content.* The three content sections (commits, quest log, memory) are fixed in v1. No env-var-driven content toggles.
- *Per-user disable.* No mechanism to suppress the opener for a specific user. If needed in practice, add in v2.
- *Updates to `skills/using-fellowship/references/opening-examples.md`.* The voice register guidance there remains accurate; adding continuation-session examples is a content-refresh task for after the hook lands and shapes a few real openers.
- *Workflow-aware opener content.* Once workflow templates ship, the opener can include "active workflow: feature-flow, next step: Legolas." That extension lands with the workflow work, not here.

## Considered and rejected

**Always-on opener (no marker gate).** Simpler, but produces noise on first sessions in fresh projects where there is no project state to recap. Frodo's call: gate on continuation.

**Conditional on first-message shape.** Open status only when the user's first message is open-ended. Brittle (classification of user intent is unreliable), and asymmetric with the marker mechanism Frodo wanted. Rejected.

**Slash command opt-in (`/fellowship:status`).** Reliable but adds a keystroke step every time orientation is needed — exactly the friction the opener was meant to remove. Rejected.

**Merge into the voice hook.** Cleaner from a "one hook per event" standpoint but risks regression on a validated-and-shipped hook (voice persistence vp003 PASS). Separate hooks preserve isolation. Rejected for v1; may be merged later if maintenance proves the duplication costly.

**Marker carries last-status snapshot written by SessionEnd.** Richer opener prose ("you last worked on this 4 hours ago, the auth thread was open"), but adds state to maintain and a SessionEnd write path. v1 derives fresh from git + quest log + memory — always accurate. Marker carries timestamp only.

## Risks and unknowns

**Order of SessionStart hook output.** Two SessionStart hooks emitting context — Claude Code's concatenation order matters because voice register should land before the opener instruction. Verify empirically in the implementation phase that `hooks.json` registration order maps to output order, or adjust if not.

**Marker drift across machines.** If Frodo works on this project across two machines (laptop + desktop), each maintains its own `.fellowship-session-history`. First session on each machine fires "no opener" silently. Acceptable cost; alternative is syncing the marker, which is more complexity for marginal benefit.

**Stale state in the opener.** Recent commits read from `git log` are always current. Quest-log open items depend on the quest log being current — same staleness risk as today. In-flight memories depend on memory descriptions being kept current. The opener inherits the staleness profile of the data it reads; not a new risk, but worth marking.

**Verbosity on tiny first messages.** When the user opens Claude and types *"hi"*, the response carries a status paragraph plus a hello. Verbose by design. The voice persistence pattern protects against drift but does not protect against the user finding the opener tedious. If feedback says it is too much, the opener can be tightened in content (one observation instead of three) or made conditional (slash command opt-out flag in marker file).

## Open items

- Whether the opener should ever update its own marker timestamp atomically with reading it, or whether read-then-write race is acceptable. (Race is acceptable for v1; this is a single-user single-session scenario.)
- Whether the `description:` extraction from memory files should be regex-based or YAML-parsed. Regex is simpler; the frontmatter is small and shallow. Pick regex for v1.
- Whether to truncate long commit subjects in the opener content. Cap at 80 chars per commit line; truncate with ellipsis.

## Next moves

1. Invoke `fellowship:planning` to produce the implementation plan: hook code, marker logic, hooks.json wiring, .gitignore update, unit test, README section.
2. Plan tier: Tier 2 (one companion — Gimli for the hook code; optional Pippin for the test).
3. Implement, validate, commit.
