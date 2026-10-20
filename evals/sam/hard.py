"""
Sam hard assertions — deterministic string checks on agent output.
"""

import re
import sys


def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Sam's report must include a Status field."""
    return "Status:" in response


def flags_secrets_in_logs(response: str, scenario: dict = None) -> bool:
    """On secret_in_logs, must flag echoed secrets and recommend remove/mask."""
    if scenario and scenario.get("category") != "secret_in_logs":
        return True
    lower = response.lower()
    flag_signals = ["echo", "log", "exposed", "leak", "visible"]
    fix_signals = ["mask", "::add-mask::", "remove", "do not echo", "don't echo"]
    return any(f in lower for f in flag_signals) and any(s in lower for s in fix_signals)


def env_example_lists_all_vars(response: str, scenario: dict = None) -> bool:
    """On deploy_env_var_check, output must reference all five env vars."""
    if scenario and scenario.get("category") != "deploy_env_var_check":
        return True
    required = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "STRIPE_KEY", "SENTRY_DSN"]
    return all(v in response for v in required)


def recommends_simpler_tool(response: str, scenario: dict = None) -> bool:
    """On right_tool_for_job, Sam recommends simpler alternative to BullMQ+Redis."""
    if scenario and scenario.get("category") != "right_tool_for_job":
        return True
    lower = response.lower()
    simpler_signals = ["simpler", "overkill", "synchronous", "in-process", "no need", "too heavy", "smaller", "single welcome"]
    return any(s in lower for s in simpler_signals)


def declines_business_logic(response: str, scenario: dict = None) -> bool:
    """On wrong_layer, must defer to Gimli for business logic."""
    if scenario and scenario.get("category") != "wrong_layer":
        return True
    lower = response.lower()
    return "gimli" in lower or "not my" in lower or "application code" in lower or "business logic" in lower


def deploy_script_fails_loud(response: str, scenario: dict = None) -> bool:
    """On loud_failure, script must use set -e or equivalent."""
    if scenario and scenario.get("category") != "loud_failure":
        return True
    return "set -e" in response or "set -euo pipefail" in response or "|| exit" in response


def identifies_missing_env_vars(response: str, scenario: dict = None) -> bool:
    """On env_example_complete, must name REDIS_URL and STRIPE_KEY."""
    if scenario and scenario.get("category") != "env_example_complete":
        return True
    return "REDIS_URL" in response and "STRIPE_KEY" in response


def workflow_uses_npm_ci(response: str, scenario: dict = None) -> bool:
    """On npm_ci_not_install, must use 'npm ci' not 'npm install'."""
    if scenario and scenario.get("category") != "npm_ci_not_install":
        return True
    has_npm_ci = "npm ci" in response
    # `npm install` for project deps is bad. `npm install -g <tool>` is fine
    # (CI installing a global helper). Match bare `npm install` at end-of-line
    # OR followed by something other than `-g`.
    bare_install = re.search(r"npm install\s*$", response, re.MULTILINE)
    non_global_install = re.search(r"npm install\s+(?!-g\b)\S", response)
    bad = bool(bare_install) or bool(non_global_install)
    return has_npm_ci and not bad


ASSERTIONS = [
    report_has_status_field,
    flags_secrets_in_logs,
    env_example_lists_all_vars,
    recommends_simpler_tool,
    declines_business_logic,
    deploy_script_fails_loud,
    identifies_missing_env_vars,
    workflow_uses_npm_ci,
]


def run_assertions(response: str, scenario: dict = None) -> dict:
    return {fn.__name__: fn(response, scenario) for fn in ASSERTIONS}


if __name__ == "__main__":
    import json as _json
    scenario = None
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            scenario = _json.load(f)
    text = sys.stdin.read()
    results = run_assertions(text, scenario)
    passed = sum(results.values())
    total = len(results)
    print(f"Results: {passed}/{total} passed")
    for name, result in results.items():
        mark = "PASS" if result else "FAIL"
        print(f"  [{mark}] {name}")
