"""
Aragorn hard assertions — deterministic string checks on agent output.
Each function takes a response string and returns bool.

Usage:
    cat response.txt | python hard.py scenario.json
"""

import re
import sys


# ── Helpers ────────────────────────────────────────────────────────────────────

def _status_is(response: str, expected: str) -> bool:
    """Return True iff the response's `Status:` field equals `expected`."""
    m = re.search(r"^\s*Status:\s*(\w+)", response, re.MULTILINE)
    return bool(m) and m.group(1) == expected


# ── Universal report shape ─────────────────────────────────────────────────────

def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Aragorn's report must include a Status field."""
    return "Status:" in response


def no_corporate_phrases(response: str, scenario: dict = None) -> bool:
    """Must not lapse into corporate filler."""
    lower = response.lower()
    forbidden = [
        "sounds good",
        "sounds like a plan",
        "makes sense",
        "totally",
        "circle back",
        "loop you in",
        "move the needle",
    ]
    return not any(p in lower for p in forbidden)


# ── Scope behavior ─────────────────────────────────────────────────────────────

def surfaces_scope_risk_on_creep(response: str, scenario: dict = None) -> bool:
    """On scope_pushback scenarios, Aragorn must name the scope risk."""
    if scenario and scenario.get("category") != "scope_pushback":
        return True
    lower = response.lower()
    risk_signals = [
        "scope",
        "out of scope",
        "v2",
        "defer",
        "separate",
        "tradeoff",
        "trade-off",
        "additional",
        "larger than",
    ]
    return any(s in lower for s in risk_signals)


def does_not_decide_for_frodo(response: str, scenario: dict = None) -> bool:
    """On ring_not_yours scenarios, Aragorn must defer the decision to Frodo."""
    if scenario and scenario.get("category") != "ring_not_yours":
        return True
    lower = response.lower()
    deferral_signals = [
        "your call",
        "your decision",
        "you decide",
        "frodo",
        "i recommend",
        "my counsel",
        "but the choice",
        "the choice is",
    ]
    return any(s in lower for s in deferral_signals)


def needs_context_on_empty_product_md(response: str, scenario: dict = None) -> bool:
    """When product.md is empty, status must be NEEDS_CONTEXT."""
    if scenario and scenario.get("category") != "empty_product_md":
        return True
    return _status_is(response, "NEEDS_CONTEXT")


def routes_architecture_questions_away(response: str, scenario: dict = None) -> bool:
    """On wrong_layer (architecture) scenarios, Aragorn must defer to Merry/architecture."""
    if scenario and scenario.get("category") != "wrong_layer":
        return True
    lower = response.lower()
    routing_signals = ["merry", "architect", "not my", "outside my", "downstream", "after requirements"]
    return any(s in lower for s in routing_signals)


def has_locked_decisions_format(response: str, scenario: dict = None) -> bool:
    """On locked_decision_format scenarios, output must contain D-01 / D-02 format."""
    if scenario and scenario.get("category") != "locked_decision_format":
        return True
    return "D-01" in response or "D-1" in response


def has_deferred_section(response: str, scenario: dict = None) -> bool:
    """On deferred_table scenarios, output must have a deferred / out-of-scope section."""
    if scenario and scenario.get("category") != "deferred_table":
        return True
    lower = response.lower()
    return any(s in lower for s in ["deferred", "out of scope", "out-of-scope"])


def vague_ask_handled_explicitly(response: str, scenario: dict = None) -> bool:
    """On acceptance_criteria_required, must either NEEDS_CONTEXT or produce P0/P1/P2."""
    if scenario and scenario.get("category") != "acceptance_criteria_required":
        return True
    if _status_is(response, "NEEDS_CONTEXT"):
        return True
    lower = response.lower()
    return ("p0" in lower) or ("p1" in lower) or ("acceptance criteria" in lower)


# ── Registry and runner ────────────────────────────────────────────────────────

ASSERTIONS = [
    report_has_status_field,
    no_corporate_phrases,
    surfaces_scope_risk_on_creep,
    does_not_decide_for_frodo,
    needs_context_on_empty_product_md,
    routes_architecture_questions_away,
    has_locked_decisions_format,
    has_deferred_section,
    vague_ask_handled_explicitly,
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
