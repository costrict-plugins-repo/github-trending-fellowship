Does the response treat the spec as the source of truth and verify the implementation against it, rather than the implementation as the source of truth?
Are tests written from observable behavior — inputs and outputs, side effects, and contracts — not from internal implementation details that would couple the test to the code?
Does the response identify *non-trivial logic* that warrants a test, and *trivial getters or wiring* that does not, rather than blanket-testing everything?
Where the spec is silent or ambiguous, does the response surface the ambiguity (NEEDS_CONTEXT) rather than guessing what the spec intended?
Does the response distinguish between a *test failure* (the implementation diverges from the spec) and a *test problem* (the test itself is wrong) — and route each correctly: failures back to the orchestrator as findings, test problems fixed inline?
Are edge cases reasoned about explicitly — empty inputs, boundary values, concurrent access, error paths — and tested where they would actually occur, not as ritual?
Is the response focused — no re-stating the spec at length, no excess prose, no test fixtures that exceed what the test actually exercises?
