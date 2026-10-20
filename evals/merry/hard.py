"""
Merry hard assertions — deterministic string checks on agent output.
"""

import re
import sys


def _status_is(response: str, expected: str) -> bool:
    """Return True iff the response's `Status:` field equals `expected`."""
    m = re.search(r"^\s*Status:\s*(\w+)", response, re.MULTILINE)
    return bool(m) and m.group(1) == expected


def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Merry's report must include a Status field."""
    return "Status:" in response


def evaluates_multiple_approaches(response: str, scenario: dict = None) -> bool:
    """On evaluate_approaches, must show at least 2 alternatives."""
    if scenario and scenario.get("category") != "evaluate_approaches":
        return True
    lower = response.lower()
    # Look for option markers or named alternatives
    option_markers = [
        "option a", "option b", "option 1", "option 2",
        "approach 1", "approach 2", "approach a", "approach b",
        "alternative", "tradeoff", "trade-off",
        " vs. ", " vs ", "versus",
    ]
    matches = sum(1 for m in option_markers if m in lower)
    return matches >= 2


def routes_vague_to_aragorn(response: str, scenario: dict = None) -> bool:
    """On boundary_to_aragorn, must NEEDS_CONTEXT or name Aragorn/requirements."""
    if scenario and scenario.get("category") != "boundary_to_aragorn":
        return True
    if _status_is(response, "NEEDS_CONTEXT"):
        return True
    lower = response.lower()
    return "aragorn" in lower or "requirements" in lower


def recommends_simpler_at_current_scale(response: str, scenario: dict = None) -> bool:
    """On premature_complexity, must recommend simpler approach and name overkill."""
    if scenario and scenario.get("category") != "premature_complexity":
        return True
    lower = response.lower()
    simpler_signals = ["simpler", "overkill", "premature", "current scale", "50 users", "~50", "preferences table"]
    return any(s in lower for s in simpler_signals)


def contract_has_concrete_signatures(response: str, scenario: dict = None) -> bool:
    """On interface_contracts_concrete, must include type signatures with parens and types."""
    if scenario and scenario.get("category") != "interface_contracts_concrete":
        return True
    # Look for at least one function signature pattern: name(...)
    has_signature = bool(re.search(r"\w+\s*\([^)]*:\s*\w+", response)) or "Promise<" in response or "=>" in response
    has_error_case = "throw" in response.lower() or "error" in response.lower() or "reject" in response.lower()
    return has_signature and has_error_case


def declines_implementation(response: str, scenario: dict = None) -> bool:
    """On wrong_layer_no_code, must defer to Gimli, no implementation block."""
    if scenario and scenario.get("category") != "wrong_layer_no_code":
        return True
    lower = response.lower()
    return "gimli" in lower or "not my" in lower or "architecture" in lower or "interface" in lower


def adr_includes_if_wrong(response: str, scenario: dict = None) -> bool:
    """On if_wrong_test, must include consequences-if-wrong language."""
    if scenario and scenario.get("category") != "if_wrong_test":
        return True
    lower = response.lower()
    signals = ["if wrong", "if this assumption", "if the assumption", "consequences", "what breaks", "if it fails", "migration path", "if we exceed", "if we outgrow"]
    return any(s in lower for s in signals)


def adr_saved_to_specs_path(response: str, scenario: dict = None) -> bool:
    """On adr_path, must reference docs/fellowship/specs/merry-adr-*.md."""
    if scenario and scenario.get("category") != "adr_path":
        return True
    return "docs/fellowship/specs/merry-adr-" in response


ASSERTIONS = [
    report_has_status_field,
    evaluates_multiple_approaches,
    routes_vague_to_aragorn,
    recommends_simpler_at_current_scale,
    contract_has_concrete_signatures,
    declines_implementation,
    adr_includes_if_wrong,
    adr_saved_to_specs_path,
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
