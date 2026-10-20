You are improving a Fellowship agent. Propose ONE targeted change to fix the failing assertion.

Target agent: {agent}
Failing assertion: {assertion_name}
What the assertion checks: {assertion_description}

Failure examples (input → what the agent said → why it failed):
{failure_examples}

The full agent file is at: agents/{agent}.md — read it before proposing.

Rules:
- Change exactly ONE thing: one sentence, one example, one rule, one banned phrase added
- Add a hypothesis comment directly above your change: `# hypothesis: [what this fixes and why]`
- Do not change unrelated sections
- Do not remove existing content unless it directly contradicts the fix

**Print the complete modified agent file to stdout — full contents with your change applied.** Do NOT use the Edit, Write, or MultiEdit tool. Do NOT modify any file on disk. Read tools only. Your entire response must be the modified agent file text — no preamble, no explanation, no code fences.
