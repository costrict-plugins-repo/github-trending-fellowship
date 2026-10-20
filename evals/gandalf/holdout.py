import subprocess
import json
import os

# Read holdout scenarios
with open("evals/gandalf/holdout.jsonl") as f:
    holdout_scenarios = [json.loads(line) for line in f if line.strip()]

# Read agent file (Gandalf identity now lives in the using-fellowship skill)
with open("skills/using-fellowship/SKILL.md") as f:
    agent_instructions = f.read()

# Read soft assertions
with open("evals/gandalf/soft.md") as f:
    soft_assertions = [line.strip() for line in f if line.strip() and not line.startswith('#')]

print(f"Running {len(holdout_scenarios)} holdout scenarios...")
print(f"Hard assertions: 10")
print(f"Soft assertions: {len(soft_assertions)}")
print()

# Store results
holdout_results = []

for idx, scenario in enumerate(holdout_scenarios, 1):
    print(f"[{idx}/{len(holdout_scenarios)}] Scenario {scenario['id']}...", end=" ", flush=True)

    # Build prompt
    prompt = agent_instructions + "\n\n---\n\n"
    if scenario.get("context"):
        prompt += f"Context: {scenario['context']}\n\n"
    prompt += scenario["input"]

    # Invoke agent
    try:
        result = subprocess.run(
            ["claude", "--dangerously-skip-permissions", "--model", "claude-opus-4-1", "--print", prompt],
            capture_output=True, text=True, timeout=180, cwd="/Users/Karolus/projects/Fellowship"
        )
        response = result.stdout.strip()

        # Save for hard assertions
        with open("/tmp/eval_response.txt", "w") as f:
            f.write(response)
        with open("/tmp/eval_scenario.json", "w") as f:
            json.dump(scenario, f)

        # Run hard assertions
        hard_result = subprocess.run(
            ["python3", "evals/gandalf/hard.py", "/tmp/eval_scenario.json"],
            input=response, capture_output=True, text=True, cwd="/Users/Karolus/projects/Fellowship"
        )

        # Parse hard results
        hard_passed = hard_result.stdout.count("[PASS]")
        hard_total = 10

        # Run soft assertions
        soft_passed = 0
        soft_total = len(soft_assertions)

        for assertion in soft_assertions:
            judge_prompt = f"""Assertion: {assertion}
Response:

{response}

In 1-2 sentences, explain your reasoning. Then on a new line write only TRUE or FALSE."""

            judge_result = subprocess.run(
                ["claude", "--model", "claude-haiku-4-5", "--print", judge_prompt],
                capture_output=True, text=True, timeout=60
            )
            judge_output = judge_result.stdout.strip()
            lines = [l.strip() for l in judge_output.splitlines() if l.strip()]
            verdict = lines[-1].upper() if lines else "FALSE"
            passed = verdict.startswith("TRUE")

            if passed:
                soft_passed += 1

        print(f"Hard: {hard_passed}/10 | Soft: {soft_passed}/{soft_total}")

        holdout_results.append({
            "scenario_id": scenario["id"],
            "hard_passed": hard_passed,
            "hard_total": hard_total,
            "soft_passed": soft_passed,
            "soft_total": soft_total
        })

    except Exception as e:
        print(f"ERROR: {e}")
        holdout_results.append({
            "scenario_id": scenario["id"],
            "hard_passed": 0,
            "hard_total": 10,
            "soft_passed": 0,
            "soft_total": len(soft_assertions),
            "error": str(e)
        })

# Calculate overall
total_hard_passed = sum(r["hard_passed"] for r in holdout_results)
total_hard_possible = sum(r["hard_total"] for r in holdout_results)
total_soft_passed = sum(r["soft_passed"] for r in holdout_results)
total_soft_possible = sum(r["soft_total"] for r in holdout_results)

hard_score = total_hard_passed / total_hard_possible if total_hard_possible > 0 else 0
soft_score = total_soft_passed / total_soft_possible if total_soft_possible > 0 else 0
overall = (hard_score * 0.7) + (soft_score * 0.3)

print()
print("=" * 60)
print("HOLDOUT RESULTS — Compressed Gandalf")
print("=" * 60)
print(f"Hard score: {hard_score:.3f} ({total_hard_passed}/{total_hard_possible})")
print(f"Soft score: {soft_score:.3f} ({total_soft_passed}/{total_soft_possible})")
print(f"Overall: {overall:.3f}")
print()
print("Scenario breakdown:")
for r in holdout_results:
    print(f"  {r['scenario_id']}: {r['hard_passed']}/{r['hard_total']} hard, {r['soft_passed']}/{r['soft_total']} soft")
