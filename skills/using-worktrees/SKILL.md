---
name: using-worktrees
description: Use when dispatched into an isolated git worktree (path under .claude/worktrees/) so parallel agent work does not collide on main — covers the startup checks, the builder commit contract, the orchestrator's eager merge, and the failure modes Fellowship has hit in practice.
user-invocable: false
---

# Using Worktrees

> Design rationale: [`docs/fellowship/specs/2026-04-26-adr-worktree-aware-companions.md`](../../docs/fellowship/specs/2026-04-26-adr-worktree-aware-companions.md)

## Overview

Gandalf isolates parallel agent work in git worktrees so two builders can edit at once without stepping on each other's commits. A worktree is a full checkout of the repository on its own branch, sharing the same `.git` directory as `main`. Fellowship places worktrees under `.claude/worktrees/agent-<hash>/` (gitignored) and names the branch to match the directory.

**Core principle:** the agent commits inside the worktree; the orchestrator merges back. Neither side does the other's job.

**Announce at start:** "I'm using the using-worktrees skill — running startup checks before any edits."

The floor (every dispatched agent, regardless of skill load) lives in [`agents/_shared/companion-protocol.md`](../../agents/_shared/companion-protocol.md#worktree-awareness). This skill carries the depth.

## When This Skill Loads

- A builder (Gimli, Pippin, Sam, Bilbo, Arwen) is dispatched with `isolation: "worktree"` and needs the full mechanics.
- A researcher (Aragorn, Merry) is producing an artifact the orchestrator will merge after DONE.
- Any agent surprised by their startup-check output (e.g., dispatch said worktree but `pwd` shows main).

If you are a reviewer (Legolas, Boromir), you do not commit and do not need this skill in depth — read the floor in `companion-protocol.md` and write annotations to `$CLAUDE_SCRATCHPAD_DIR/`.

## How Gandalf Dispatches Into a Worktree

Gandalf creates the worktree before invoking the agent:

```bash
hash=$(openssl rand -hex 8)
branch="agent-${hash}"
path=".claude/worktrees/${branch}"
git worktree add "$path" -b "$branch"
```

`.claude/worktrees/` is gitignored at the project root. The agent receives the worktree path as its working directory; nothing about the dispatch prompt itself names the worktree explicitly — the agent discovers its location with the startup checks.

## Startup Checks — Required Before Any Edit

Run these three commands, in this order, before the first Read/Write/Edit/Bash that touches project files:

```bash
pwd
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
```

Interpret:

| Output | Meaning |
|---|---|
| `pwd` is `<project>/.claude/worktrees/agent-<hash>` and toplevel matches | Worktree dispatch — proceed under the builder contract below. |
| `pwd` is the project root and branch is `main` | Main dispatch — edit only the files named in the dispatch, do not commit. |
| `pwd` is outside the toplevel | Corrupted dispatch context — report `BLOCKED`. |
| Dispatch prompt said worktree but branch is `main` | Wrong tree — report `BLOCKED`. Do not silently edit `main`. |

The most expensive failure this project has hit is a builder editing `main` directly while believing it was in a worktree. The startup checks exist to prevent it.

## Stand Down When Already Isolated

Before creating any worktree, check whether the session is already running inside one:

```bash
git rev-parse --git-common-dir   # differs from --git-dir when inside a worktree
git rev-parse --git-dir
```

If the two differ, or `pwd` has `.claude/worktrees/` as an ancestor segment, the session is already isolated. The `--git-common-dir` signal is generic — it also covers Conductor workspaces and any other wrapper that pre-isolates the checkout. Do not nest a worktree inside a worktree: dispatch in-place instead. Nesting double-isolates the same work, and the merge contract below has no path back from a worktree-within-a-worktree.

## The Builder Contract (Worktree)

Once you confirm you are in a worktree:

1. **Edit freely within the dispatch scope.** The whole tree is yours; the branch is named for this dispatch and lives until the orchestrator merges it.
2. **Verify before commit.** Run the project's tests or health check the same way you would on `main`. A worktree does not exempt you from the pre-DONE checklist.
3. **Commit before reporting DONE.** Use a structured message:

   ```bash
   git add <files-you-touched>
   git commit -m "<agent>: <task slug>"
   ```

   Stage by name, not `git add -A` — the worktree may contain artifacts from earlier dispatches you did not produce.

4. **Report branch and SHA.** Your DONE report must include:

   ```
   Branch: agent-<hash>
   Commit: <sha>
   ```

   Without these, the orchestrator cannot merge. An agent that finishes with uncommitted edits in the worktree has produced no merge-able output.

5. **Do not run `git worktree remove`.** Cleanup is the orchestrator's job. If you remove your own worktree, the orchestrator's merge step fails.

## The Orchestrator's Merge Contract

Eager merge is the v1.0 default — the orchestrator merges immediately after each DONE, before dispatching the next agent. This catches conflicts at the boundary they were created at, not at quest end when context has decayed.

After the agent reports DONE with `Branch:` and `Commit:`:

```bash
git merge --no-ff agent-<hash> -m "Merge <agent> work: <task slug>"
git worktree remove .claude/worktrees/agent-<hash>
```

If the merge surfaces a conflict (two parallel branches touched the same file), the orchestrator resolves before the next dispatch. This is by design — the conflict is a real disagreement that humans (or Gandalf) must arbitrate, not a problem to defer.

## Failure Modes (From This Session)

| Failure | Root cause | The contract that prevents it |
|---|---|---|
| Builder's edits stuck in worktree, never reached main | Agent did not commit; orchestrator did not know to merge | Builder commits before DONE; report includes SHA; orchestrator merges as part of verification. |
| Worktree disappeared mid-dispatch | Orchestrator removed it before merge, or before the agent finished | Orchestrator removes only *after* merge. Agent's startup checks fail loudly if the worktree vanishes mid-flight. |
| Agent edited `main` instead of its worktree | Agent skipped startup checks; CWD inherited from orchestrator's tree | Startup checks are mandatory. Mismatch (dispatch said worktree, `pwd` is main) is `BLOCKED`, not a silent edit. |
| Two parallel branches both touched the same file | Real concurrent edits | Eager merge surfaces the conflict immediately; orchestrator resolves before the next dispatch. |

## Quick Reference

| Situation | Action |
|---|---|
| `pwd` under `.claude/worktrees/agent-<hash>` | Builder contract: edit, commit, report Branch + Commit. |
| `pwd` is project root, branch `main` | Edit only dispatch-named files; do not commit; report file paths. |
| Dispatch said worktree but branch is `main` | Report `BLOCKED`. |
| `pwd` outside `git rev-parse --show-toplevel` | Report `BLOCKED`. |
| Worktree missing files you expected (e.g., a spec the dispatch references) | Report `NEEDS_CONTEXT` — do not invent paths. |
| Tests fail in your worktree before any edit | Report `BLOCKED` — that is a stale-branch issue the orchestrator owns. |
| You finished editing but tests fail | Same as on `main` — fix or report; do not commit broken state. |

## Red Flags

**Never:**
- Edit without running the three startup checks.
- Commit on `main` from a builder dispatch (orchestrator owns main commits).
- Run `git worktree remove` from inside an agent dispatch.
- Report DONE without `Branch:` and `Commit:` lines when in a worktree.
- Use `git add -A` or `git add .` — stage by name.

**Always:**
- `pwd` + `git rev-parse --show-toplevel` + `git rev-parse --abbrev-ref HEAD` first.
- Commit before DONE in a worktree.
- Include branch + SHA in the DONE report.
- Treat a startup-check mismatch as `BLOCKED`, not a thing to work around.

## Pairs With

- [`agents/_shared/companion-protocol.md`](../../agents/_shared/companion-protocol.md#worktree-awareness) — the floor every agent reads, with the minimum contract restated.
- [`skills/using-fellowship/SKILL.md`](../using-fellowship/SKILL.md) — Gandalf's dispatch protocol; explains when `isolation: "worktree"` is chosen.

## Example — Builder Dispatch

```
[Gandalf creates worktree at .claude/worktrees/agent-7a3f.../, branch agent-7a3f...]
[Dispatches Gimli with task: "implement the rate-limit middleware"]

Gimli:
  $ pwd
  /Users/Karolus/projects/Fellowship/.claude/worktrees/agent-7a3f9c2b1d4e5f6a
  $ git rev-parse --show-toplevel
  /Users/Karolus/projects/Fellowship/.claude/worktrees/agent-7a3f9c2b1d4e5f6a
  $ git rev-parse --abbrev-ref HEAD
  agent-7a3f9c2b1d4e5f6a

  [Worktree confirmed. Edits src/middleware/rate-limit.ts and tests.]
  [Runs npm test — passes.]
  $ git add src/middleware/rate-limit.ts tests/rate-limit.test.ts
  $ git commit -m "gimli: rate-limit middleware"
  [main 7c1d2e3] gimli: rate-limit middleware

Gimli's DONE report:
  Status: DONE
  Branch: agent-7a3f9c2b1d4e5f6a
  Commit: 7c1d2e3
  Files changed: src/middleware/rate-limit.ts, tests/rate-limit.test.ts
  ...

[Gandalf merges agent-7a3f... into main, removes the worktree, dispatches the next agent.]
```
