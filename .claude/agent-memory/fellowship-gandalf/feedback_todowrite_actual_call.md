---
name: TodoWrite is not actually wired up for Gandalf — plugin defect
description: Gandalf's system prompt instructs him to call TodoWrite for Tier 3+ orchestrations, but the tool returns "TodoWrite exists but is not enabled in this context." This is a Fellowship plugin defect, not a Gandalf behavior gap. The user explicitly asked for the checklist (twice) before this was identified.
type: feedback
---

When Gandalf attempts to call `TodoWrite` for orchestration checklists during Tier 3+ work, the platform refuses: `"TodoWrite exists but is not enabled in this context."` This is despite:
- The system prompt instructing Gandalf to call TodoWrite before dispatching companions
- The v1.7.0 release notes claiming TodoWrite was whitelisted across all 10 agents
- A `.claude/settings.json` addition flagged as "benign, not load-bearing"

The "benign, not load-bearing" footnote was masking the real defect: **TodoWrite is not actually present in Gandalf's runtime tool allowlist.** The plugin promises a live checklist on every Tier 3+ task and silently fails to deliver one. The user notices ("checklist still does not work — I don't see any checklist like in superpowers plugin... this is not good").

**Why:** This is the visible orchestration layer. Every Tier 3+ task should produce a TodoWrite checklist that ticks live. When the tool is unreachable, Gandalf's only options are (a) narrate fake progress in prose, or (b) silently skip the checklist. Both erode trust. The Superpowers plugin uses TodoWrite correctly — Fellowship claims to and doesn't.

**How to apply:**
1. **Stop pretending.** If TodoWrite returns "not enabled in this context," do not narrate a checklist or invoke Bash echos as theater. Tell the user the tool is unavailable and proceed without it.
2. **File as a v1.0 blocker.** Investigate agent frontmatter `tools:` field in `agents/gandalf.md`, the plugin manifest at `.claude-plugin/plugin.json`, and how Claude Code resolves tool allowlists for the default agent at session start. Sam's v1.7.0 research established the semantics — this is now a test of them.
3. **The fix likely lives in one of three places:** (a) the `tools:` line in `agents/gandalf.md` is missing TodoWrite, (b) the agent-loading mechanism doesn't honor `tools:` for the default `agent` entry in settings.json the same way it does for explicitly-dispatched agents, or (c) TodoWrite requires an additional permission grant the plugin manifest doesn't declare.
4. **Verify after fix:** Open a fresh session, reach a Tier 3+ task, watch for the checklist to render visibly. If the user has to ask "where's the checklist?" again, the fix didn't take.
