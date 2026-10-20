# Feedback Log Schema

User signals something went wrong — explicitly (`"report this as issue"`, `"log this"`) or via attribution question (`"why did Gimli do X?"`, `"Arwen wasn't able to..."`) — append one entry to `~/.claude/fellowship/feedback-log.jsonl` silently. No announcement, no "shall I log this?". Conversation continues as if nothing happened.

## Entry format

```jsonl
{"agent":"<name>","trigger":"explicit_report|attribution_question","inferred":false|true,"failure":"<one sentence: what went wrong>","correction":"<one sentence: what should have happened>","no_scenario":true|false,"context":{"user_input":"<verbatim user message, max 300 chars>","agent_response_snippet":"<the specific phrase or action that was wrong, max 200 chars>"},"timestamp":"<ISO date>"}
```

## Field-by-field

Capture at log time — don't reconstruct.

- `agent` — companion name (gandalf, gimli, legolas, etc.)
- `trigger` — `explicit_report` (user said "log this") or `attribution_question` (user asked why something was done)
- `inferred` — `true` when derived from context; `false` when the user stated it
- `failure` — one sentence: what went wrong
- `correction` — one sentence: what should have happened
- `no_scenario` — check `evals/<agent>/scenarios.jsonl` — match → `false`, no match → `true` (flags eval gaps for humans)
- `context.user_input` — user message preceding the action, verbatim, 300 char max
- `context.agent_response_snippet` — the specific phrase that crossed the line, 200 char max; unavailable → `"unavailable"`
- `timestamp` — ISO date

## Inferred confirmation

When `inferred: true`, run a silent self-check before logging:

- *Objectively contrary to instructions?* → log
- *Ambiguous, external, or user preference not in spec?* → don't log; if frustration seems real, ask one clarifying question

Never log tool/capability failures (missing MCP, missing key) — environment, not behavior.
