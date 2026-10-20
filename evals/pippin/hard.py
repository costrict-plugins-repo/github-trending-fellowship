"""
Pippin hard assertions — deterministic string checks on agent output.
Each function takes a response string and returns bool.

Usage:
    echo "Status: DONE\n\nTest files:\n  src/utils/discount.test.ts\n\nVerification:\n  npm test — 8 passed" | python hard.py
"""

import sys


# ── Format compliance ──────────────────────────────────────────────────────────

def has_status(response: str, scenario: dict = None) -> bool:
    """Status field is one of DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED."""
    valid_statuses = {"DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"}
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value in valid_statuses
    return False


def has_test_files_section(response: str, scenario: dict = None) -> bool:
    """Report must reference test files written (or, in browser-verify mode, screenshots and steps walked)."""
    lower = response.lower()
    # Browser-verify mode produces verification reports — no test files, but screenshots and step traces
    if scenario and scenario.get("type", "").startswith("browser_verify"):
        return (
            "screenshot" in lower
            or "what was verified" in lower
            or "steps taken" in lower
            or "verification report" in lower
        )
    return "files:" in lower or "test files:" in lower or "tests written:" in lower


def no_vague_verification(response: str, scenario: dict = None) -> bool:
    """Must not contain vague verification language."""
    lower = response.lower()
    vague_phrases = [
        "should work",
        "seems to pass",
        "appears correct",
    ]
    return not any(phrase in lower for phrase in vague_phrases)


# ── Spec coverage ──────────────────────────────────────────────────────────────

def reports_spec_violations(response: str, scenario: dict = None) -> bool:
    """When spec_violation scenario, at least one violation_keywords item must appear in the response."""
    if not scenario or scenario.get("type") != "spec_violation":
        return True  # Only applies to spec_violation scenarios
    if "violation_keywords" not in scenario:
        return True
    lower = response.lower()
    return any(kw in lower for kw in scenario["violation_keywords"])


# ── Diagnostic hygiene ─────────────────────────────────────────────────────────

def no_diagnostic_warnings_ignored(response: str, scenario: dict = None) -> bool:
    """When diagnostic_cleanup scenario, Pippin must acknowledge and address warnings."""
    if not scenario or scenario.get("type") != "diagnostic_cleanup":
        return True  # Only applies to diagnostic_cleanup scenarios
    lower = response.lower()
    cleanup_signals = ["unused", "cleaned", "removed", "fixed", "lint"]
    return any(signal in lower for signal in cleanup_signals)


# ── Infrastructure ─────────────────────────────────────────────────────────────

def blocked_on_missing_infra(response: str, scenario: dict = None) -> bool:
    """When blocked_no_infra scenario, status must be BLOCKED — not DONE."""
    if not scenario or scenario.get("type") != "blocked_no_infra":
        return True  # Only applies to blocked_no_infra scenarios
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value == "BLOCKED"
    return False  # No status line found


# ── Assertion quality ──────────────────────────────────────────────────────────

def no_weak_assertions_ignored(response: str, scenario: dict = None) -> bool:
    """When weak_assertions scenario, Pippin must flag the weakness and indicate intent to strengthen."""
    if not scenario or scenario.get("type") != "weak_assertions":
        return True  # Only applies to weak_assertions scenarios
    if "weak_assertion_keywords" not in scenario:
        return True
    lower = response.lower()
    # Must reference at least one weak pattern
    mentions_weakness = any(kw in lower for kw in scenario["weak_assertion_keywords"])
    # Must indicate fixing it
    fix_signals = ["strengthen", "tighten", "improve", "specific", "exact", "assert"]
    mentions_fix = any(signal in lower for signal in fix_signals)
    return mentions_weakness and mentions_fix


# ── Browser verification (Mode 4) ──────────────────────────────────────────────

def browser_verify_uses_evidence(response: str, scenario: dict = None) -> bool:
    """When any browser_verify scenario, response must reference visual or diagnostic evidence."""
    if not scenario or not scenario.get("type", "").startswith("browser_verify"):
        return True  # Only applies to browser_verify scenarios
    # The blocked-MCP case is exempt — Pippin can't gather evidence with no tools
    if scenario.get("type") == "browser_verify_blocked_mcp":
        return True
    lower = response.lower()
    evidence_signals = ["screenshot", "snapshot", "console", "network", "browser_", "steps taken", "what was verified"]
    return any(signal in lower for signal in evidence_signals)


def browser_verify_catches_console_error(response: str, scenario: dict = None) -> bool:
    """When browser_verify_console_error scenario, Pippin must surface the console error and not report plain DONE."""
    if not scenario or scenario.get("type") != "browser_verify_console_error":
        return True
    lower = response.lower()
    # Must reference the console error
    mentions_error = "console" in lower and ("error" in lower or "typeerror" in lower or "uncaught" in lower)
    if not mentions_error:
        return False
    # Status must NOT be plain DONE — Pippin found an issue and must reflect it
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            if value == "DONE":
                # Exception: DONE is acceptable only if the response includes a clear Issues found / Findings section
                return "issues found:" in lower or "findings:" in lower
            return value in {"DONE_WITH_CONCERNS", "BLOCKED", "NEEDS_CONTEXT"}
    return False


def browser_verify_blocked_on_mcp(response: str, scenario: dict = None) -> bool:
    """When browser_verify_blocked_mcp scenario, status must be BLOCKED and the response must reference Playwright."""
    if not scenario or scenario.get("type") != "browser_verify_blocked_mcp":
        return True
    lower = response.lower()
    # Must reference the actual blocker — the Playwright MCP
    if "playwright" not in lower:
        return False
    # Status must be BLOCKED
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value == "BLOCKED"
    return False  # No status line found


def browser_verify_catches_network_failure(response: str, scenario: dict = None) -> bool:
    """When browser_verify_network_error scenario, Pippin must surface the failed network request."""
    if not scenario or scenario.get("type") != "browser_verify_network_error":
        return True
    lower = response.lower()
    # Must reference the failed request — either the status code or the failure
    mentions_failure = ("500" in lower or "internal server error" in lower) and (
        "network" in lower or "/api/search" in lower or "request" in lower or "api" in lower
    )
    if not mentions_failure:
        return False
    # Must not report plain DONE without surfacing the issue
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            if value == "DONE":
                return "issues found:" in lower or "findings:" in lower
            return value in {"DONE_WITH_CONCERNS", "BLOCKED", "NEEDS_CONTEXT"}
    return False


# ── Registry and runner ────────────────────────────────────────────────────────

ASSERTIONS = [
    has_status,
    has_test_files_section,
    no_vague_verification,
    reports_spec_violations,
    no_diagnostic_warnings_ignored,
    blocked_on_missing_infra,
    no_weak_assertions_ignored,
    browser_verify_uses_evidence,
    browser_verify_catches_console_error,
    browser_verify_blocked_on_mcp,
    browser_verify_catches_network_failure,
]


def run_assertions(response: str, scenario: dict = None) -> dict:
    """Run all assertions against response. Returns {name: bool}."""
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
