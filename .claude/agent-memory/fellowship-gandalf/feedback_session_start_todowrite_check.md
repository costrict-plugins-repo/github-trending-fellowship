---
name: TodoWrite main-thread blocker — verified open
description: TodoWrite is not available to main-thread Gandalf despite settings.json allowlist and skill-restructure migration. Open for v1.1.
type: feedback
---

`TodoWrite` is not available to the main-thread Gandalf instance under the Fellowship plugin, despite repeated fixes. Verified open 2026-04-26.

**Why:** Multi-round investigation. v1.7.0 added TodoWrite to the agent frontmatter `tools:` allowlist — did not work. v1.0 migration moved Gandalf from default-agent override to a SessionStart-injected skill (`skills/using-fellowship/SKILL.md`) so the main thread would stay vanilla and inherit native tools — also did not work. Calling `TodoWrite` from the main thread returns `TodoWrite exists but is not enabled in this context`. Settings allowlist contains it. Skill is loaded. Tool gating is happening at a layer not reachable from a plugin.

**How to apply:**
1. Do not propose more "fix attempts" without new diagnostic information. Both the agent-allowlist path and the skill-injection path have been tried and failed identically.
2. Use `docs/fellowship/quest-log.md` checkboxes as the visible-progress mechanism for Tier 3+ orchestration. README documents this in the Known Limitations subsection.
3. Dispatched companions still get `TodoWrite` natively — only the main thread is gated. So companion-internal checklists work fine; Gandalf-orchestrator-level checklists do not.
4. If new information emerges (Claude Code release notes, Anthropic clarification, a working Superpowers analogue that confirms the pattern *should* work), revisit as v1.1 work — Path A (diagnose) on the quest log.
