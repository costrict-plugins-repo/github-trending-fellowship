"""
Arwen hard assertions — deterministic string checks on agent output.
"""

import re
import sys


def _status_is(response: str, expected: str) -> bool:
    """Return True iff the response's `Status:` field equals `expected`."""
    m = re.search(r"^\s*Status:\s*(\w+)", response, re.MULTILINE)
    return bool(m) and m.group(1) == expected


def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Arwen's report must include a Status field."""
    return "Status:" in response


def flags_missing_accessible_name(response: str, scenario: dict = None) -> bool:
    """On a11y_flag scenarios, Arwen must call out the missing accessible name."""
    if scenario and scenario.get("category") != "a11y_flag":
        return True
    lower = response.lower()
    signals = ["aria-label", "accessible name", "screen reader", "wcag", "1.1.1", "4.1.2", "icon-only", "no label"]
    return any(s in lower for s in signals)


def does_not_manufacture_findings(response: str, scenario: dict = None) -> bool:
    """On should_not_a11y_flag, Arwen approves without inventing issues."""
    if scenario and scenario.get("category") != "should_not_a11y_flag":
        return True
    # Arwen's status enum: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED.
    # Clean approve = Status: DONE (not DONE_WITH_CONCERNS), and the Findings:
    # section has no numbered items. Don't reject the prose word "critical".
    if not _status_is(response, "DONE"):
        return False
    # Findings: section with numbered items signals manufactured findings.
    findings_block = re.search(
        r"^\s*Findings:\s*\n((?:\s+.+\n?)+)",
        response,
        re.MULTILINE,
    )
    if findings_block:
        body = findings_block.group(1)
        if re.search(r"^\s*\d+\.\s+\S", body, re.MULTILINE):
            return False
    return True


def needs_context_when_no_contract(response: str, scenario: dict = None) -> bool:
    """On no_design_contract scenarios, status must be NEEDS_CONTEXT."""
    if scenario and scenario.get("category") != "no_design_contract":
        return True
    return _status_is(response, "NEEDS_CONTEXT")


def declines_backend_work(response: str, scenario: dict = None) -> bool:
    """On wrong_layer scenarios, Arwen must defer to Gimli."""
    if scenario and scenario.get("category") != "wrong_layer":
        return True
    lower = response.lower()
    deferral = ["gimli", "not my", "outside my", "not arwen", "design domain", "design only"]
    return any(s in lower for s in deferral)


def design_contract_uses_concrete_values(response: str, scenario: dict = None) -> bool:
    """On design_contract_specificity, contract must use concrete units, not ranges."""
    if scenario and scenario.get("category") != "design_contract_specificity":
        return True
    lower = response.lower()
    # Concrete unit: a digit immediately followed by px/rem/em, OR a Tailwind /
    # design-token reference (text-base, space-4, gap-2, p-4, m-2, etc.).
    has_unit = bool(re.search(r"\d+\s*(px|rem|em)", lower))
    has_token = bool(
        re.search(
            r"\b(text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)|space-\d+|gap-\d+|[pm][xytrbl]?-\d+|w-\d+|h-\d+)\b",
            lower,
        )
    )
    has_concrete = has_unit or has_token
    # Exploratory phrasing forbidden
    exploratory = ["consider", "something around", "maybe", "around 14", "around 16", "14-16", "14 to 16"]
    has_exploratory = any(p in lower for p in exploratory)
    return has_concrete and not has_exploratory


def figma_blocked_reports_blocked(response: str, scenario: dict = None) -> bool:
    """On figma_blocked scenarios, status must be BLOCKED with plugin recovery hint."""
    if scenario and scenario.get("category") != "figma_blocked":
        return True
    if "BLOCKED" not in response:
        return False
    lower = response.lower()
    hints = ["plugin", "figma desktop", "figma console", "not open"]
    return any(h in lower for h in hints)


def compliance_check_not_full_audit(response: str, scenario: dict = None) -> bool:
    """On compliance_vs_full_audit, response should mention contract/compliance, not 6 pillars."""
    if scenario and scenario.get("category") != "compliance_vs_full_audit":
        return True
    lower = response.lower()
    has_compliance_framing = any(s in lower for s in ["contract", "compliance", "spec", "matches"])
    runs_full_audit = "6 pillar" in lower or "six pillar" in lower or "pillar score" in lower
    return has_compliance_framing and not runs_full_audit


ASSERTIONS = [
    report_has_status_field,
    flags_missing_accessible_name,
    does_not_manufacture_findings,
    needs_context_when_no_contract,
    declines_backend_work,
    design_contract_uses_concrete_values,
    figma_blocked_reports_blocked,
    compliance_check_not_full_audit,
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
