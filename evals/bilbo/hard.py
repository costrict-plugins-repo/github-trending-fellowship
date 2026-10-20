"""
Bilbo hard assertions — deterministic string checks on agent output.
"""

import re
import sys


def _status_is(response: str, expected: str) -> bool:
    """Return True iff the response's `Status:` field equals `expected`."""
    m = re.search(r"^\s*Status:\s*(\w+)", response, re.MULTILINE)
    return bool(m) and m.group(1) == expected


def report_has_status_field(response: str, scenario: dict = None) -> bool:
    """Bilbo's report must include a Status field."""
    return "Status:" in response


def refuses_thin_air_readme(response: str, scenario: dict = None) -> bool:
    """On readme_from_thin_air, must NEEDS_CONTEXT and not invent."""
    if scenario and scenario.get("category") != "readme_from_thin_air":
        return True
    return _status_is(response, "NEEDS_CONTEXT")


def detects_doc_contradiction(response: str, scenario: dict = None) -> bool:
    """On stale_doc_detection, must mention null/None and correct the docstring."""
    if scenario and scenario.get("category") != "stale_doc_detection":
        return True
    lower = response.lower()
    return "null" in lower and ("not found" in lower or "doesn't exist" in lower or "missing" in lower or "or null" in lower)


def routes_templates_to_references(response: str, scenario: dict = None) -> bool:
    """On template_extraction_inline, must route to references/, not inline."""
    if scenario and scenario.get("category") != "template_extraction_inline":
        return True
    lower = response.lower()
    return "references/" in lower or "reference file" in lower or "extract" in lower


def declines_marketing_copy(response: str, scenario: dict = None) -> bool:
    """On marketing_copy_refusal, must defer/decline."""
    if scenario and scenario.get("category") != "marketing_copy_refusal":
        return True
    lower = response.lower()
    decline_signals = ["not my", "out of scope", "outside", "not the fellowship", "marketing", "decline", "not bilbo"]
    return any(s in lower for s in decline_signals)


def avoids_performative_phrasing(response: str, scenario: dict = None) -> bool:
    """On plain_prose, must not use performative phrasing."""
    if scenario and scenario.get("category") != "plain_prose":
        return True
    lower = response.lower()
    forbidden = [
        "gracefully handles",
        "gracefully manages",
        "elegantly",
        "robustly handles",
        "seamlessly",
        "leverages",
        "absence of a user record",
    ]
    return not any(p in lower for p in forbidden)


def changelog_uses_specifics(response: str, scenario: dict = None) -> bool:
    """On changelog_specificity, must NOT use vague filler bullets."""
    if scenario and scenario.get("category") != "changelog_specificity":
        return True
    lower = response.lower()
    # Vague phrases that are bad as standalone bullets but fine as section
    # headings (e.g. "### Bug Fixes"). Match only when they appear as a list
    # bullet on their own line.
    bullet_vague = [
        r"various improvements",
        r"bug fixes",
        r"performance enhancements",
        r"miscellaneous",
        r"various fixes",
        r"minor improvements",
    ]
    for phrase in bullet_vague:
        if re.search(rf"^\s*[-*]\s*{phrase}\s*$", lower, re.MULTILINE):
            return False
    return True


def changelog_uses_keep_a_changelog_headers(response: str, scenario: dict = None) -> bool:
    """On keep_a_changelog_format, must use Added/Changed/Fixed/Removed headings."""
    if scenario and scenario.get("category") != "keep_a_changelog_format":
        return True
    headers = ["### Added", "### Fixed", "### Removed", "### Changed"]
    found = sum(1 for h in headers if h in response)
    return found >= 2


def documentation_grounded_no_invention(response: str, scenario: dict = None) -> bool:
    """On should_document, must not invent capabilities not shown in source."""
    if scenario and scenario.get("category") != "should_document":
        return True
    lower = response.lower()
    invented = ["redis", "distributed", "cluster-aware", "horizontally scalable", "multi-region"]
    return not any(i in lower for i in invented)


ASSERTIONS = [
    report_has_status_field,
    refuses_thin_air_readme,
    detects_doc_contradiction,
    routes_templates_to_references,
    declines_marketing_copy,
    avoids_performative_phrasing,
    changelog_uses_specifics,
    changelog_uses_keep_a_changelog_headers,
    documentation_grounded_no_invention,
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
