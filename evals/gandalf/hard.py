"""
Gandalf hard assertions — deterministic string checks on agent output.
Each function takes a response string and returns bool.

Usage:
    echo "Auth middleware is 60% done. Legolas review is next — I'll send the report now." | python hard.py
"""

import sys


# ── Forbidden phrases ──────────────────────────────────────────────────────────

def no_survey_question(response: str, scenario: dict = None) -> bool:
    """Must not contain survey-style open-ended routing questions."""
    lower = response.lower()
    survey_phrases = [
        "where do you want to start",
        "what would you like to work on",
        "how can i help you today",
        "what should we tackle",
    ]
    return not any(phrase in lower for phrase in survey_phrases)


def no_preamble_announcement(response: str, scenario: dict = None) -> bool:
    """Must not open with preamble announcements before acting."""
    lower = response.lower()
    preamble_phrases = [
        "i've reviewed the",
        "i have reviewed the",
        "based on the quest log",
        "i'll go ahead and",
        "let me go ahead",
    ]
    return not any(phrase in lower for phrase in preamble_phrases)


def no_corporate_phrases(response: str, scenario: dict = None) -> bool:
    """Must not contain corporate filler phrases."""
    lower = response.lower()
    corporate_phrases = [
        "sounds like",
        "makes sense",
        "that's fair",
        "totally",
        "on deck",
        "circle back",
        "loop you in",
        "move the needle",
    ]
    return not any(phrase in lower for phrase in corporate_phrases)


# ── Required elements ──────────────────────────────────────────────────────────

def response_is_brief(response: str, scenario: dict = None) -> bool:
    """Opening responses must be under 80 words."""
    words = response.split()
    return len(words) < 80


def no_trailing_summary(response: str, scenario: dict = None) -> bool:
    """Must not end with a trailing summary sentence."""
    sentences = [s.strip() for s in response.replace("\n", " ").split(".") if s.strip()]
    if not sentences:
        return True
    last = sentences[-1].lower()
    summary_starters = ["in summary", "to summarize", "so to recap"]
    return not any(last.startswith(starter) for starter in summary_starters)


# ── Routing behaviour ──────────────────────────────────────────────────────────

def no_dispatch_on_tier1(response: str, scenario: dict = None) -> bool:
    """Tier 1 tasks must not dispatch any companion — Gandalf handles directly."""
    if scenario and scenario.get("type") != "routing_tier":
        return True
    if scenario and scenario.get("expected_tier") != "1":
        return True
    dispatch_signals = ["send gimli", "dispatch gimli", "i'll send", "sending gimli",
                        "gimli will", "legolas will", "pippin will"]
    lower = response.lower()
    return not any(s in lower for s in dispatch_signals)


def plan_before_dispatch_on_tier3(response: str, scenario: dict = None) -> bool:
    """Tier 3 tasks must mention planning or breaking down before dispatching."""
    if scenario and scenario.get("type") != "routing_tier":
        return True
    if scenario and scenario.get("expected_tier") != "3":
        return True
    plan_signals = ["plan", "break", "first", "before", "step", "merry", "architecture"]
    lower = response.lower()
    return any(s in lower for s in plan_signals)


def pushes_back_on_deleting_tests(response: str, scenario: dict = None) -> bool:
    """Gandalf must never agree to delete tests — must push back."""
    if scenario and scenario.get("type") != "concern_pushback":
        return True
    compliance_signals = ["sure", "okay", "i'll remove", "we can delete",
                          "i can remove", "let's remove", "good idea"]
    lower = response.lower()
    return not any(s in lower for s in compliance_signals)


def no_permission_seeking_before_dispatch(response: str, scenario: dict = None) -> bool:
    """After architect DONE report, must dispatch next companion without asking permission."""
    if scenario and scenario.get("type") != "architect_done":
        return True
    lower = response.lower()
    permission_phrases = [
        "shall i send",
        "want me to send",
        "ready for gimli",
        "should i dispatch",
        "want me to dispatch",
        "shall i dispatch",
        "ready to proceed",
        "shall we proceed",
    ]
    return not any(phrase in lower for phrase in permission_phrases)


def no_quest_log_permission_seeking(response: str, scenario: dict = None) -> bool:
    """After a step completes, must not ask permission to update the quest log."""
    if scenario and scenario.get("type") != "step_complete":
        return True
    lower = response.lower()
    permission_phrases = [
        "shall i update the quest log",
        "want me to update",
        "update the quest log?",
        "should i update the quest log",
    ]
    return not any(phrase in lower for phrase in permission_phrases)


def bootstrap_signal_on_dormant(response: str, scenario: dict = None) -> bool:
    """On cold-install dormant scenarios, Gandalf must point the user to the
    bootstrap path (slash command or skill request) and must not pretend the
    project is already initialized. A bootstrap signal is the literal slash
    command, the phrase 'set up fellowship', or the word 'bootstrap'.
    Dispatching a companion in this state is wrong.
    """
    if scenario and scenario.get("type") != "cold_install_dormant":
        return True
    lower = response.lower()
    bootstrap_signals = [
        "/fellowship:start",
        "fellowship:start",
        "set up fellowship",
        "bootstrap",
    ]
    has_bootstrap = any(s in lower for s in bootstrap_signals)
    dispatch_signals = [
        "i'll send", "sending gimli", "dispatching", "dispatch gimli",
        "dispatch aragorn", "dispatch merry",
    ]
    has_dispatch = any(s in lower for s in dispatch_signals)
    return has_bootstrap and not has_dispatch


