"""
Legolas hard assertions — deterministic string checks on agent output.
Each function takes a response string and returns bool.

Usage:
    echo "Status: APPROVED\n\nFindings:\n  Critical: src/config.ts line 14 — null not handled" | python hard.py
"""

import re
import sys


# ── Structure ──────────────────────────────────────────────────────────────────

def has_status(response: str, scenario: dict = None) -> bool:
    """Status field is one of the four valid Legolas states."""
    valid_statuses = {"APPROVED", "APPROVED_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"}
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value in valid_statuses
    return False


def has_findings_section(response: str, scenario: dict = None) -> bool:
    """'Findings:' or 'Issues:' section present in response."""
    lower = response.lower()
    return "findings:" in lower or "issues:" in lower


def findings_have_severity(response: str, scenario: dict = None) -> bool:
    """At least one finding must include a severity label."""
    severity_labels = ["critical", "important", "minor", "suggestion"]
    lower = response.lower()
    return any(label in lower for label in severity_labels)


def findings_reference_specifics(response: str, scenario: dict = None) -> bool:
    """At least one finding references a file name or line concept."""
    # Matches patterns like: src/foo.ts, foo.ts, line 42, line X, /api/
    file_pattern = re.compile(r'\b\w+\.\w{2,4}\b')
    line_pattern = re.compile(r'\bline\s+\d+\b', re.IGNORECASE)
    return bool(file_pattern.search(response) or line_pattern.search(response))


# ── Behavior ───────────────────────────────────────────────────────────────────

def no_code_edits_proposed(response: str, scenario: dict = None) -> bool:
    """Legolas never proposes inline code edits."""
    lower = response.lower()
    edit_phrases = [
        "change line",
        "replace with",
        "here is the corrected",
    ]
    return not any(phrase in lower for phrase in edit_phrases)


def no_vague_approval(response: str, scenario: dict = None) -> bool:
    """APPROVED status must not be accompanied by zero findings or observations."""
    # First check if status is APPROVED (not APPROVED_WITH_CONCERNS)
    status_approved = False
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            if value == "APPROVED":
                status_approved = True
            break

    if not status_approved:
        return True  # Only applies to bare APPROVED

    # Must have some findings or observations content
    lower = response.lower()
    return "findings:" in lower or "issues:" in lower or "observations:" in lower


# ── Correctness ────────────────────────────────────────────────────────────────

def finds_planted_bug(response: str, scenario: dict = None) -> bool:
    """When scenario contains bug_keywords, at least one must appear in the response."""
    if not scenario or "bug_keywords" not in scenario:
        return True  # Not a correctness scenario — pass by default
    lower = response.lower()
    return any(kw in lower for kw in scenario["bug_keywords"])


def no_false_approval_on_bugs(response: str, scenario: dict = None) -> bool:
    """When bug_keywords present, status must NOT be bare APPROVED — must be APPROVED_WITH_CONCERNS or stronger."""
    if not scenario or "bug_keywords" not in scenario:
        return True  # Only applies to correctness scenarios with planted bugs
    for line in response.splitlines():
        stripped = line.strip()
        if stripped.startswith("Status:"):
            value = stripped[len("Status:"):].strip()
            return value != "APPROVED"
    return True  # No status line — let has_status catch it


def bug_severity_correct(response: str, scenario: dict = None) -> bool:
    """When scenario contains expected_severity, that word must appear in the response."""
    if not scenario or "expected_severity" not in scenario:
        return True  # Not a severity-rated scenario — pass by default
    expected = scenario["expected_severity"].lower()
    return expected in response.lower()


# ── Registry and runner ────────────────────────────────────────────────────────

ASSERTIONS = [
    has_status,
    has_findings_section,
    findings_have_severity,
    findings_reference_specifics,
    no_code_edits_proposed,
    no_vague_approval,
    finds_planted_bug,
    no_false_approval_on_bugs,
    bug_severity_correct,
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
