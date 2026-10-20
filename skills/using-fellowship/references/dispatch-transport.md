# Dispatch Transport — Deference Ladder and Handoff Contract

How a Tier 2+ dispatch reaches a parallel, observable session — and how its report comes back. The doctrine has two halves: transport selection defers to the environment (the ladder), and the handoff file contract is the protocol regardless of transport. Settled in `docs/fellowship/specs/2026-06-11-transport-agnostic-dispatch.md`.

## Inversion of control — no per-terminal adapters

Fellowship never encodes how to drive herdr, tmux, Conductor, or any other environment. The environment owns its panes and announces its own capabilities into the session: a wrapper that wants Fellowship dispatches in its panes ships a skill or system prompt saying how. When an environment's instructions are present, they take over — Fellowship names the detection signals below and stops there.

Per-terminal adapters are unbounded maintenance debt — every wrapper's API chased forever. Deference puts the burden where the incentive lives. Fellowship works everywhere today and improves wherever the host is generous.

## Dispatch intent is stated neutrally

A Tier 2+ dispatch expresses *what*, never *how*: "this dispatch wants a parallel, observable session running `claude --agent fellowship:<name>` with this brief; the report lands at this handoff path." Transport selection follows the ladder.

## The deference ladder

At dispatch time, in order:

1. **Environment-provided instructions.** The session context carries instructions or skills for managing sessions, panes, tabs, or workspaces → use them. Prefer the most observable transport on offer.
2. **Native agent teams.** Experimental; companion definitions are valid teammate roles. Costs marked honestly: opt-in env flag, ~3–4× tokens, no teammate session resume.
3. **Background task.** Today's default behavior.
4. **In-session dispatch.** The floor — and the *correct* answer for Tier 1–2 work regardless of environment: cheap, fast, no ceremony.

A bare terminal landing on rungs 2–4 is not a degraded mode; it is the right answer for that environment.

### Environment signals (rung 1 detection)

| Environment | Signals |
|---|---|
| herdr | `HERDR_ENV=1` env var; herdr session skill active |
| Conductor | Conductor session skill / injected system prompt; `CONDUCTOR_WORKSPACE_NAME` and `CONDUCTOR_WORKSPACE_PATH` env vars; documented `conductor://` deep links (`prompt=&path=` pre-fills the Dispatcher; `async?repo=&plan=<base64>` creates a workspace with an attached plan, fire-and-forget) |
| tmux | `$TMUX` env var; pane management is native model competence |
| Bare terminal | none of the above → rungs 2–4 |

Signals are for *detection only*. How to split a pane, name a workspace, or address a session belongs to the environment's own instructions — never restate it here or in a dispatch.

## The handoff file contract

`docs/fellowship/handoffs/` is the dispatch protocol; panes are presentation.

- **Brief in.** The orchestrator writes `docs/fellowship/handoffs/<YYYY-MM-DD>-<quest-slug>-brief.md` *before* spawning. It carries: the full task, the `<files_to_read>` list, the validation-contract assertions in scope for this dispatch, and the report path.
- **Report out.** The companion writes `docs/fellowship/handoffs/<YYYY-MM-DD>-<quest-slug>-report.md` as its final act — the standard report format, carrying the standard status vocabulary: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED, with the reviewer extensions APPROVED / APPROVED_WITH_CONCERNS / CHANGES_REQUESTED.
- **Observation is filesystem-based.** The orchestrator (or the user) watches for the report file. Any transport that can run a command and let a file land is conformant — including transports that do not exist yet.

For rungs 3–4, where the harness already delivers results in-band, the report file is additive, not a replacement — in-session and background dispatches may keep returning reports in-band.

Session handoffs (`gandalf-<YYYY-MM-DD>-<slug>.md`, see `handoff-template.md`) share this directory but are a different artifact: context transfer between Gandalf sessions, not dispatch protocol. The `-brief` / `-report` suffixes keep the two apart.

### Brief shape

```markdown
## Task
[full task description — pasted, not pointed at]

## Files to read
[paths the companion must read at start — spec, prior reports, codebase map]

## Validation contract
[assertions in scope for this dispatch, with owner-validator tags — omit if the plan carries no contract]

## Report path
docs/fellowship/handoffs/<YYYY-MM-DD>-<quest-slug>-report.md
```

### Report shape

The companion's standard report format from its agent file — status line first, then what was built, files changed, verification output. No new fields, no new statuses.

## Cross-worktree observation (the Conductor wrinkle)

A workspace created via deep link is a separate git worktree — its handoff report lands in *that* checkout, not the orchestrator's. When a dispatch crosses a worktree boundary, the companion's commit contract (`skills/using-worktrees/SKILL.md`) carries the report: the orchestrator observes through the workspace branch —

```
git log <branch> -- docs/fellowship/handoffs/
```

— not its own working tree. This is doctrine, not tooling: no watcher scripts, no polling daemons.

## Worktree stand-down composes

A session already inside a managed worktree (`.claude/worktrees/` ancestor, or `git rev-parse --git-common-dir` ≠ `--git-dir`) never nests another — the using-worktrees stand-down guard. Pre-isolated environments (Conductor workspaces) therefore dispatch in-place: the environment already provided the isolation that `isolation: "worktree"` would have created.
