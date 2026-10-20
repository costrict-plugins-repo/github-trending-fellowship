# ADR: Worktree-aware companions

**Status:** Proposed
**Date:** 2026-04-26
**Decider:** Merry (technical) + Frodo (final call on skill-vs-shared-paragraph and on merge-back ownership)

## Context

`skills/using-fellowship/SKILL.md:72` instructs Gandalf to use `isolation: "worktree"` on every parallel dispatch. Zero of the nine agent files mention worktrees (`grep -c worktree agents/*.md` → 0 — confirmed in `2026-04-26-comparison-architecture.md` §6). The mismatch produced the failure modes this session surfaced:

- **Bilbo's edits were stuck** in his worktree until the orchestrator manually merged. Bilbo did not know to commit; the orchestrator did not know edits were stranded.
- **Sam's worktree disappeared** mid-quest. No agent contract names worktree lifetime or who cleans up.
- **Gimli executed against `main`** instead of his worktree. Without a `pwd` check at start, Gimli inherited the main tree's CWD and edited there.

Two existing assets are visible in `.claude/worktrees/agent-a817018d41e2ca68c` and `.claude/worktrees/agent-ad0cc5000ade8ffe1` — orphans from prior dispatches. Both gitignored (`comparison-cleanliness.md:113` confirms). Superpowers ships `using-git-worktrees/SKILL.md` (`examples/superpowers/skills/using-git-worktrees/SKILL.md:1-50`) covering directory selection, gitignore verification, baseline test verification — patterns we have not adopted.

This ADR locks the contract.

## Minimum awareness every agent needs

Three facts every dispatched agent must establish at start:

1. **Where am I?** Run `pwd` and `git rev-parse --show-toplevel` first thing. If `pwd` matches a path under `.claude/worktrees/` or `~/.config/fellowship/worktrees/`, the agent is in a worktree. If it matches the project root, the agent is in main. If they disagree (cwd outside the toplevel), abort and report `BLOCKED` — the dispatch context is corrupted.
2. **What branch?** Run `git rev-parse --abbrev-ref HEAD`. Worktree dispatches land on a branch named for the dispatch (e.g., `agent-a817018d41e2ca68c`). Main dispatches land on `main` (or whatever the project's main branch is). Either is valid; the agent must *know* which it has.
3. **Commit contract.** In a worktree, the agent commits its work locally before reporting DONE. In main, the agent does not commit (orchestrator owns main commits). The DONE report includes the branch name and the commit SHA when in a worktree.

This is the floor. Specific agent classes layer additional rules on top.

## Per-class behaviors

### Builders — Gimli, Pippin, Sam, Bilbo, Arwen

- Run the three startup checks before any Edit/Write.
- If in a worktree: edit freely, commit at end with a structured message (`<agent>: <task slug>`), report the SHA and branch.
- If in main: edit only the files explicitly named in the dispatch, do not commit, report file paths.
- If the worktree lacks expected files (`docs/fellowship/specs/` missing because the worktree was cut from a stale branch), report `NEEDS_CONTEXT`. Do not invent the path.

### Reviewers — Legolas, Boromir

- Read-only by tool scoping; the worktree contract is informational only.
- If they need to leave annotations, write to `$CLAUDE_SCRATCHPAD_DIR/<agent>-review-<slug>.md`. The scratchpad is outside the worktree (it lives at `/tmp` or wherever Claude Code resolves it) — the artifact survives worktree removal.
- Reviewers report findings in their report, not by editing files. The merge-back contract does not apply to them.

### Researchers — Aragorn, Merry

- Write specs to `docs/fellowship/specs/`. **In a worktree, that path exists** (the worktree is a full checkout) but the spec only reaches main when the worktree merges back. This is the merge-back problem (see below).
- For research dispatches that produce a spec the orchestrator needs *immediately*, dispatch in main, not in a worktree. Worktrees are for parallel-with-builders; sequential research is faster in main.
- If dispatched in a worktree anyway, commit the spec and report the SHA — the orchestrator merges.

## The merge-back contract

**Today:** falls to the orchestrator (Gandalf) as a manual step after every DONE. Brittle — Gandalf forgets, edits strand. Bilbo's session this week is the proof.

**Proposed:** *agent commits in the worktree, orchestrator merges*. Specifically:
1. Agent commits all its work before reporting DONE.
2. Agent's report includes `Branch: <branch>` and `Commit: <sha>` lines.
3. Orchestrator's verification step: `git merge --no-ff <branch>` (or cherry-pick if the branch has unrelated commits), then `git worktree remove <path>`.
4. If two parallel branches both touched the same file, the merge surfaces the conflict — orchestrator resolves before next dispatch.

**Frodo's call:** should the orchestrator merge eagerly (right after DONE, before next dispatch) or lazily (at the end of the quest)? Eager is safer (catches conflicts immediately); lazy is faster (one merge for the quest, not N). Recommend eager for v1.0 — we are still learning what conflicts look like.

## Failure modes mapped to contract

| Session failure | Contract that prevents it |
|---|---|
| Bilbo's edits stuck in worktree | Agent commits before DONE; report includes SHA; orchestrator merges as part of verification. |
| Sam's worktree disappeared | Worktree lifetime is documented: orchestrator removes after merge, never mid-flight. If Sam is mid-edit and the worktree vanishes, that is an orchestrator bug, surfaced by the `pwd`/`git rev-parse` startup check failing. |
| Gimli executed against main | Startup check rule 1: `pwd` + `git rev-parse --show-toplevel` first. If the dispatch said worktree but `pwd` is main, Gimli reports `BLOCKED` — does not silently edit main. |

## Implementation — skill or shared paragraph?

**Option A — `skills/using-worktrees/SKILL.md`.** A dedicated skill (Superpowers's pattern). Loaded by builders as needed. Lower context cost per dispatch (only loaded when relevant). Higher discoverability cost (an agent who doesn't know to load it won't).

**Option B — paragraph in `agents/_shared/companion-protocol.md`.** Read by every dispatch. Floor-level awareness for everyone. Higher context cost (every dispatch carries it). Lower discoverability cost (no agent can miss it).

**Recommendation: both, layered.** A two-line floor in `companion-protocol.md` ("Run `pwd` and `git rev-parse --show-toplevel` at start. If in a worktree, commit before DONE and include branch+SHA in report. Full mechanics: `skills/using-worktrees/SKILL.md`.") plus a full skill that builders load when they need directory selection, baseline verification, and clean-up patterns. The floor catches every agent; the skill carries the depth. This mirrors the existing pattern — `companion-protocol.md` for the universal rule, references for the depth.

Adopting Superpowers's `using-git-worktrees/SKILL.md` directly is a candidate; it covers ~80% of what we need (directory selection, gitignore verification). We would need to add the merge-back contract and the report-format integration — Superpowers has neither because they don't have a multi-agent dispatch model.

## Recommendation

1. Add the floor paragraph to `agents/_shared/companion-protocol.md` for v1.0.
2. Adopt Superpowers's `using-git-worktrees` as `skills/using-worktrees/`, then layer the Fellowship-specific merge-back contract onto it. v1.0 if scope allows; v1.0.1 if not.
3. Lock eager-merge as the default. Revisit lazy-merge in v1.1 once we have data.
4. Update Gandalf's dispatch protocol: when isolation is `worktree`, append the floor paragraph to the prompt; when isolation is `none` (main), skip it.
