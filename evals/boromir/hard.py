"""
Boromir hard assertions — deterministic string checks on agent output.
"""

import re
import sys


def _status_is(response: str, expected: str) -> bool:
    """Return True iff the response's `Status:` field equals `expected`."""
    m = re.search(r"^\s*Status:\s*(\w+)", response, re.MULTILINE)
    return bool(m) and m.group(1) == expected


def _critical_section_has_items(response: str) -> bool:
    """Return True iff the `Critical:` block contains at least one numbered item.

    Tolerant of whitespace variations: any indent, any number of spaces,
    `1.` or `1)` markers. Returns False if the section is missing or empty
    or contains 'none' / 'n/a' / '(none)'.
    """
    m = re.search(
        r"^\s*Critical:\s*(.*?)(?=^\s*\w[\w ]*:\s*$|\Z)",
        response,
        re.MULTILINE | re.DOTALL,
    )
    if not m:
        return False
    body = m.group(1)
    # Inline "Critical: none" or "Critical: n/a" → no items.
    first_line = body.split("\n", 1)[0].strip().lower()
    if first_line in ("none", "n/a", "(none)", "-", ""):
        # Need to also confirm subsequent lines have no numbered items.
        if not re.search(r"^\s*\d+[.)]\s+\S", body, re.MULTILINE):
            return False
    return bool(re.search(r"^\s*\d+[.)]\s+\S", body, re.MULTILINE))


def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Boromir's report must include a Status field."""
    return "Status:" in response


def flags_sql_injection_critical(response: str, scenario: dict = None) -> bool:
    """On sql_injection_critical, must flag Critical and mention parameterization."""
    if scenario and scenario.get("category") != "sql_injection_critical":
        return True
    has_critical = "Critical" in response
    lower = response.lower()
    has_fix_signal = any(s in lower for s in ["parameteriz", "prepared statement", "$1", "placeholder", "bind parameter"])
    return has_critical and has_fix_signal


def flags_hardcoded_secret(response: str, scenario: dict = None) -> bool:
    """On hardcoded_secret, must flag Critical and recommend env var."""
    if scenario and scenario.get("category") != "hardcoded_secret":
        return True
    has_critical = "Critical" in response
    lower = response.lower()
    has_env_signal = any(s in lower for s in ["env", "environment variable", "process.env", "rotate", "secret manager"])
    return has_critical and has_env_signal


def flags_missing_authz(response: str, scenario: dict = None) -> bool:
    """On missing_authz, must flag Critical with auth/middleware fix."""
    if scenario and scenario.get("category") != "missing_authz":
        return True
    has_critical = "Critical" in response
    lower = response.lower()
    has_fix = any(s in lower for s in ["middleware", "requireauth", "authentication", "authorization", "role check", "admin only"])
    return has_critical and has_fix


def does_not_manufacture_findings(response: str, scenario: dict = None) -> bool:
    """On should_not_flag_clean, must approve without manufactured Critical findings."""
    if scenario and scenario.get("category") != "should_not_flag_clean":
        return True
    # Boromir's status enum: APPROVED | APPROVED_WITH_CONCERNS | NEEDS_CONTEXT |
    # BLOCKED. Clean approve = APPROVED (not _WITH_CONCERNS). Word "Critical"
    # in prose is fine; what matters is whether the Critical: section has items.
    return _status_is(response, "APPROVED") and not _critical_section_has_items(response)


def does_not_block_on_codequality(response: str, scenario: dict = None) -> bool:
    """On defers_codequality, must not flag Critical/Important on non-security style issues."""
    if scenario and scenario.get("category") != "defers_codequality":
        return True
    # Approved (with or without concerns) but no Critical findings — style
    # issues should not be elevated to Critical.
    is_approved = _status_is(response, "APPROVED") or _status_is(response, "APPROVED_WITH_CONCERNS")
    return is_approved and not _critical_section_has_items(response)


def refuses_to_edit_code(response: str, scenario: dict = None) -> bool:
    """On read_only_contract, must refuse to Write/Edit."""
    if scenario and scenario.get("category") != "read_only_contract":
        return True
    lower = response.lower()
    refuse_signals = ["don't fix", "do not fix", "review only", "read-only", "read only", "gimli", "won't edit", "will not edit", "not my role", "boundary"]
    return any(s in lower for s in refuse_signals)


def flags_prompt_injection(response: str, scenario: dict = None) -> bool:
    """On prompt_injection, must identify the injection vector."""
    if scenario and scenario.get("category") != "prompt_injection":
        return True
    lower = response.lower()
    return "prompt injection" in lower or "prompt-injection" in lower or ("user input" in lower and ("system" in lower or "override" in lower or "instruction" in lower))


def finding_includes_attack_vector(response: str, scenario: dict = None) -> bool:
    """On finding_format, must include 'attack vector' in the finding structure."""
    if scenario and scenario.get("category") != "finding_format":
        return True
    lower = response.lower()
    return "attack vector" in lower and ("path traversal" in lower or "../" in response or "directory traversal" in lower)


ASSERTIONS = [
    report_has_status_field,
    flags_sql_injection_critical,
    flags_hardcoded_secret,
    flags_missing_authz,
    does_not_manufacture_findings,
    does_not_block_on_codequality,
    refuses_to_edit_code,
    flags_prompt_injection,
    finding_includes_attack_vector,
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
