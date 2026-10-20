---
name: transport-agnostic-dispatch
status: implemented
implemented_by: gimli
created: 2026-06-11
author: gandalf
type: spec
---

# Transport-Agnostic Dispatch — Deference Rule + Handoff File Contract

Fellowship's biggest live-usage pain (Frodo, 2026-06-11): Tier 2+ dispatches serialize through the main session — the user waits on every build, then waits again on every review. Parallel, observable transports exist (herdr splits, tmux panes, Conductor workspaces, native agent teams), but Fellowship has no doctrine for using them.

This spec settles the doctrine. Brainstorm happened in-conversation 2026-06-11; decisions below are Frodo's calls, recorded with rationale.

## Decisions

### D1. Inversion of control — Fellowship carries NO per-terminal adapters

Fellowship never encodes how to drive herdr, tmux, Conductor, or any other environment. The environment owns its panes and announces its own capabilities into the session:

- herdr ships a session skill (active when `HERDR_ENV=1`)
- Conductor ships a session skill in its app bundle and injects its own system prompt
- tmux is signaled by `$TMUX` and is in every model's native competence
- future wrappers announce themselves the same way, with no Fellowship change

**Rationale.** Per-terminal adapters are an unbounded maintenance debt — every wrapper's API chased forever. Deference puts the burden where the incentive lives: a wrapper that wants Fellowship dispatches in its panes ships instructions saying how. Fellowship works everywhere today and improves wherever the host is generous.

### D2. Dispatch intent is stated neutrally

A Tier 2+ dispatch expresses *what*, never *how*: "this dispatch wants a parallel, observable session running `claude --agent fellowship:<name>` with this brief; the report lands at this handoff path." Transport selection follows the deference rule (D3).

### D3. The deference ladder

At dispatch time, in order:

1. **Environment-provided instructions.** If the session context carries instructions or skills for managing sessions, panes, tabs, or workspaces (herdr skill, Conductor skill/prompt, `$TMUX`), use them. Prefer the most observable transport on offer.
2. **Native agent teams** (experimental; companion definitions are valid teammate roles). Costs marked honestly: opt-in env flag, ~3–4× tokens, no teammate session resume.
3. **Background task** (today's behavior).
4. **In-session dispatch** — the floor, and the *correct* answer for Tier 1–2 work regardless of environment: cheap, fast, no ceremony.

A bare terminal landing on rungs 2–4 is not a degraded mode; it is the right answer for that environment.

### D4. The handoff file contract is the protocol; panes are presentation

`docs/fellowship/handoffs/` is formalized as the dispatch protocol:

- **Brief in:** the orchestrator writes `handoffs/<date>-<quest-slug>-brief.md` before spawning (task, files_to_read, validation-contract assertions in scope, report path).
- **Report out:** the companion writes `handoffs/<date>-<quest-slug>-report.md` as its final act, carrying the standard status vocabulary (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED, reviewer extensions APPROVED / APPROVED_WITH_CONCERNS).
- **Observation is filesystem-based.** The orchestrator (or the user) watches for the report file. Any transport that can run a command and let a file land is conformant — including transports that do not exist yet.

In-session and background dispatches may keep returning reports in-band (the report file is additive, not a replacement, for rungs 3–4 where the harness already delivers results).

### D5. Cross-worktree observability (the Conductor wrinkle)

Verified 2026-06-11: Conductor exposes documented `conductor://` deep links (`prompt=&path=` pre-fills the Dispatcher; `async?repo=&plan=<base64>` creates a workspace with an attached plan, fire-and-forget), detection via `CONDUCTOR_WORKSPACE_NAME` / `CONDUCTOR_WORKSPACE_PATH`.

A workspace created this way is a separate git worktree — its handoff report lands in *that* checkout, not the orchestrator's. Doctrine: when a dispatch crosses a worktree boundary, the companion's commit contract (using-worktrees) carries the report — the orchestrator observes through the workspace branch (`git log <branch> -- docs/fellowship/handoffs/`), not its own working tree. This is doctrine text, not tooling; no watcher scripts in v1.

### D6. Worktree stand-down composes with this spec

The using-worktrees stand-down guard (quest 2026-06-11): a session already inside a managed worktree (`.claude/worktrees/` ancestor, or `git rev-parse --git-common-dir` ≠ `--git-dir`) never nests another. Pre-isolated environments (Conductor) therefore dispatch in-place.

## Out of scope

- Tier-threshold recalibration (separate quest; follows once transport economics are live).
- Deep agent-teams integration beyond naming it as ladder rung 2 (separate quest).
- Any per-terminal adapter, watcher daemon, or polling tooling.

## Implementation surface

1. `skills/using-fellowship/SKILL.md` — dispatch section gains the deference ladder (D1–D3) and the handoff contract pointer (D4). Keep it short; the ladder is four lines, not a chapter.
2. `skills/using-fellowship/references/workflows.md` — recipes reference the transport rule once (not per-recipe); composition rule for parallel branches names the handoff contract.
3. New `skills/using-fellowship/references/dispatch-transport.md` — the full doctrine (this spec's D1–D6 in operational form): brief/report file shapes, the ladder with environment signals, the cross-worktree observation rule.
4. `docs/fellowship/handoffs/` — ensure the directory exists in the bootstrap (`/fellowship:start`) scaffolding list if not already present.

No hook changes. No new status codes. No schema files.