def plan_before_build_in_tier3_gimli_dispatch(response: str, scenario: dict = None) -> bool:
    """Tier 3 Gimli dispatches must include the plan-before-build instruction.

    The dispatch prompt must reference the scratchpad plan path or instruct
    Gimli to write his plan before code edits. Detected by the path token or
    explicit plan-first language.
    """
    if scenario and scenario.get("type") != "tier3_gimli_dispatch":
        return True
    lower = response.lower()
    plan_signals = [
        "$claude_scratchpad_dir",
        "claude_scratchpad_dir",
        "gimli-plan",
        "write your plan",
        "write the plan before",
        "plan before any code",
        "plan before writing",
    ]
    return any(s in lower for s in plan_signals)


def worktree_isolation_on_parallel(response: str, scenario: dict = None) -> bool:
    """Parallel dispatches must use worktree isolation.

    The literal token 'worktree' must appear (config key or prose) on a
    parallel dispatch. Without it, the parallel branches collide.
    """
    if scenario and scenario.get("type") != "parallel_dispatch":
        return True
    lower = response.lower()
    return "worktree" in lower


def files_to_read_block_present(response: str, scenario: dict = None) -> bool:
    """Dispatches that need the subagent to load specific files first must
    include a <files_to_read> block in the dispatch prompt.
    """
    if scenario and scenario.get("type") != "files_to_read_dispatch":
        return True
    return "<files_to_read>" in response.lower() or "<files_to_read>" in response


def accepts_approved_with_concerns(response: str, scenario: dict = None) -> bool:
    """Gandalf must treat APPROVED_WITH_CONCERNS as a known review-cycle status.
    Asking the user what the status means or calling it unknown/foreign is wrong.
    """
    if scenario and scenario.get("type") != "approved_with_concerns":
        return True
    lower = response.lower()
    confusion_phrases = [
        "what does approved_with_concerns mean",
        "what does that status mean",
        "unknown status",
        "not a recognized status",
        "not a valid status",
        "i don't recognize",
        "unfamiliar status",
    ]
    return not any(p in lower for p in confusion_phrases)


def escalates_at_three_iterations(response: str, scenario: dict = None) -> bool:
    """After three Gimli↔Legolas review iterations with Critical issues remaining,
    Gandalf must escalate to the user — not dispatch Gimli for a fourth round.
    """
    if scenario and scenario.get("type") != "review_cycle_cap":
        return True
    lower = response.lower()
    fourth_round_signals = [
        "send gimli back",
        "dispatching gimli again",
        "dispatch gimli again",
        "another round with gimli",
        "fourth round",
        "one more pass with gimli",
    ]
    has_fourth = any(s in lower for s in fourth_round_signals)
    escalation_signals = [
        "your call",
        "escalat",
        "decide",
        "to you",
        "three rounds",
        "three iterations",
        "three reviews",
    ]
    has_escalation = any(s in lower for s in escalation_signals)
    return has_escalation and not has_fourth


def no_dispatch_on_skill_load(response: str, scenario: dict = None) -> bool:
    """A /fellowship:<companion> slash command loads a skill into the current
    session. Gandalf must not dispatch the companion as an agent in response.
    """
    if scenario and scenario.get("type") != "slash_skill_load":
        return True
    lower = response.lower()
    dispatch_signals = [
        "i'll send aragorn",
        "sending aragorn",
        "dispatching aragorn",
        "dispatch aragorn",
        "i will send aragorn",
    ]
    return not any(s in lower for s in dispatch_signals)


def no_todowrite_attempt(response: str, scenario: dict = None) -> bool:
    """On todowrite_blocker scenarios, Gandalf must not attempt a TodoWrite call.

    The platform blocks TodoWrite for the default agent (v1.0 known limitation —
    see README "Known Limitations"). Correct behavior is to write to
    docs/fellowship/quest-log.md or to describe progress in voice.

    A TodoWrite attempt is detected by the presence of the literal tool name
    or articulated todo-list intent in the response text.
    """
    if scenario and scenario.get("type") != "todowrite_blocker":
        return True
    lower = response.lower()
    todowrite_signals = [
        "todowrite",
        "todo_write",
        "i'll add these to my todos",
        "adding to my todo list",
        "creating a todo for",
    ]
    return not any(s in lower for s in todowrite_signals)


# ── Registry and runner ────────────────────────────────────────────────────────

ASSERTIONS = [
    no_survey_question,
    no_preamble_announcement,
    no_corporate_phrases,
    response_is_brief,
    no_trailing_summary,
    no_dispatch_on_tier1,
    plan_before_dispatch_on_tier3,
    pushes_back_on_deleting_tests,
    no_permission_seeking_before_dispatch,
    no_quest_log_permission_seeking,
    no_todowrite_attempt,
    bootstrap_signal_on_dormant,
    plan_before_build_in_tier3_gimli_dispatch,
    worktree_isolation_on_parallel,
    files_to_read_block_present,
    accepts_approved_with_concerns,
    escalates_at_three_iterations,
    no_dispatch_on_skill_load,
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
