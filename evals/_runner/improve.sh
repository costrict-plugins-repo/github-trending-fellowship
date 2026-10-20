#!/bin/bash
# AutoImprove runner — headless agent improvement loop
#
# Usage:
#   ./improve.sh <agent>              # single agent, 25 cycles
#   ./improve.sh <agent> --cycles N   # single agent, N cycles
#   ./improve.sh --all                # sequential: Gimli → Gandalf → Legolas
#   ./improve.sh --all --cycles N     # sequential, N cycles each
#
# Examples:
#   ./improve.sh gimli
#   ./improve.sh gandalf --cycles 15
#   ./improve.sh --all --cycles 10
#
# Architecture: claude is called exactly three types of times:
#   1. Per scenario (isolated subprocesses) — inside run_eval.py
#   2. Per cycle, once — to propose one targeted change (~8K tokens, flat context)
#   3. Per session, once — to write the session summary

set -euo pipefail

# ── Argument parsing ───────────────────────────────────────────────────────────

TARGET=""
CYCLES=25
RUN_ALL=false

# Capture repo root before any cd
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_EVAL="${REPO_ROOT}/evals/_runner/run_eval.py"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)
            RUN_ALL=true
            shift
            ;;
        --cycles)
            CYCLES="${2:?--cycles requires a number}"
            shift 2
            ;;
        --*)
            echo "Unknown flag: $1" >&2
            exit 1
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

if [[ "$RUN_ALL" == false && -z "$TARGET" ]]; then
    echo "Usage: $0 <agent> [--cycles N]" >&2
    echo "       $0 --all [--cycles N]" >&2
    exit 1
fi

if [[ "$RUN_ALL" == true && -n "$TARGET" ]]; then
    echo "Error: cannot combine --all with a specific agent name." >&2
    exit 1
fi

# ── Core loop function ─────────────────────────────────────────────────────────

run_agent() {
    local agent="$1"
    local cycles="$2"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M)
    local branch="autoimprove/${agent}-${timestamp}"
    local worktree="/tmp/fellowship-improve-${agent}"

    # Gandalf identity lives in the using-fellowship skill, not an agent file.
    # AGENT_FILE is the relative path inside the worktree to the agent's prompt.
    local AGENT_FILE
    if [[ "$agent" == "gandalf" ]]; then
        AGENT_FILE="skills/using-fellowship/SKILL.md"
    else
        AGENT_FILE="agents/${agent}.md"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Agent:      $agent"
    echo "  Branch:     $branch"
    echo "  Worktree:   $worktree"
    echo "  Max cycles: $cycles"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Remove stale worktree if it exists
    if [[ -d "$worktree" ]]; then
        echo "Removing existing worktree at $worktree..."
        git -C "$REPO_ROOT" worktree remove "$worktree" --force 2>/dev/null || true
    fi

    # Protect hard.py — copy outside worktree before worktree is created
    local hard_protected="/tmp/fellowship_eval_${agent}_hard.py"
    chmod 644 "$hard_protected" 2>/dev/null || true  # clear any stale 444 from prior run
    cp "${REPO_ROOT}/evals/${agent}/hard.py" "$hard_protected"
    chmod 444 "$hard_protected"
    echo "Protected eval file → $hard_protected"

    # Create isolated worktree on a fresh branch
    git -C "$REPO_ROOT" worktree add "$worktree" -b "$branch"

    local history_file="${worktree}/evals/${agent}/history.jsonl"

    # ── Phase 1: Baseline ──────────────────────────────────────────────────────

    echo ""
    echo "[baseline] Running scenarios..."
    local baseline_results
    baseline_results=$(python3 "$RUN_EVAL" \
        --agent "$agent" \
        --worktree "$worktree" \
        --hard-protected "$hard_protected")

    # Validate output looks like JSON
    if ! echo "$baseline_results" | python3 -c "import sys, json; json.loads(sys.stdin.read())" 2>/dev/null; then
        echo "[baseline] ERROR: run_eval.py returned non-JSON output:" >&2
        echo "$baseline_results" >&2
        exit 1
    fi

    # Parse baseline score
    local baseline_overall
    baseline_overall=$(echo "$baseline_results" | python3 -c \
        "import sys, json; print(json.loads(sys.stdin.read())['overall'])")

    # Append baseline entry to history.jsonl
    echo "$baseline_results" | python3 -c "
