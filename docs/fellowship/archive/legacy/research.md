# Research Behind Fellowship's Design

Fellowship's architecture isn't guesswork — it's informed by academic research, industry best practices, and production experience from existing multi-agent systems. This document maps key design decisions to the research that shaped them.

---

## Multi-Agent Orchestration

**How should an orchestrator communicate with its workers?**

The most critical design question for any multi-agent system. Fellowship uses a **principles + reporting protocol** pattern: workers (companions) get engineering principles for craft quality and a structured reporting format for communication. The orchestrator (Gandalf) owns the workflow and routing logic.

### Key findings

- **Anthropic's multi-agent research system** found that "simple, short instructions" caused worker misinterpretation. They evolved to granular task descriptions with specific objectives, output formats, and clear boundaries. Fellowship's dispatching protocol follows this — Gandalf provides full task text, relevant context, and scope boundaries. ([Source](https://www.anthropic.com/engineering/multi-agent-research-system))

- **Anthropic's agent-building guide** recommends: "Instill good heuristics rather than rigid rules by studying how skilled humans approach tasks and encoding these strategies in prompts." This directly informed our choice of principles over prescriptive workflow stages. ([Source](https://www.anthropic.com/research/building-effective-agents))

- **Superpowers plugin** (the most mature open-source Claude Code multi-agent system) uses a 4-status reporting protocol (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED) that Fellowship adopts. Their pattern: heavy process in the orchestrator, principles in the worker. ([Source](https://github.com/obra/superpowers))

- **OpenAI Agents SDK** distinguishes "agents as tools" (orchestrator keeps control) from "handoffs" (ownership transfers). Fellowship uses the tools pattern — Gandalf keeps control, companions assist. ([Source](https://openai.github.io/openai-agents-python/multi_agent/))


### What we chose NOT to do

- **Prescriptive workflow stages** — research showed that worker performance degrades with too much instruction (~3,000 token threshold per CodeScene). The orchestrator should own the workflow; the worker should own the craft.
- **Background observer agents** — Mastra uses these for memory compression, but Claude Code can't run background agents. Not architecturally possible.
- **Agent-to-agent handoffs** — Claude Code subagents can't spawn other subagents. All orchestration goes through Gandalf.

---

## SessionStart Skill Injection

**How does the orchestrator establish its identity at message one without polluting the default agent?**

A central design problem: Gandalf needs a substantial operating manual (routing logic, dispatch protocol, escalation triggers, voice), but the *default* Claude Code agent should remain vanilla — preserving its native tool surface and avoiding the performance cost of a heavy persona on every session. Fellowship resolves this by injecting Gandalf's identity at session start via a skill, rather than registering Gandalf as an always-on agent file.

### The pattern

A `SessionStart` hook reads an entry-point skill (`skills/using-fellowship/SKILL.md`) and emits its contents as `additionalContext` wrapped in a strong identity declaration. The first message of every session therefore begins with the orchestrator's full operating manual — the Fellowship principles, dispatch protocol, companion roster, and reporting format — established before the user has typed anything. The default agent itself remains untouched: tools, permissions, and base behavior are unchanged. Gandalf is a *layer* on top, not a replacement.

### Why it matters

Two failure modes are avoided. First, **default-agent pollution**: registering an orchestrator as the default `agent` in plugin settings replaces the vanilla Claude Code experience for every interaction, including ones that don't need orchestration. Users lose the bare tool surface they expected. Second, **late identity establishment**: relying on a CLAUDE.md file or skill auto-discovery to load the orchestrator means the first message sometimes arrives before the identity is fully resolved, producing inconsistent behavior on session start. SessionStart injection is deterministic — the identity is in context at message one, every session, with no race condition.

### Where Fellowship learned it

The pattern is adapted from **Superpowers**, which uses an identical structure: a `using-superpowers` SKILL.md as the orchestrator's entry-point manual, loaded by a session-start hook that wraps it with an identity declaration. Superpowers proved the pattern works at scale for a multi-agent system; Fellowship adopted it after the earlier experiment of registering Gandalf as a default agent file produced exactly the default-pollution problem described above. ([Source](https://github.com/obra/superpowers))

### Trade-off currently being navigated

The entry-point skill grows large because it carries the orchestrator's full operating manual in a single file. Long skill files see reduced adherence past the same context-budget thresholds documented elsewhere in this doc — the orchestrator's own guidance becomes harder to follow as the file lengthens. The known mitigation, also borrowed from Superpowers' structure, is to break detailed sub-domains (escalation playbooks, companion roster details, dispatch examples) into `references/*.md` files that the entry skill points to but does not inline. Fellowship is currently navigating this trade-off — the entry skill is the load-bearing piece, and decomposition into references is on the roadmap.

---

## Engineering Principles

**What makes AI-generated code good?**

Fellowship's seven engineering principles are each grounded in documented failure modes of AI coding agents.

### Key findings

- **Addy Osmani** ("My LLM Coding Workflow Going Into 2026") advocates spec-before-code and spending ~70% on specifications. Forcing thinking before code reduces hallucination ~40%. This informed "understand before building." ([Source](https://addyosmani.com/blog/ai-coding-workflow/))

- **Armin Ronacher** ("Agentic Coding Recommendations") found that agents produce 2x concurrency errors and 3x readability issues versus human code. Common failures: abstraction bloat, dead code accumulation, assumption propagation. This informed "simplicity first" and "no dead code." ([Source](https://lucumr.pocoo.org/))

- **CodeScene's research** showed that agents perform best in healthy codebases (Code Health 9.5+) and that without test guardrails, AI adoption produces up to 41% more defects. This informed "match existing patterns" and "verify your work." ([Source](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality))

- **Pete Hodgson** ("Why Your AI Coding Assistant Keeps Doing It Wrong") noted that agents arrive as "brand new hires" each session. Providing 2-3 similar implementations as reference dramatically improves output. This informed "understand before building" — find references first. ([Source](https://blog.petehodgson.com/))

- **Simon Willison** ("Agentic Engineering Patterns", Feb 2026) recommends test-first development with agents: write tests, audit them, then implement. This informed our verification principle — though Fellowship makes new tests a judgment call rather than a mandate, because we have Pippin for dedicated testing. ([Source](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/))

- **MIT Missing Semester 2026** explicitly recommends TDD with agents and emphasizes the tight feedback loop: write code, run tests, fix, iterate. Fellowship's verification principle captures this loop without mandating TDD for every change. ([Source](https://missing.csail.mit.edu/2026/agentic-coding/))

- **Wiz Research** found 45% of AI-generated code contains OWASP Top-10 vulnerabilities. This is why Fellowship's self-review checklist includes a security check — even though Boromir handles dedicated security reviews. ([Source](https://www.wiz.io/blog/safer-vibe-coding-rules-files))

- **Anthropic's Claude Code best practices** emphasize "only make changes that are directly requested or clearly necessary." This informed the scope check in the self-review checklist — agents should not make unsolicited improvements. ([Source](https://www.anthropic.com/engineering/claude-code-best-practices))

### The testing decision

Superpowers mandates TDD as an iron law: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST." Fellowship takes a different approach:

- **Gimli** (engineer) verifies his work — runs existing tests, writes new tests only for non-trivial logic
- **Pippin** (test engineer) writes thorough test suites as planned, dedicated work
- **Gandalf** (orchestrator) decides whether to dispatch Pippin based on the criticality of the code

This avoids test sprawl while maintaining verification as a mandatory practice. The research supports both approaches — Fellowship's advantage is having specialized companions, so the engineer doesn't need to be a TDD zealot.

---

## Memory Architecture

**How should agents remember across sessions?**

Fellowship uses a three-layer memory architecture. Each layer was chosen based on specific research findings.

### Key findings

- **Mastra's Observational Memory** (2026) achieved 94.87% on LongMemEval — the highest score ever recorded — by converting raw messages into structured, timestamped observations. Their key insight: *observations during execution* are a distinct memory type most systems miss. Fellowship captures this episodic knowledge through per-agent native memory (`memory: project`) — each companion persists their own observations across sessions without Mastra's infrastructure overhead. (An earlier shared `learnings.md` log was removed in favor of this per-agent model, on the principle that episodic knowledge belongs with the agent that earned it.) ([Source](https://mastra.ai/research/observational-memory))

- **"Memory in the Age of AI Agents"** survey (Dec 2025, arXiv:2512.13564) decomposes memory into Formation, Evolution, and Retrieval. It identifies three types: semantic (facts), episodic (experiences), and procedural (workflows). Fellowship's specs are semantic, per-agent memory is episodic, and plans are procedural — covering all three without a specialized memory system.

- **A-MEM** (NeurIPS 2025, arXiv:2502.12110) uses Zettelkasten-inspired notes with LLM-generated keywords and dynamic links. The insight: categorized, tagged memories are more retrievable than unstructured ones. Fellowship took a different bet: per-agent memory is uncategorized prose, persisted natively by each companion. The retrievability problem is solved by *scope* (each companion only sees their own memory) rather than by tagging — a lighter approach justified by the small per-agent volume.

- **"Multi-Agent Memory from a Computer Architecture Perspective"** (Mar 2026, arXiv:2603.10062) proposes a three-layer hierarchy: I/O layer, cache layer, memory layer. Fellowship mirrors this: context window (working), per-agent memory (cache), shared files (long-term).

- **File-based memory consensus** (claude-mem, Manus, OpenClaw, Claude Code itself) — multiple successful projects converge on markdown files as the memory store. The pattern works well up to ~5MB. Beyond that, you need search. Fellowship will stay well under this threshold. ([Source](https://dev.to/imaginex/ai-agent-memory-management-when-markdown-files-are-all-you-need-5ekk))

- **Collaborative Memory** (ICML 2025, arXiv:2505.18279) explores multi-agent memory with access controls: private memory visible only to the originating agent, shared memory with selective fragments. Fellowship implements this naturally: per-agent memory is private, `docs/fellowship/` is shared, and Gandalf curates what each companion receives.

### The three layers

| Layer | Research basis | What it handles |
|---|---|---|
| Claude Code auto-memory | Built-in, proven at scale | User preferences, build commands, working style |
| Per-agent memory (`memory: project`) | Collaborative Memory (ICML 2025) — private agent knowledge | Episodic observations, agent-specific patterns and discoveries |
| Fellowship shared memory (`docs/fellowship/`) | Mastra, file-based consensus | Quest log, specs, plans, handoffs, debug log |

### The curator pattern

Rather than giving every agent access to all memory, Gandalf reads shared memory and selects what's relevant for each companion's dispatch. This is supported by:

- **Context engineering research** (Weaviate, 2026): treat the context window as a scarce resource. Optimize what information is included. ([Source](https://weaviate.io/blog/context-engineering))
- **Anthropic's context engineering guidance** (Sep 2025): "Every unnecessary word actively degrades agent performance." ([Source](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- **GAM (General Agentic Memory)**: keeps a full archive plus minimal cues, then compiles tailored context per request. Outperforms long-context LLMs. ([Source](https://venturebeat.com/ai/gam-takes-aim-at-context-rot-a-dual-agent-memory-architecture/))

### What we chose NOT to build

- **Vector database / semantic search** — overkill for a file-based plugin under 5MB. Contradicts "light and non-intrusive" philosophy.
- **Background Observer/Reflector agents** — can't run background agents in Claude Code. The overhead isn't justified at our scale.
- **AI summarization at session end** — Claude Code's SessionEnd hook has a 1.5-second timeout. Not enough for AI compression.
- **Linked note graphs (A-MEM style)** — insufficient volume of memories to warrant associative retrieval.

---

## Escalation Protocol

**When should an AI agent stop and ask for help?**

This is arguably the most important design decision for any coding agent.

### Key findings

- **Anthropic's autonomy research** ("Measuring Agent Autonomy") found that on complex tasks, Claude Code stops to ask for clarification more than twice as often as humans interrupt it — and this is a feature, not a bug. Agents that force solutions produce worse outcomes than agents that escalate. ([Source](https://www.anthropic.com/research/measuring-agent-autonomy))

- **ESCALATE.md protocol** — an open standard for AI agent human approval, defining when agents should pause for human input. Fellowship's escalation triggers (ambiguous requirements, multiple valid approaches, high-impact operations, low confidence) align with this standard. ([Source](https://escalate.md/))

- **Steve Kinney** ("Sub-Agent Anti-Patterns") documents the "silent failure" anti-pattern: agents produce work they're unsure about rather than escalating. Fellowship counters this with explicit instruction: "Bad work is worse than no work. It is always OK to stop and say 'I need help.'" ([Source](https://stevekinney.com/courses/ai-development/subagent-anti-patterns))

- **Anthropic's harness guidance** ("Effective Harnesses for Long-Running Agents") recommends: "Let the agent know when a tool is failing and let it adapt." Systems should resume from checkpoints rather than restart. Fellowship's BLOCKED status enables this pattern. ([Source](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))

---

## Session Continuity

**How do you resume work across sessions?**

The simplest unsolved problem in most AI coding tools.

### Key findings

- **Superpowers plugin** has no cross-session memory. Each session starts fresh. If work stops mid-plan, the next session must be told where to resume. Fellowship's quest log (`docs/fellowship/quest-log.md`) solves the orchestrator-level continuity problem with a single, human-readable file. The contrast is narrower than it once was — Fellowship previously also kept a shared `learnings.md` episodic log, since removed in favor of per-agent native memory — but the quest log remains a meaningful difference: an orchestrator-visible snapshot of where work stands, persisted across sessions.

- **claude-mem** (37.2k GitHub stars) hooks into 5 lifecycle events and achieves cross-session continuity through dual storage (SQLite + ChromaDB). Effective but heavy. Fellowship achieves the core benefit (session continuity) with a single markdown file — no databases, no services. ([Source](https://github.com/thedotmack/claude-mem))

- **Architecture Decision Records (ADR)** — a proven software engineering practice for capturing decision provenance. Fellowship's design specs serve this role, with dates in filenames for temporal context. ([Source](https://adr.github.io/))

---

## Progress Tracking & Quest Log Design

**How should an orchestrator track progress without the file growing unbounded?**

The quest log needs to serve two purposes: "where am I now?" (session continuity) and "what has been built?" (architectural context). Every system that handles both uses some form of tiered retention.

### Key findings

- **Letta/MemGPT** uses OS-inspired memory tiering — core memory (always in context, like RAM) vs archival memory (searchable, like disk). Evicted messages undergo recursive summarization. This inspired Fellowship's three-zone quest log: Current (RAM), Recently Completed (cache), What Exists (consolidated). ([Source](https://www.letta.com/blog/agent-memory))

- **Mastra's Reflector** consolidates observations when they exceed a count threshold — combining related items, identifying patterns, dropping irrelevant context. Fellowship adopts count-triggered consolidation: when Recently Completed exceeds 7 items, oldest fold into What Exists. ([Source](https://mastra.ai/docs/memory/observational-memory))

- **Mem0** merges related information and resolves conflicts at write time rather than appending indefinitely. This informed our consolidation approach — What Exists is a living summary, not an append-only list. ([Source](https://mem0.ai/research))

- **Context window budget research** shows Claude Code's own CLAUDE.md files see reduced adherence beyond 200 lines. The quest log targets an 80-line budget to stay well within useful context range. ([Source](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

### The three-zone pattern

| Zone | Purpose | Cap | Detail level |
|---|---|---|---|
| Current | "Where am I now?" | 3 items | Full detail |
| Recently Completed | "What was just built?" | 7 items | One line each |
| What Exists | "What capabilities exist?" | 15 lines | Architectural summary |

When Recently Completed overflows, oldest items consolidate into What Exists and get appended to an archive file (`quest-log-archive.md`) that is never auto-loaded — zero token cost unless explicitly requested.

---

## Agent Teams: Future Direction for Tier 4

**Status as of March 2026:** Experimental, promising but unstable. Revisit when it exits experimental status.

### Why Agent Teams matters for Fellowship

Agent Teams is fundamentally different from subagent dispatch — teammates are peers that communicate directly, share a task list, and self-coordinate. This is more lore-accurate than our current hierarchical model: the Fellowship in Tolkien operates as peers. Gandalf guides but doesn't command. Decisions are made through debate (Council of Elrond, Moria vs Gap of Rohan).

Anthropic's own guidance captures the distinction perfectly:

> "Use subagents when you need quick, focused workers that report back. Use agent teams when teammates need to share findings, challenge each other, and coordinate on their own." — [Agent Teams docs](https://code.claude.com/docs/en/agent-teams#when-to-use-agent-teams)

### What it enables that subagents can't

The Agent Teams docs describe use cases that map directly to Fellowship scenarios:

- **Parallel code review** — The docs show: "Spawn three reviewers: one focused on security implications, one checking performance impact, one validating test coverage. Have them each review and report findings." That's Boromir + Legolas + Pippin working as a review team. "Each reviewer works from the same PR but applies a different filter. The lead synthesizes findings across all three after they finish." ([Source](https://code.claude.com/docs/en/agent-teams#run-a-parallel-code-review))

- **Multi-perspective brainstorming / Council of Elrond** — The docs show: "Spawn 5 agent teammates to investigate different hypotheses. Have them talk to each other to try to disprove each other's theories, like a scientific debate." And crucially: "The debate structure is the key mechanism here. Sequential investigation suffers from anchoring: once one theory is explored, subsequent investigation is biased toward it. With multiple independent investigators actively trying to disprove each other, the theory that survives is much more likely to be the actual root cause." That's Aragorn, Merry, and Sam debating an approach. ([Source](https://code.claude.com/docs/en/agent-teams#investigate-with-competing-hypotheses))

- **Cross-layer coordination** — "Changes that span frontend, backend, and tests, each owned by a different teammate." Gimli building API + Pippin writing tests, synchronizing on interfaces.

- **Direct conversation with companions** — "Each teammate is a full, independent Claude Code session. You can message any teammate directly to give additional instructions, ask follow-up questions, or redirect their approach." Frodo can Shift+Down to talk directly to Boromir about security without going through Gandalf.

- **Plan approval** — "Require teammates to plan before implementing. The teammate works in read-only plan mode until the lead approves their approach." Gandalf reviews a companion's plan, approves or rejects with feedback. The companion stays in plan mode until approved. ([Source](https://code.claude.com/docs/en/agent-teams#require-plan-approval-for-teammates))

### Best practices from the docs (relevant to Fellowship)

- **Start with 3-5 teammates** — balances parallel work with coordination overhead
- **5-6 tasks per teammate** — keeps everyone productive
- **Start with research and review** — easier than parallel implementation
- **Avoid file conflicts** — "Two teammates editing the same file leads to overwrites. Break the work so each teammate owns a different set of files."
- **Monitor and steer** — "Check in on teammates' progress, redirect approaches that aren't working, and synthesize findings as they come in."
- **Use Sonnet for teammates** — cost-efficient, lead can use a more capable model

### Sustained collaboration — the strongest argument beyond parallelism

Agent Teams isn't just about running things in parallel. It's about **persistent, direct collaboration with a specialist.**

With subagents, every design iteration goes: Frodo → Gandalf → dispatch Arwen → Arwen works → reports to Gandalf → Gandalf tells Frodo. For a 2-hour design session with 15 iterations, that's 15 round-trips through a middleman who isn't adding value.

With Agent Teams, Frodo Shift+Downs to Arwen's pane and talks directly. Arwen persists as a full session — she remembers previous iterations, design direction, preferences. The conversation flows naturally. Gandalf stays available as the lead but doesn't block.

This applies to any sustained work with one companion:
- A deep design session with Arwen (2 hours of iteration)
- Walking through the codebase with Boromir for security review
- Debugging a complex issue with Pippin, trying different approaches
- Discussing architecture trade-offs with Merry

Subagents are fire-and-forget workers. Teammates are persistent collaborators. For sustained work with one companion, teammates are clearly the better model.

### The promise

| Feature | Impact for Fellowship |
|---|---|
| Teammates communicate directly | Companions can debate and challenge each other (Council of Elrond) |
| Shared task list with dependencies | Natural quest log — tasks auto-unblock when dependencies complete |
| Self-claiming tasks | Companions pick up work based on their expertise, not just assignment |
| Plan approval mode | Gandalf reviews a companion's plan before they implement |
| TeammateIdle / TaskCompleted hooks | Quality gates — enforce review before marking done |
| Split-pane display | See all companions working at once (tmux/iTerm2) |

### Current reality (why we're not using it yet)

**Adoption:** No plugin has deeply integrated Agent Teams into a production workflow. Existing projects:
- [agent-team-templates](https://github.com/kourosh-forti-hands/agent-team-templates) — prompt templates, not code
- [teamclaude](https://github.com/albertnahas/teamclaude) — monitoring dashboard, doesn't create teams
- [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp) — reimplements the protocol as MCP server
- [wshobson/agents](https://github.com/wshobson/agents) — thin wrapper via `/team-spawn` command
- Superpowers — planned but not shipped (issue #429)

**Known bugs (as of March 2026):**
- TeamCreate spawns teammates that silently exit ([#34614](https://github.com/anthropics/claude-code/issues/34614))
- Orphaned teams persist on disk, blocking future teams ([#32730](https://github.com/anthropics/claude-code/issues/32730))
- Zombie teammates after session ends ([#27610](https://github.com/anthropics/claude-code/issues/27610))
- TeamDelete blocked indefinitely by hung agents ([#31788](https://github.com/anthropics/claude-code/issues/31788))
- Subagents have TeamCreate but lack the Agent tool to populate teams ([#32723](https://github.com/anthropics/claude-code/issues/32723))
- Leadership state contradicts teammate state after session reset ([#28676](https://github.com/anthropics/claude-code/issues/28676))

**Cost:** ~7x token usage vs standard sessions. Each teammate is a full Claude instance.

**Limitations:** No session resumption, one team per session, no nested teams, lead is fixed, split panes require tmux/iTerm2.

### How Fellowship would integrate Agent Teams (when ready)

**The hybrid approach — subagents for Tier 1-3, Agent Teams for Tier 4:**

| Tier | Model | Why |
|---|---|---|
| 1 — Direct | Gandalf alone | No dispatch needed |
| 2 — One specialist | Subagent | Focused task, result is all that matters |
| 3 — Sequential chain | Subagent chain | Dependencies between tasks, sequential by nature |
| 4 — Parallel/debate | **Agent Teams** | Companions need to communicate, challenge, coordinate |

**Fellowship's memory files (quest-log, per-agent memory, product.md) are safe** because our design already says only Gandalf writes to shared memory. Companions report back; Gandalf curates. In Agent Teams mode, the same rule applies — teammates report via messages, the lead persists to files.

**Companion skills would load automatically** (teammates load project skills). The companion identity (personality, boundaries) would need to come via the spawn prompt since teammate support for custom agent files is unclear.

### Codebase analysis: plugins already using Agent Teams

Four projects were studied for implementation patterns:

**wshobson/agents** — most modular. 4 agent definitions, 7 commands, 6 skills. Key patterns:
- Pre-flight check: verifies `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` before creating teams
- Uses `subagent_type: "agent-teams:team-implementer"` to reference plugin-scoped agent files — meaning `subagent_type: "fellowship:gimli"` would work for our companions
- Preset team compositions: review (3 reviewers), debug (3 investigators), feature (1 lead + 2 implementers), fullstack (1 lead + 3 implementers)
- `/team-spawn`, `/team-feature`, `/team-review` as explicit entry points
- ([Source](https://github.com/wshobson/agents/tree/main/plugins/agent-teams))

**teamclaude** — most sophisticated. Full npm plugin with React dashboard. Key patterns:
- Agent definitions as markdown with YAML frontmatter in `/agents/` — same format as Fellowship's companions
- Programmatic prompt compilation (`prompt.ts`) — builds spawn prompts by composing project context, role instructions, and learnings
- Structured messaging protocol: `TASK_ASSIGNED:`, `READY_FOR_REVIEW:`, `APPROVED:`, `ESCALATE:` prefixes for parseable communication
- Process learnings (`PROCESS_LEARNING: <role> — <improvement>`) fed back into future sprints via `.teamclaude/learnings.md` — nearly identical to our Learnings field
- 3-round max review cycle with automatic escalation to human
- ([Source](https://github.com/albertnahas/teamclaude))

**agent-team-templates** — pure prompt templates. Key patterns:
- Three topologies: Solo (sequential), Squad (one persistent team), Swarm (per-wave ephemeral teams)
- File ownership as first-class concept: "You OWN these files (only you edit them), You READ these files (shared, do not edit)"
- Competing hypotheses pattern: spawn investigators + devil's advocate, use `blockedBy` for challenge phase
- ([Source](https://github.com/kourosh-forti-hands/agent-team-templates))

**claude-code-teams-mcp** — MCP reimplementation. Key patterns:
- Atomic file writes for concurrent agent safety
- Agent ID format: `name@team-name`
- Color palette round-robin for visual differentiation
- ([Source](https://github.com/cs50victor/claude-code-teams-mcp))

### Dual-mode architecture: both models in one plugin

Key finding: **Fellowship can support both subagents and Agent Teams without code conflicts.**

- The env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` makes TeamCreate available but doesn't force any plugin to use it
- The lead (Gandalf) has access to BOTH the Agent tool and TeamCreate simultaneously
- Our agent files (gimli.md, gandalf.md) use the same markdown + YAML frontmatter format that Agent Teams plugins use
- The orchestration skill can check the env var at runtime and branch behavior
- Plugin `settings.json` can only set `agent` key — users must opt into Agent Teams via their own settings

The toggle: Gandalf checks availability before dispatching. Agent Teams enabled → spawn as teammates. Not enabled → dispatch as subagents. Same companions, same skills, same reporting.

### Preset Fellowship team compositions (future)

Inspired by wshobson's preset pattern:

| Preset | Companions | Use case |
|---|---|---|
| **Council** | Aragorn + Merry + Sam | Multi-perspective brainstorming, competing approaches |
| **Review** | Legolas + Boromir + Pippin | Parallel code review (quality + security + tests) |
| **Build** | Gimli + Pippin | Implementation + tests, coordinating on interfaces |
| **Design** | Arwen + Bilbo + Aragorn | Design + copy + product perspective |

### When to revisit

- Agent Teams exits experimental status
- The silent-exit bug (#34614) and orphaned-teams bug (#32730) are fixed
- Fellowship has enough companions built to form meaningful teams

---

## Harness Engineering & Artifact Persistence

**What does serious production harness work look like?**

Most Claude Code plugins focus on skills and prompting. A smaller class of systems goes further — building deterministic execution harnesses that constrain, route, and recover AI work. Understanding these patterns informed several Fellowship design choices.

### Key findings

- **ep6-agent-harness** (The AI Automators) demonstrates a dual-harness model: "Deep Mode" (soft, LLM-directed work) versus a "Harness Engine" (hard, deterministic phases). In the harness engine, each phase is typed — `programmatic`, `llm_single`, `llm_agent`, `llm_batch_agents`, or `llm_human_input`. The type determines how much AI autonomy that phase has. ([Source](https://github.com/theaiautomators/claude-code-agentic-rag-series/tree/main/ep6-agent-harness))

- **Inter-phase artifact writing** is the structural key: each phase writes its output to a versioned file (e.g., `contract-text.md → classification.md → chunks.md → report.docx`). The next phase reads only those files — not the full conversation history. This creates natural context resets at phase boundaries. Any phase can restart from the prior phase's artifact: crash recovery by design, not by luck.

- **Virtual filesystem in Postgres**: rather than writing to disk, agents write to a virtual filesystem backed by Postgres. This enables replay, auditability, and state reconstruction without file system coupling. Artifacts are first-class objects, not ephemeral scratchpad text.

- **Focused phase prompts** (~5-15 lines each): each phase agent receives a short, scoped prompt. The phase boundary is the context reset — you don't need a 400-line context dump because the artifact from the previous phase carries the information forward. This validates our principle of not overloading companion context.

- **Sub-agent caps** (`MAX_SUB_AGENT_ROUNDS=15`): deterministic limits prevent runaway agent loops. The harness, not the agent, decides when to stop.

- **barkain/workflow-orchestration** (the most sophisticated open-source Claude Code harness) implements similar patterns in production: task graph validation, delegation enforcement, inter-phase scratchpad artifacts (`$CLAUDE_SCRATCHPAD_DIR`), and per-wave parallel agent dispatch. Its hook system (14 Python hooks across 6 lifecycle events) enforces the harness at every layer — hooks are structural constraints, not suggestions. ([Source](https://github.com/barkain-plugins/workflow-orchestrator))

### The design principle

Across these implementations, a consistent pattern emerges:

> **"Skills teach. Hooks enforce. Artifacts persist."**

- **Skills** provide methodology and domain knowledge — they make agents smarter.
- **Hooks** create structural constraints — they prevent agents from going off-course at the architectural level.
- **Artifacts** are the memory bridge between phases — they make work resumable, auditable, and inspectable across sessions.

### What this means for Fellowship

| Concept | Our current approach | Potential evolution |
|---|---|---|
| Inter-phase artifacts | Quest log + per-agent memory (session-level) | Phase-level artifact files for Tier 4 work |
| Context resets | Companions dispatch fresh | Already implemented — each companion starts clean |
| Focused prompts | Gandalf scopes dispatch context per task | Already aligned with the principle |
| Validation gates | health-check.mjs (structural) | Hook-based quality gates for Tier 3+ work |
| Artifact persistence | Subagent output is transient | `CLAUDE_SCRATCHPAD_DIR` pattern for durable output |

The most actionable insight: for Tier 4 work, companions should write output to files rather than just returning text. Work is then resumable if a phase fails mid-stream. This is the artifact persistence pattern applied directly to Fellowship.

### What we chose NOT to adopt

- **Mandatory delegation enforcement** (barkain's primary hook): Fellowship doesn't block direct tool use. Gandalf is trusted to route appropriately, not coerced by hooks.
- **Virtual filesystem / database-backed state**: too heavy for a solo-dev plugin. File-based artifacts via `CLAUDE_SCRATCHPAD_DIR` achieve most of the benefit.
- **Phase type system with hard typing**: Fellowship's Tier system is a simpler form of the same idea — how much autonomy does this task need?

---

## Context Engineering & Token Efficiency

**What happens to a session when context fills up?**

Context rot is the gradual degradation of AI output quality as the context window fills with conversation history. Most Claude Code plugins ignore this problem. Two implementations studied here address it directly, from opposite directions.

### Key findings

- **GSD (Get Shit Done)** treats context rot as the primary enemy. Its architecture doc states this explicitly: fresh context per agent "eliminates context rot — the quality degradation that happens as an AI fills its context window with accumulated conversation." Every spawned agent starts with a clean 200K window. ([Source](https://github.com/gsd-build/get-shit-done))

- **GSD's context monitor hook** is a PostToolUse hook that injects context warnings *into the agent's conversation* — not just the user's status bar. At ≤35% remaining: "Avoid starting new complex work." At ≤25%: "Context nearly exhausted — stop immediately and save state to files." The key insight: the agent needs to know when it's running out, or it will cheerfully start a large refactor with 15% of context left and produce degraded output. ([Source](https://github.com/gsd-build/get-shit-done/blob/main/hooks/gsd-context-monitor.js))

- **context-mode** (5.7K GitHub stars) operates at the MCP transport layer — sandboxing tool outputs before they reach the context window. Benchmarks: a 56KB Playwright snapshot becomes 299 bytes (99% reduction), 20 GitHub issues compress from 59KB to 1.1KB (98%). A complete session shrinks from 315KB to 5.4KB, extending from ~30 minutes to ~3 hours. ([Source](https://github.com/mksglu/context-mode))

- **context-mode's PreCompact strategy**: before compaction fires, a `PreCompact` hook indexes all session events into SQLite FTS5 tables and builds a priority-tiered XML snapshot (≤2KB) containing only essential state: active files, current tasks, key decisions, unresolved errors. On resume, BM25 ranking retrieves only semantically relevant history — not the full dump. Don't restore everything after compaction — only what matters for the current task.

- **GSD's artifact pyramid**: each workflow stage writes structured Markdown artifacts that feed forward. `PROJECT.md → REQUIREMENTS.md → ROADMAP.md → CONTEXT.md → RESEARCH.md → PLAN.md → SUMMARY.md`. Any stage can restart from the prior artifact without going back to the beginning. The context handoff is in the file, not the conversation.

### What this means for Fellowship

| Problem | context-mode approach | GSD approach | Fellowship current |
|---------|----------------------|--------------|-------------------|
| Tool output bloat | Sandbox at transport layer | Thin workflows + focused prompts | Focused companion prompts |
| Post-compaction loss | FTS5+BM25 semantic retrieval | Structured artifact files | Three-zone quest log |
| Agent context exhaustion | Not addressed (MCP handles it) | Context monitor hook (agent-visible) | **Not addressed — gap** |
| Session continuity | Priority-tiered snapshot | `pause-work` → `continue-here.md` | Quest log |

Two improvements are directly actionable:

1. **Context monitor hook**: a PostToolUse hook that warns companions (via `additionalContext`) when context is running low. At ≤35%: write progress to a file, wrap up. At ≤25%: stop immediately. This prevents the most common failure mode — context-exhausted companions reporting "DONE" when they actually ran out of context mid-task.

2. **Quest log as a compact snapshot**: the three-zone quest log (Current / Recently Completed / What Exists) already follows the PreCompact principle — a minimal but complete snapshot of session state. The 80-line budget is intentional: small enough to survive compaction without noise.

### What we chose NOT to adopt

- **Sandbox architecture (context-mode)**: requires MCP integration and changing how every tool call is processed. Too invasive for Fellowship's lightweight philosophy.
- **FTS5/SQLite retrieval**: requires database infrastructure. The quest log achieves most of the benefit with a markdown file.
- **Artificial context compression**: GSD avoids this too — fresh context windows beat compression.

---

## Skill Evaluation

**How do you know if your skills actually work?**

This is an unsolved question for most Claude Code plugins. Skills are written on intuition, tested informally, and never measured. SkillsBench is the first framework to answer this question rigorously.

### Key findings

- **SkillsBench** measures skill effectiveness with statistical rigor: 84 tasks drawn from real-world coding work, 5 independent trials per task, 95% confidence intervals on all metrics. ([Source](https://www.skillsbench.ai/))

- **The baseline result**: Claude Code + Opus 4.5 without skills passes **22.0%** of tasks. With skills applied, the same model passes **45.3%** — a **+23.3 percentage point improvement**. Skills more than doubled the effective pass rate. This is the first published quantitative evidence that Claude Code skills have meaningful impact on objective task completion.

- **Custom skill evaluation**: SkillsBench uses the Harbor framework with Docker-based task isolation. Adding custom skills means writing a YAML task definition and dropping it in the `tasks/` directory. The evaluation pipeline is identical — 5 trials, CI calculation, comparison to baseline. Fellowship skills could be benchmarked the same way.

- **Task reward model**: tasks return a reward between 0.0 and 1.0 based on test pass rates. A task that passes 3 of 5 tests gets reward 0.6. This partial credit model means improvement is visible even before a skill reaches full reliability — early signal, not just pass/fail.

- **What SkillsBench actually measures**: skill reliability on objective tasks, not subjective output quality. "Does the skill help Claude complete this specific coding task?" is a cleaner signal than "does this skill prompt look well-written?"

### What this means for Fellowship

Fellowship's engineering and testing skills are the strongest candidates for benchmarking — both involve objective correctness (does the code work? do the tests pass?). Running them through SkillsBench would answer:

- Is the engineering skill actually making Gimli produce better code?
- Does the testing skill improve Pippin's test coverage and correctness?
- Which sections of a skill contribute most to improvement?

This is a future evaluation track, not immediate work — but knowing the infrastructure exists matters. Before Fellowship has a full roster of companions, building a benchmark suite for Gimli's core skill is a concrete way to validate the approach rather than assuming it.

### The AutoResearch loop — skills that improve themselves

Beyond static benchmarking, Karpathy's AutoResearch methodology applied to Claude Code skills offers a lighter-weight path to continuous skill improvement. ([Source](https://www.mindstudio.ai/blog/karpathy-autoresearch-applied-to-claude-code-skills))

The loop:
1. **Define binary assertions** (`eval.json`) — each test passes or fails. No LLM grading. "Does the output contain X?" is always better than "Is the output good?"
2. **Run overnight** — Claude Code reads the skill file, runs 30-50 eval cycles autonomously, analyzes which assertions fail, proposes edits to the skill, re-runs
3. **Review in the morning** — pass rate history shows which changes helped

Results from early practitioners: skills starting at 40-50% pass rates reach 75-85% after overnight optimization. Binary assertions are the key — deterministic, fast, no ambiguity. ([Source](https://www.mindstudio.ai/blog/autoresearch-eval-loop-binary-tests-claude-code-skills))

**The `eval.json` pattern** (from Composio's [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)): a skill directory contains both the `SKILL.md` and an `eval.json` with test assertions. The assertions define what "this skill works" means concretely. This is the connective tissue between SkillsBench (external evaluation) and AutoResearch (internal improvement loop).

**For Fellowship:** the engineering skill and testing skill are the first candidates. Start by writing 5-10 binary assertions per skill — not to run overnight yet, but to clarify what "Gimli does this well" and "Pippin does this well" actually means. Once the assertions exist, the AutoResearch loop can run.

### What we chose NOT to do (yet)

- **Benchmark-driven skill writing**: writing skills *to pass benchmarks* rather than to encode real methodology optimizes for the wrong thing. The benchmark validates; the methodology comes first.
- **Automated evaluation on every skill change**: the Docker + Harbor overhead isn't justified for a single-developer plugin at this stage.
- **AutoResearch on every skill**: start with the two skills that have objective outputs (engineering, testing). Brainstorming and orchestration skills are harder to evaluate objectively — the assertions are less clear.

---

---

## AutoImprove — Self-Improving Agent Eval Loop

**How should an autonomous improvement loop be structured to produce honest signal rather than circular results?**

The Karpathy autoresearch pattern applied to agent instruction files. Three ingredients: objective metric (eval pass rate), measurement tool (deterministic assertions + LLM-as-judge), lever to pull (agent `.md` files). One change per cycle, committed or reverted. Human reviews the diff in the morning.

### Key findings

- **Karpathy's autoresearch** (March 2026) establishes the core pattern: constrain mutation to one file, use a fixed evaluation budget, keep the evaluator in a read-only location the agent cannot modify. Ran 700 experiments in 2 days, discovered 20 genuine improvements to GPT-2 training. The "NEVER STOP" instruction prevents mid-run human gatekeeping. ([Source](https://kingy.ai/ai/autoresearch-karpathys-minimal-agent-loop-for-autonomous-llm-experimentation/))

- **Anthropic's agent eval guide** names "eval saturation" as a named pitfall: when agents reach 100% on capability evals, no improvement signal remains. Recommendation: balance problem sets (test both when behavior should and should not occur), use reference solutions to verify task validity, and read actual transcripts — not just scores. Combining code-based graders (fast, objective, brittle to valid variations) with model-based graders (flexible, non-deterministic) produces better coverage than either alone. ([Source](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents))

- **Self-improving agent research** (Nakajima, 2025) identifies the key pitfalls of self-modification loops: reward hacking (redefining what "better" means), bias amplification (self-reinforcing feedback without external checks), and curriculum collapse (overfitting to a narrow scenario set). Mitigation: conservative acceptance criteria, diversity in scenario design, explicit prohibition on modifying the evaluation harness. ([Source](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/))

- **LLM-as-judge best practices** (Monte Carlo Data, 2025): introduce "soft failures" — scores between 0.5 and 0.8 — for behavioral gray zones. About 1-in-10 judge invocations produces a spurious result where the output is fine but the judge hallucinates a failure. Automate re-evaluation on aggregated hard failures rather than single-test failures. ([Source](https://www.montecarlodata.com/blog-llm-as-judge/))

### What we chose and why

- **Real invocations over simulation** — same-context simulation is circular: the loop agent knows what "correct" looks like because it wrote the instructions. Fresh subprocess invocations with the agent file as context produce honest signal. Simulation produced 1.0 scores in 5 cycles; real invocations are expected to start at 0.5–0.7.
- **Protected evaluator** — `hard.py` is copied to `/tmp` and chmod 444 before the worktree starts. The loop can modify `agents/<target>.md` only. This prevents reward hacking by weakening assertions.
- **Correctness scenarios** — beyond structural compliance (does the report have a Status field?), Legolas scenarios embed real code with planted bugs and assert the agent finds them. Structure tests are a floor, not a ceiling.
- **Balanced problem sets** — Gandalf scenarios include both "should dispatch" and "must not dispatch" cases; "should push back" and neutral cases. One-sided scenario sets produce one-sided improvements.

---

## Sources

**Directly incorporated into Fellowship design:**
- [Building Effective AI Agents](https://www.anthropic.com/research/building-effective-agents) — Anthropic's patterns for multi-agent orchestration
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) — hook system, agent memory, plugin conventions
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — "Skills teach. Hooks enforce. Artifacts persist."
- [Superpowers Plugin](https://github.com/obra/superpowers) — 4-status reporting protocol, subagent-driven development
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) — context monitor hook, model profiles, wave execution, debug knowledge base
- [wshobson/agents](https://github.com/wshobson/agents) — Agent Teams integration, team composition patterns
- [SkillsBench](https://www.skillsbench.ai/) — 22.0%→45.3% pass rate improvement with skills; validation that skills work
- [awesome-claude-skills (Composio)](https://github.com/ComposioHQ/awesome-claude-skills) — skill-creator pattern, AutoResearch eval loop
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) — dual-mode architecture, TeamCreate protocol
- [Context Rot (Chroma Research)](https://research.trychroma.com/context-rot) — context degradation model; informed quest log 80-line budget

**Studied but not incorporated:**
- [context-mode](https://github.com/mksglu/context-mode) — MCP context virtualization (too invasive for Fellowship's philosophy)
- [barkain/workflow-orchestrator](https://github.com/barkain-plugins/workflow-orchestrator) — sophisticated harness (patterns distilled into reference-implementations.md)
