# AutoImprove Runner

Headless overnight loop that improves Fellowship agent files using eval-driven iteration.

## Warning — full-permission session

`improve.sh` invokes `claude --dangerously-skip-permissions` against a worktree copy of this repository. The headless agent runs with every tool enabled and no confirmation prompts, against whatever files the worktree contains — including any secrets, credentials, or proprietary data sitting in untracked files. Do not run this on a repo containing anything you are not willing to expose to a fully-permissioned Claude session. Inspect your worktree state (`git status`, `find . -name '.env*'`) before starting an overnight run.

## How it works

1. Spins up a git worktree on a fresh branch (`autoimprove/<agent>-YYYYMMDD-HHMM`)
2. Headless Claude reads `skills/autoimprove/SKILL.md` and runs the improvement loop
3. Each cycle: baseline → propose one change → evaluate → keep (commit) or discard (revert)
4. Stops at 85% pass rate, 25 cycles, or no failing assertions
5. Prints morning review instructions when done

## Usage

```bash
# Single agent, default 25 cycles
./improve.sh gimli
./improve.sh gandalf
./improve.sh legolas

# Single agent, custom cycle count
./improve.sh gandalf --cycles 15

# All three agents sequentially (Gimli → Gandalf → Legolas)
./improve.sh --all

# All three, custom cycles
./improve.sh --all --cycles 10
```

Run from the repo root or from this directory. The script uses `git worktree` so it must be run inside the Fellowship git repo.

## Morning review

After the loop finishes, the script prints:

- Commits that held (lines starting `exp:`)
- Full diff of the changed agent file against `main`
- Path to the session summary

To merge a successful run:
```bash
git merge autoimprove/<agent>-YYYYMMDD-HHMM --no-ff
```

To discard:
```bash
git worktree remove /tmp/fellowship-improve-<agent> --force
git branch -d autoimprove/<agent>-YYYYMMDD-HHMM
```

## Scoring

- **Hard score**: % of deterministic assertions passing (`hard.py`)
- **Soft score**: % of LLM-as-judge assertions passing (`soft.md`, Gandalf only)
- **Overall**: `(hard * 0.7) + (soft * 0.3)` when soft.md present, `hard` only when absent

Pass rate history is appended to `evals/<agent>/history.jsonl` each cycle.

## First use

Run individual agents first. `--all` is for once the loop is proven. Three simultaneous overnight runs triple the cost for no speed benefit.
