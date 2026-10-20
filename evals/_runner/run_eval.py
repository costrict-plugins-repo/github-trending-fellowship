#!/usr/bin/env python3
"""
run_eval.py — Run all scenarios for an agent and return scoring results as JSON.

Called by improve.sh. Never by claude directly.

Usage:
    python3 run_eval.py --agent gimli --worktree /tmp/fellowship-improve-gimli \
        --hard-protected /tmp/fellowship_eval_gimli_hard.py
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


# Strip ANTHROPIC_API_KEY from subprocess env so nested `claude` calls fall back
# to Keychain/subscription auth instead of billing against API credits.
_SUBPROCESS_ENV = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}


def run_subprocess(cmd: list[str], timeout: int = 120) -> tuple[str, str, int]:
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, env=_SUBPROCESS_ENV
    )
    return result.stdout, result.stderr, result.returncode


def build_prompt(agent_instructions: str, scenario: dict) -> str:
    prompt = agent_instructions + "\n\n---\n\n"
    if scenario.get("context"):
        prompt += f"Context: {scenario['context']}\n\n"
    prompt += scenario["input"]
    return prompt


def run_scenario(scenario: dict, agent_instructions: str) -> str:
    """Invoke the agent for a single scenario. Returns the response string.

    On timeout, returns an empty string — a slow scenario counts as a failure
    for assertion purposes but must not crash the whole cycle.
    """
    prompt = build_prompt(agent_instructions, scenario)
    try:
        stdout, stderr, code = run_subprocess(
            ["claude", "--dangerously-skip-permissions",
             "--model", "claude-haiku-4-5", "--print", prompt],
            timeout=180,
        )
        return stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"  [eval] scenario {scenario.get('id', 'unknown')} timed out — counting as failure", file=sys.stderr)
        return ""


def run_hard_assertions(hard_protected: str, response: str, scenario: dict) -> dict[str, bool]:
    """Run the protected hard.py against a response. Returns {assertion_name: bool}."""
    # Write response and scenario to tmp files
    Path("/tmp/fellowship_eval_response.txt").write_text(response)
    Path("/tmp/fellowship_eval_scenario.json").write_text(json.dumps(scenario))

    result = subprocess.run(
        ["python3", hard_protected,
         "/tmp/fellowship_eval_scenario.json"],
        input=response,
        capture_output=True,
        text=True,
        timeout=30,
    )
    output = result.stdout

    # Parse "  [PASS] assertion_name" / "  [FAIL] assertion_name" lines
    results: dict[str, bool] = {}
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("[PASS]"):
            name = line[len("[PASS]"):].strip()
            results[name] = True
        elif line.startswith("[FAIL]"):
            name = line[len("[FAIL]"):].strip()
            results[name] = False

    return results


def run_soft_assertion(assertion_text: str, response: str) -> bool:
    """Judge a single soft assertion with claude-haiku. Returns True if passes.

    On timeout or subprocess error, returns False (slow/erroring judge counts as
    a failure for that assertion). Must not crash the whole eval run — one slow
    grader should not kill the cycle.
    """
    prompt = (
        f"Assertion: {assertion_text}\n\n"
        f"Response: {response}\n\n"
        "In 1 sentence explain your reasoning. Then write only TRUE or FALSE."
    )
    try:
        stdout, _, _ = run_subprocess(
            ["claude", "--dangerously-skip-permissions",
             "--model", "claude-haiku-4-5", "--print", prompt],
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        slug = assertion_text[:60].strip().rstrip("?").replace(" ", "_").lower()
        print(f"  [eval] soft judge timed out on '{slug}' — counting as failure", file=sys.stderr)
        return False
    output = stdout.strip()
    lines = [l.strip() for l in output.splitlines() if l.strip()]
    if not lines:
        return False
    verdict = lines[-1].upper()
    return verdict.startswith("TRUE")


def load_soft_assertions(worktree: str, agent: str) -> list[str]:
    """Return non-empty assertion lines from soft.md, or [] if absent."""
    soft_path = Path(worktree) / "evals" / agent / "soft.md"
    if not soft_path.exists():
        return []
    lines = [l.strip() for l in soft_path.read_text().splitlines() if l.strip()]
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Run eval scenarios for an agent")
    parser.add_argument("--agent", required=True, help="Agent name (e.g. gimli)")
    parser.add_argument("--worktree", required=True, help="Absolute path to git worktree")
    parser.add_argument("--hard-protected", required=True, dest="hard_protected",
                        help="Absolute path to protected hard.py copy")
    parser.add_argument("--scenarios-path", dest="scenarios_path", default=None,
                        help="Override path to scenarios.jsonl (default: <worktree>/evals/<agent>/scenarios.jsonl). "
                             "Use to run focused subsets without modifying the canonical suite.")
    args = parser.parse_args()

    worktree = args.worktree
    agent = args.agent
    hard_protected = args.hard_protected

    scenarios_path = (
        Path(args.scenarios_path) if args.scenarios_path
        else Path(worktree) / "evals" / agent / "scenarios.jsonl"
    )
    # Gandalf identity lives in the using-fellowship skill, not an agent file.
    if agent == "gandalf":
        agent_path = Path(worktree) / "skills" / "using-fellowship" / "SKILL.md"
    else:
        agent_path = Path(worktree) / "agents" / f"{agent}.md"

    if not scenarios_path.exists():
        print(json.dumps({"error": f"scenarios.jsonl not found: {scenarios_path}"}))
        sys.exit(1)
    if not agent_path.exists():
        print(json.dumps({"error": f"agent file not found: {agent_path}"}))
        sys.exit(1)
    if not Path(hard_protected).exists():
        print(json.dumps({"error": f"hard-protected not found: {hard_protected}"}))
        sys.exit(1)

    agent_instructions = agent_path.read_text()
    soft_assertions = load_soft_assertions(worktree, agent)
    has_soft = len(soft_assertions) > 0

    scenarios = []
    with open(scenarios_path) as f:
        for line in f:
            line = line.strip()
            if line:
                scenarios.append(json.loads(line))

    # Counters
    hard_pass = 0
    hard_total = 0
    soft_pass = 0
    soft_total = 0

    # Failure tracking: assertion_name -> count
    assertion_fail_counts: dict[str, int] = {}
    failures: list[dict] = []

    # Incremental progress file — survives kill mid-run.
    # Each line is a JSON object with per-scenario results; consumers (humans,
    # downstream tooling) can tail this file while the run is in flight.
    progress_path = Path(worktree) / "evals" / agent / ".progress.jsonl"
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    # Truncate any prior incremental log; this run owns the file.
    progress_path.write_text("")

    total_scenarios = len(scenarios)

    for idx, scenario in enumerate(scenarios, start=1):
        scenario_id = scenario.get("id", "unknown")
        print(f"  [eval] scenario {scenario_id} ({idx}/{total_scenarios})...", file=sys.stderr)

        response = run_scenario(scenario, agent_instructions)

        scenario_hard_pass = 0
        scenario_hard_total = 0
        scenario_soft_pass = 0
        scenario_soft_total = 0
        scenario_failures: list[dict] = []

        # Hard assertions
        hard_results = run_hard_assertions(hard_protected, response, scenario)
        for assertion_name, passed in hard_results.items():
            hard_total += 1
            scenario_hard_total += 1
            if passed:
                hard_pass += 1
                scenario_hard_pass += 1
            else:
                assertion_fail_counts[assertion_name] = assertion_fail_counts.get(assertion_name, 0) + 1
                f = {
                    "scenario_id": scenario_id,
                    "assertion": assertion_name,
                    "type": "hard",
                    "response_preview": response[:200] + "..." if len(response) > 200 else response,
                }
                failures.append(f)
                scenario_failures.append({"assertion": assertion_name, "type": "hard"})

        # Soft assertions
        if has_soft:
            for assertion_text in soft_assertions:
                soft_total += 1
                scenario_soft_total += 1
                passed = run_soft_assertion(assertion_text, response)
                if passed:
                    soft_pass += 1
                    scenario_soft_pass += 1
                else:
                    # Use a short slug as assertion name for soft
                    slug = assertion_text[:60].strip().rstrip("?").replace(" ", "_").lower()
                    assertion_fail_counts[slug] = assertion_fail_counts.get(slug, 0) + 1
                    f = {
                        "scenario_id": scenario_id,
                        "assertion": slug,
                        "type": "soft",
                        "response_preview": response[:200] + "..." if len(response) > 200 else response,
                    }
                    failures.append(f)
                    scenario_failures.append({"assertion": slug, "type": "soft"})

        # Per-scenario summary to stderr (visible mid-run; survives `tail -40`).
        soft_summary = f" soft={scenario_soft_pass}/{scenario_soft_total}" if scenario_soft_total else ""
        fail_summary = f" failing=[{', '.join(f['assertion'] for f in scenario_failures)}]" if scenario_failures else ""
        print(
            f"  [eval] {scenario_id} hard={scenario_hard_pass}/{scenario_hard_total}{soft_summary}{fail_summary}",
            file=sys.stderr,
        )

        # Append per-scenario record to the incremental progress file.
        with progress_path.open("a") as pf:
            pf.write(json.dumps({
                "scenario_id": scenario_id,
                "index": idx,
                "total": total_scenarios,
                "hard_pass": scenario_hard_pass,
                "hard_total": scenario_hard_total,
                "soft_pass": scenario_soft_pass,
                "soft_total": scenario_soft_total,
                "failing_assertions": [f["assertion"] for f in scenario_failures],
            }) + "\n")

    hard_score = hard_pass / hard_total if hard_total > 0 else 0.0
    soft_score: float | None = None
    if has_soft and soft_total > 0:
        soft_score = soft_pass / soft_total

    if soft_score is not None:
        overall = (hard_score * 0.7) + (soft_score * 0.3)
    else:
        overall = hard_score

    # Top failing assertion: most failures across all scenarios
    top_failing = ""
    if assertion_fail_counts:
        top_failing = max(assertion_fail_counts, key=lambda k: assertion_fail_counts[k])

    output = {
        "hard_score": round(hard_score, 4),
        "soft_score": round(soft_score, 4) if soft_score is not None else None,
        "overall": round(overall, 4),
        "top_failing_assertion": top_failing,
        "failures": failures,
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
