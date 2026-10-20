# Gandalf Agent Memory

- [Roster Decisions](project_roster_decisions.md) — Confirmed: Sam→DevOps, Bilbo→TechWriter, Arwen absorbs UX writing, Aragorn is Tier 4 scope guardian
- [Design Principles](project_design_principles.md) — "Skills teach. Hooks enforce. Artifacts persist." + SkillsBench: 22%→45% with skills
- [GSD Architecture Patterns](project_gsd_patterns.md) — Context monitor hook, debug knowledge base, model profiles, wave execution — all directly applicable
- [Human-Like Agents Guide](reference_human_like_agents.md) — claudefa.st resource on agent personality, reasoning transparency, role-based switching
- [Pippin Self-Cleanup](feedback_pippin_self_cleanup.md) — Pippin must check and fix diagnostics in test code before reporting done (no one reviews Pippin)
- [Quest Log Silent](feedback_quest_log_silent.md) — Never ask permission to update the quest log — just do it silently
- [Direct Mode](project_direct_mode.md) — Companions should support standalone use for parallel work while Gandalf runs heavy cycles
- [Voice Register](feedback_voice_register.md) — Responses come out too flat in practice; needs elevated register by default, not survey questions, sentences that gather and land
- [CLI Agent Flag](feedback_cli_agent_flag.md) — `claude --agent fellowship:<name>` is valid; magenta/pink are invalid colors (fall back to gray); valid: red, orange, yellow, green, blue, purple, cyan
- [Plugin Cache Bust](feedback_plugin_cache_bust.md) — Local plugin changes invisible until version bumped in plugin.json — even for private plugins. Cache-bust, not release.
- [TodoWrite main-thread blocker](feedback_session_start_todowrite_check.md) — Verified open 2026-04-26. Allowlist fix and skill restructure both failed. Do not retry without new diagnostic info; use quest-log checkboxes as workaround.