import sys, json
from datetime import datetime, timezone
d = json.loads(sys.stdin.read())
entry = {
    'run_id': datetime.now(timezone.utc).isoformat(),
    'cycle': 0,
    'hard_score': d['hard_score'],
    'soft_score': d.get('soft_score'),
    'overall': d['overall'],
    'top_failing_assertion': d['top_failing_assertion'],
    'change_applied': 'baseline',
    'hypothesis': 'baseline — no change',
    'outcome': 'baseline',
    'commit': None
}
print(json.dumps(entry))
" >> "$history_file"

    echo "[baseline] Score: ${baseline_overall}"

    # Skip cycles if already good
    if python3 -c "import sys; sys.exit(0 if float('${baseline_overall}') >= 0.85 else 1)" 2>/dev/null; then
        echo "[baseline] Score ≥ 0.85 — skipping improvement cycles."
    else
        # ── Phase 2: Improvement cycles ───────────────────────────────────────

        local consecutive_discards=0
        local current_cycle=1
        local current_results="$baseline_results"

        while [[ $current_cycle -le $cycles ]]; do
            echo ""
            echo "[cycle ${current_cycle}/${cycles}] Proposing change..."

            # Extract top failing assertion
            local top_assertion
            top_assertion=$(echo "$current_results" | python3 -c \
                "import sys, json; print(json.loads(sys.stdin.read())['top_failing_assertion'])")

            # Build failure examples (max 5) for the propose prompt
            local failure_examples
            failure_examples=$(echo "$current_results" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
top = d['top_failing_assertion']
lines = []
for f in d['failures']:
    if f['assertion'] == top:
        lines.append('[' + f['scenario_id'] + '] -> \"' + f['response_preview'][:120] + '\"')
print('\n'.join(lines[:5]))
")

            # Call claude ONCE to propose a change — flat ~8K context
            local propose_prompt
            propose_prompt="Read skills/autoimprove/propose.md.
Agent: ${agent}
Failing assertion: ${top_assertion}
Failure examples:
${failure_examples}
Read ${AGENT_FILE}, then output the complete modified agent file with ONE targeted fix."

            local proposed_agent
            # Strip ANTHROPIC_API_KEY so nested claude falls back to Keychain/subscription auth.
            # --disallowed-tools forces the subprocess to print to stdout instead of using Edit/Write,
            # which previously leaked modifications outside the worktree.
            proposed_agent=$(cd "$worktree" && env -u ANTHROPIC_API_KEY claude --dangerously-skip-permissions \
                --disallowed-tools Edit Write MultiEdit NotebookEdit \
                --model claude-sonnet-4-5 --print "$propose_prompt")

            # Validate proposed output — must be non-empty and look like an agent file
            if [[ -z "$proposed_agent" ]] || ! echo "$proposed_agent" | grep -q "^#\|^##\|You are"; then
                echo "[cycle ${current_cycle}] WARNING: proposed output doesn't look like an agent file — skipping cycle."
                current_cycle=$((current_cycle + 1))
                continue
            fi

            # Apply the proposed change
            echo "$proposed_agent" > "${worktree}/${AGENT_FILE}"

            # Re-run scenarios with the changed agent
            echo "[cycle ${current_cycle}] Evaluating change..."
            local new_results
            new_results=$(python3 "$RUN_EVAL" \
                --agent "$agent" \
                --worktree "$worktree" \
                --hard-protected "$hard_protected")

            # Validate output
            if ! echo "$new_results" | python3 -c "import sys, json; json.loads(sys.stdin.read())" 2>/dev/null; then
                echo "[cycle ${current_cycle}] ERROR: run_eval.py returned non-JSON — reverting." >&2
                (cd "$worktree" && git checkout "${AGENT_FILE}")
                current_cycle=$((current_cycle + 1))
                continue
            fi

            local new_overall
            new_overall=$(echo "$new_results" | python3 -c \
                "import sys, json; print(json.loads(sys.stdin.read())['overall'])")

            local prev_overall
            prev_overall=$(tail -1 "$history_file" | python3 -c \
                "import sys, json; print(json.loads(sys.stdin.read())['overall'])")

            # Extract hypothesis from proposed file (sanitize quotes for shell embedding)
            local hypothesis
            hypothesis=$(grep "# hypothesis:" "${worktree}/${AGENT_FILE}" 2>/dev/null \
                | tail -1 \
                | sed 's/# hypothesis: //' \
                | tr -d '"'"'" \
                || echo "no hypothesis")

            # Decide: keep or revert
            local outcome
            local commit_hash=""
            if python3 -c "import sys; sys.exit(0 if float('${new_overall}') > float('${prev_overall}') else 1)" 2>/dev/null; then
                outcome="kept"
                local delta
                delta=$(python3 -c "print(round((float('${new_overall}') - float('${prev_overall}')) * 100, 1))")
                (cd "$worktree" && \
                    git add "${AGENT_FILE}" "evals/${agent}/history.jsonl" && \
                    git commit -m "exp: +${delta}% ${top_assertion} — ${hypothesis}")
                commit_hash=$(cd "$worktree" && git rev-parse --short HEAD)
                consecutive_discards=0
                current_results="$new_results"
                echo "[cycle ${current_cycle}] Kept. Score: ${prev_overall} → ${new_overall} (+${delta}%)"
            else
                outcome="discarded"
                (cd "$worktree" && git checkout "${AGENT_FILE}")
                consecutive_discards=$((consecutive_discards + 1))
                echo "[cycle ${current_cycle}] Discarded. Score: ${prev_overall} → ${new_overall} (no improvement)"
            fi

            # Append cycle entry to history.jsonl
            # Write new_results to a tmp file to avoid shell quoting issues
            local cycle_results_tmp="/tmp/fellowship_cycle_results_${agent}.json"
            echo "$new_results" > "$cycle_results_tmp"
            local commit_arg
            commit_arg=$( [[ "$outcome" == "kept" ]] && echo "${commit_hash}" || echo "" )
            python3 - "$cycle_results_tmp" "$current_cycle" "$top_assertion" \
                "$hypothesis" "$outcome" "$commit_arg" >> "$history_file" << 'PYEOF'
import sys, json
from datetime import datetime, timezone
results_file, cycle_n, assertion, hypothesis, outcome, commit = sys.argv[1:]
with open(results_file) as f:
    d = json.load(f)
entry = {
    'run_id': datetime.now(timezone.utc).isoformat(),
    'cycle': int(cycle_n),
    'hard_score': d['hard_score'],
    'soft_score': d.get('soft_score'),
    'overall': d['overall'],
    'top_failing_assertion': assertion,
    'change_applied': f'one-line change targeting {assertion}',
    'hypothesis': hypothesis,
    'outcome': outcome,
    'commit': commit if commit else None,
}
print(json.dumps(entry))
PYEOF

            # Early exit conditions
            if python3 -c "import sys; sys.exit(0 if float('${new_overall}') >= 0.85 else 1)" 2>/dev/null; then
                echo "[cycle ${current_cycle}] Score ≥ 0.85 — stopping."
                break
            fi
            if [[ $consecutive_discards -ge 3 ]]; then
                echo "[cycle ${current_cycle}] 3 consecutive discards — stopping."
                break
            fi

            current_cycle=$((current_cycle + 1))
        done
    fi

    # ── Phase 3: Report ────────────────────────────────────────────────────────

    echo ""
    echo "[report] Writing session summary..."
    # Strip ANTHROPIC_API_KEY so nested claude falls back to Keychain/subscription auth.
    (cd "$worktree" && env -u ANTHROPIC_API_KEY claude --dangerously-skip-permissions --model claude-sonnet-4-5 --print \
        "Read skills/autoimprove/report.md. Target agent: ${agent}. Date: $(date +%Y-%m-%d). Run Step 8.")

    # ── Morning review instructions ────────────────────────────────────────────

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Morning review — ${agent}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Commits that held:"
    git -C "$worktree" log --oneline | grep "exp:" || echo "  (none)"
    echo ""
    echo "Full diff against main:"
    git -C "$worktree" diff main -- "${AGENT_FILE}"
    echo ""
    echo "Session summary:"
    cat "$worktree/evals/${agent}/session-summary.md" 2>/dev/null || echo "  (no summary written)"
    echo ""
    echo "To merge:"
    echo "  git merge ${branch} --no-ff"
    echo ""
    echo "To discard:"
    echo "  git worktree remove ${worktree} --force && git branch -d ${branch}"
    echo ""
}

# ── Dispatch ───────────────────────────────────────────────────────────────────
#
# Recognized agents (any with an evals/<agent>/ directory):
#   Mature suites (validated, --all-eligible):
#     gimli, gandalf, legolas, pippin
#   Authored 2026-04-26 (real scenarios written by Pippin, not yet validated end-to-end):
#     aragorn, arwen, bilbo, boromir, merry, sam
#
# The runner dispatches by directory name, so any of the above works as
# `./improve.sh <agent>`. The --all flag only runs the mature suites
# because the newly-authored suites haven't been validated against
# baseline scores yet — run them individually first.

if [[ "$RUN_ALL" == true ]]; then
    echo "Starting sequential autoimprove: Gimli → Gandalf → Legolas → Pippin"
    echo "(Skipping authored-but-unvalidated suites: aragorn, arwen, bilbo, boromir, merry, sam — run individually first.)"
    echo "Cycles per agent: $CYCLES"
    run_agent "gimli" "$CYCLES"
    run_agent "gandalf" "$CYCLES"
    run_agent "legolas" "$CYCLES"
    run_agent "pippin" "$CYCLES"
    echo ""
    echo "All four mature agents complete."
else
    run_agent "$TARGET" "$CYCLES"
fi
