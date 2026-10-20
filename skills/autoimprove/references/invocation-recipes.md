# Invocation Recipes

Mechanical recipes for invoking a fresh `claude` process during baseline (Step 2) and during evaluation (Step 5). Copy these as written; substitute `<target>` and the scenario JSON.

## Hard-assertion run (per scenario)

For each scenario in `scenarios.jsonl`:

```bash
python3 << 'PYEOF'
import subprocess, json

target = "<target>"  # e.g. "gimli"
scenario_json = '<paste full scenario JSON line here>'
scenario = json.loads(scenario_json)

# Build prompt: full agent file + optional context + scenario input
agent_instructions = open(f"agents/{target}.md").read()
prompt = agent_instructions + "\n\n---\n\n"
if scenario.get("context"):
    prompt += f"Context: {scenario['context']}\n\n"
prompt += scenario["input"]

# Fresh invocation — Haiku for cost efficiency; behaviorally representative
result = subprocess.run(
    ["claude", "--dangerously-skip-permissions", "--model", "claude-haiku-4-5", "--print", prompt],
    capture_output=True, text=True, timeout=120
)
response = result.stdout.strip()

# Save for assertion runner
open("/tmp/fellowship_eval_response.txt", "w").write(response)
open("/tmp/fellowship_eval_scenario.json", "w").write(scenario_json)

print(f"=== RESPONSE (scenario {scenario['id']}) ===")
print(response[:600] + "..." if len(response) > 600 else response)
PYEOF
```

Run once per scenario. Response is saved to `/tmp/fellowship_eval_response.txt`.

Then run the protected hard-assertion script:

```bash
# Use the PROTECTED copy — never evals/<target>/hard.py directly
python3 /tmp/fellowship_eval_<target>_hard.py \
  /tmp/fellowship_eval_scenario.json \
  < /tmp/fellowship_eval_response.txt
```

The protected copy was placed at `/tmp/fellowship_eval_<target>_hard.py` by the runner before the worktree was created. It cannot be modified by this loop.

## Soft-assertion judging (per assertion line in `soft.md`)

```bash
python3 << 'PYEOF'
import subprocess

assertion = "<assertion text from soft.md>"
response = open("/tmp/fellowship_eval_response.txt").read()
prompt = f"""Assertion: {assertion}
Response: {response}

In 1-2 sentences, explain your reasoning. Then on a new line write only TRUE or FALSE."""

result = subprocess.run(
    ["claude", "--model", "claude-haiku-4-5", "--print", prompt],
    capture_output=True, text=True, timeout=60
)
output = result.stdout.strip()
# Verdict is the last non-empty line
verdict = [l.strip() for l in output.splitlines() if l.strip()][-1].upper()
passed = verdict.startswith("TRUE")
print(f"{'PASS' if passed else 'FAIL'}: {assertion[:80]}")
if not passed:
    print(f"  Reasoning: {output[:200]}")
PYEOF
```

Parse the verdict from the **last non-empty line** of the output — not the whole response.

**Timing note:** Real invocations take 15–30 seconds each. A full baseline across all scenarios takes 5–15 minutes. This is expected. Do not shortcut by simulating.
