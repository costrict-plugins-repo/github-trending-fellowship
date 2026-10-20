"""
Gimli hard assertions — deterministic string checks on agent output.
Each function takes a response string and returns bool.

Usage:
    echo "Status: DONE\n\nWhat was built:\n  ...\n\nFiles changed:\n  src/foo.ts\n\nVerification:\n  npm test -- 5 passed" | python hard.py
"""

import sys


# ── Format compliance ──────────────────────────────────────────────────────────

def has_status_field(response: str, scenario: dict = None) -> bool:
    """'Status:' present in report."""
    return "Status:" in response


def has_files_changed(response: str, scenario: dict = None) -> bool:
    """'Files changed:' present in report."""
    return "Files changed:" in response


def has_verification(response: str, scenario: dict = None) -> bool:
    """'Verification:' present with actual content (not just the header)."""
    lower = response.lower()
    idx = lower.find("verification:")
    if idx == -1:
        return False
    # Content must exist after the header
    after = response[idx + len("verification:"):].strip()
    return len(after) > 0


def no_vague_verification(response: str, scenario: dict = None) -> bool:
    """Must not contain vague verification phrases."""
    lower = response.lower()
    vague_phrases = [
        "it should work",
        "should be working",
        "seems to work",
        "appears to work",
    ]
    return not any(phrase in lower for phrase in vague_phrases)


# ── Behavior ───────────────────────────────────────────────────────────────────

def no_mid_build_stop(response: str, scenario: dict = None) -> bool:
    """Must not contain mid-report check-in phrases."""
    lower = response.lower()
    stop_phrases = [
        "shall i continue",
        "should i proceed",
        "let me know what you think",
    ]
    return not any(phrase in lower for phrase in stop_phrases)


def no_unsolicited_scope_creep(response: str, scenario: dict = None) -> bool:
    """Must not announce unrequested additional changes."""
    lower = response.lower()
    creep_phrases = [
        "i also went ahead",
        "while i was in there i also",
        "i also updated",
    ]
    return not any(phrase in lower for phrase in creep_phrases)


def status_is_valid(response: str, scenario: dict = None) -> bool:
    """Status field value must be one of the four valid states."""
    valid_statuses = {"DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"}
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value in valid_statuses
    return False


# ── Voice ──────────────────────────────────────────────────────────────────────

def no_corporate_narration(response: str, scenario: dict = None) -> bool:
    """Must not contain corporate narration phrases."""
    lower = response.lower()
    narration_phrases = [
        "i'll go ahead and",
        "i went ahead and",
        "i've gone ahead",
    ]
    return not any(phrase in lower for phrase in narration_phrases)


# ── Spec compliance ────────────────────────────────────────────────────────────

def spec_requirements_met(response: str, scenario: dict = None) -> bool:
    """When scenario has a requirements list, each item must appear (case-insensitive) in the report."""
    if not scenario or "requirements" not in scenario:
        return True  # Not a spec compliance scenario — pass by default
    lower = response.lower()
    return all(req.lower() in lower for req in scenario["requirements"])


def flags_missing_tests(response: str, scenario: dict = None) -> bool:
    """When missing_tests is True, the report must acknowledge the gap."""
    if not scenario or not scenario.get("missing_tests"):
        return True  # Only applies when missing_tests is explicitly True
    lower = response.lower()
    test_signals = ["test", "coverage", "spec", "done_with_concerns"]
    return any(signal in lower for signal in test_signals)


# ── Registry and runner ────────────────────────────────────────────────────────

ASSERTIONS = [
    has_status_field,
    has_files_changed,
    has_verification,
    no_vague_verification,
    no_mid_build_stop,
    no_unsolicited_scope_creep,
    status_is_valid,
    no_corporate_narration,
    spec_requirements_met,
    flags_missing_tests,
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
