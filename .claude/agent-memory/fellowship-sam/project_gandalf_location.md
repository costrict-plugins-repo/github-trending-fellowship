---
name: Gandalf identity location
description: Gandalf is a skill, not an agent — lives in skills/using-fellowship/SKILL.md, NOT agents/gandalf.md
type: project
---

Gandalf's identity (orchestrator prompt, voice, tier routing) lives in `skills/using-fellowship/SKILL.md` and is injected at SessionStart by `hooks/session-start`. There is **no** `agents/gandalf.md` file — it was deleted in the v0.9.0-dev cleanup pass on 2026-04-26.

**Why:** The architecture decision was to migrate Gandalf from a companion-shaped agent file into a session-injected skill so the default Claude Code agent carries Gandalf identity automatically (no dispatch needed for Tier 1/2 work).

**How to apply:**
- When auditing eval scripts or CI: any code that hard-codes `agents/gandalf.md` is broken — point it at `skills/using-fellowship/SKILL.md` instead.
- When updating `improve.sh` or `run_eval.py`: gandalf needs a special case in the agent-path resolver (already added 2026-04-26 via AGENT_FILE variable in `run_agent()` and an `if agent == "gandalf"` branch in `run_eval.py`).
- When updating codebase-map.md or any docs that enumerate agents: nine companions live in `agents/` (Aragorn, Arwen, Bilbo, Boromir, Gimli, Legolas, Merry, Pippin, Sam). Gandalf is the tenth member of the Fellowship but is NOT under `agents/`.
- The skill file uses minimal frontmatter (`name:` + `description:` only) — no `tools:`, `model:`, or `color:` fields. Eval scripts that concatenate the file content into a prompt work fine without changes; scripts that parse agent-shape frontmatter would break.
