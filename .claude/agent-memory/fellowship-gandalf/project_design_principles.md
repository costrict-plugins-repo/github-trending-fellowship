---
name: Design Principles — Harness Engineering
description: Core design principles distilled from reference implementation research (barkain, ep6-agent-harness, SkillsBench)
type: project
---

"Skills teach. Hooks enforce. Artifacts persist." — the governing principle of production-grade Claude Code harnesses.

**Why:** Research into barkain/workflow-orchestrator, ep6-agent-harness, and wshobson/agents revealed this pattern consistently. Recorded 2026-03-23.

**Three principles:**

- **Skills teach** — methodology and domain knowledge in SKILL.md files. Make agents smarter by encoding expert judgment.
- **Hooks enforce** — structural constraints at the harness level. Prevent agents from going off-course architecturally. Hooks are not suggestions.
- **Artifacts persist** — inter-phase files make work resumable and auditable. For Tier 4 work, companions should write output to files (not just return text). The artifact is the handoff.

**Implication for Fellowship:** Tier 4 companion dispatches should write output to scratchpad files (`$CLAUDE_SCRATCHPAD_DIR`) so work can be resumed if a phase fails. This is the artifact persistence pattern.

**SkillsBench finding:** Claude Code + Opus 4.5 without skills: 22.0% pass rate → with skills: 45.3% (+23.3pp). First quantitative evidence that skills meaningfully improve objective task completion. Fellowship engineering and testing skills are the best candidates for future benchmarking.

**How to apply:** When designing Tier 4 workflows, include artifact writing as a companion responsibility. When reviewing skill quality, consider whether the skill would measurably improve SkillsBench-style task completion.
