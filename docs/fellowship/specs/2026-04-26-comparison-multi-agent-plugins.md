# Multi-Agent Plugin Comparison — Fellowship vs the Field

**Date:** 2026-04-26
**Author:** Gimli (dispatched by Gandalf)
**Scope:** Read-only audit of multi-agent plugins in `examples/`. Compares Fellowship's nine-agent surface against `wshobson-agents`, `gsd-get-shit-done`, `ruflo`, `barkain-workflow`, `gstack`, `openspace`, `caveman`, `mattpocock-skills`. Superpowers excluded (covered by Legolas in parallel).

---

## 1. Headline finding

**Wave-based parallel execution with file-ownership boundaries is the single most actionable pattern Fellowship is missing.** Both `wshobson-agents/agent-teams` (`examples/wshobson-agents/plugins/agent-teams/agents/team-lead.md`) and `gsd-get-shit-done` (`examples/gsd-get-shit-done/commands/gsd/execute-phase.md`) bake this in: the orchestrator decomposes work into 2–3-task waves, each agent gets an exclusive file-ownership list, and waves run in parallel. The orchestrator stays under ~15% context; each subagent gets a fresh 100% window. Fellowship today dispatches sequentially through Gandalf — Frodo gets the same context bloat the orchestrator does. Adopting wave dispatch (with file-ownership) for Tier-3 multi-file work would let Fellowship scale to features without context rot, without changing the agent voices.

This is **the** thing to consider. Everything else is texture.

---

## 2. Per-plugin survey

### wshobson-agents (`examples/wshobson-agents/`)

72 single-purpose plugins, 112 specialized agents, 146 skills. The relevant comparison is the **`agent-teams` plugin** (`plugins/agent-teams/`) — a four-agent team built explicitly for Claude Code's experimental Agent Teams feature.

- **Agents:** `team-lead` (orchestrator), `team-implementer`, `team-reviewer`, `team-debugger`. Four roles, each parameterized at dispatch time (e.g., reviewer gets a "dimension": security, performance, architecture).
- **Orchestration:** `team-lead` is a Task-tool–spawned agent, not a SessionStart-injected skill. Activation via slash commands (`/team-spawn`, `/team-review`, `/team-debug`, `/team-feature`).
- **The one thing worth knowing:** **File-ownership protocol.** Every implementer gets an explicit list of owned files; "one owner per file" is enforced as a hard rule; shared files are owned by the lead. See `agents/team-implementer.md` lines 15–22. This is the cleanest concurrency model in the field.
- **Applies to Fellowship:** Yes — when (if) we wire team mode for Pippin/Gimli pairs working in parallel.

### gsd-get-shit-done (`examples/gsd-get-shit-done/`)

Spec-driven phase/plan execution system. 18 agents, ~50+ slash commands.

- **Agents:** Heavy on auditors and checkers (`gsd-plan-checker`, `gsd-verifier`, `gsd-integration-checker`, `gsd-nyquist-auditor`). Many narrow specialists, not a fixed party.
- **Orchestration:** Slash commands (`/gsd:execute-phase`, `/gsd:plan-phase`) act as orchestrators. Each command file declares `allowed-tools` and references `~/.claude/get-shit-done/workflows/*.md` as the workflow body.
- **The one thing worth knowing:** **Wave-based execution with explicit context budget.** `/gsd:execute-phase` declares "~15% orchestrator, 100% fresh per subagent" (line 30 of the command). Subagents receive `<files_to_read>` blocks they MUST load before doing anything else — context handoff is explicit and contractual.
- **Also worth knowing:** State files (`STATE.md`, `PLAN.md`, `SUMMARY.md`) persist phase/plan progress on disk — reproducible, resumable, inspectable. Closer to our quest-log discipline than anyone else.
- **Applies to Fellowship:** The `<files_to_read>` contract pattern would make Gandalf's dispatches more deterministic. The wave/phase concept maps to Tier-3 work.

### ruflo (`examples/ruflo/`)

A 60+-agent enterprise swarm framework (formerly Claude Flow). Vast surface — MCP server, hive-mind consensus (Byzantine/Raft/Gossip/CRDT), neural pattern training, 17 hooks, 12 background workers, IPFS plugin registry.

- **Agents:** YAML config files, not markdown prose. `agents/architect.yaml` is 11 lines: type, version, capabilities array, optimizations array. The agent body lives elsewhere (`v3/`) and is generated/composed.
- **Orchestration:** MCP-based. `mcp__ruv-swarm__swarm_init({topology, maxAgents, strategy})` then parallel `Task()` calls. Topologies: hierarchical / mesh / ring / star.
- **The one thing worth knowing:** **Routing tables.** `CLAUDE.md` ships an "Agent Routing (Anti-Drift)" table mapping task codes (1=Bug Fix, 3=Feature, 5=Refactor, …) to required agent rosters. Fellowship has no such table — Gandalf decides who to dispatch each time.
- **Cost of adopting:** Ruflo's stack itself is the antithesis of Fellowship's ethos (the Ring grew very heavy). But the **routing-table idea**, distilled to a 10-line reference, would help Frodo see "here's the standard party for a refactor".
- **Applies to Fellowship:** Pattern yes; implementation no.

### barkain-workflow (`examples/barkain-workflow/`)

Plan-mode-driven dual-mode (subagent vs. team) workflow harness. 8 agents, Python hooks, native plan mode integration.

- **Agents:** 8 narrow roles (`code-reviewer`, `task-completion-verifier`, `tech-lead-architect`, `dependency-manager`, etc.). Voice: spec-prefixed, terse. Each agent ends with the same `RETURN FORMAT: DONE|{output_file_path}` contract.
- **Orchestration:** **Native plan mode** as orchestrator. `EnterPlanMode` → workflow_orchestrator.md is injected → plan exits via `ExitPlanMode` → main agent enters Stage 1. Strict tool allowlist on the main agent (`Agent`, `Task`, `TaskCreate`, etc. — not `Edit`/`Write` directly). All real work happens in subagents.
- **The one thing worth knowing:** **`DONE|{path}` contract is universal.** Every agent returns exactly `DONE|/path/to/output.md` and writes findings to that file. Main agent never reads agent output via `TaskOutput` (banned: "context exhaustion: ~20K tokens per agent"). This solves the same problem we solve with `$CLAUDE_SCRATCHPAD_DIR` references in our reports — but more rigorously.
- **Also worth knowing:** **Conditional COMMUNICATION MODE blocks** in agent files — the same agent file declares both subagent behavior and teammate behavior, switched by environment. We have this in our agent files too (Gimli's "Subagent mode (default) / Teammate mode" block); barkain confirms the pattern.
- **Token-efficient CLI**: a PreToolUse hook rewrites Bash commands (e.g., `git status -sb`, `pytest -q --tb=short`) to compress output. Worth knowing about, low-priority adoption.
- **Applies to Fellowship:** The `DONE|{path}` contract is a stricter version of our existing report format — worth considering as the *Status* line idiom for Tier-3 dispatches that produce large artifacts.

### gstack (`examples/gstack/`)

A different beast: not really a multi-agent plugin but a **persistent-browser + workflow-skills** harness. Single bundled `agents/openai.yaml` interface; the heavy lifting is in slash-commands (`design-review`, `qa`, `eng-review`, `ship`, etc.) and a Bun/Chromium daemon.

- **The one thing worth knowing:** **Skill-as-command.** Each top-level dir (`/design-review`, `/qa`, `/ship`) is both a skill *and* a slash command — discovery is via the command list, methodology lives in the skill body. Closer to Anthropic's pure skills pattern than to Fellowship's agent-prose pattern.
- **Applies to Fellowship:** No direct adoption. Reinforces the principle that **discovery affordances matter** — gstack's flat top-level layout makes "what can this thing do?" obvious without reading docs.

### openspace (`examples/openspace/`)

Self-evolving skill platform — agents whose skills auto-improve, share, and degrade-detect. Python implementation, MCP server, dashboard. Different category from the others.

- **The one thing worth knowing:** **Skill quality monitoring.** Tracks execution success, error rates, performance. When a skill breaks, it self-repairs.
- **Applies to Fellowship:** Out of scope — we're not building a learning system. Note for future research only.

### caveman, mattpocock-skills

- **caveman:** A token-compression skill. Five skills, single SKILL.md each. Cuts ~75% of output tokens by speaking caveman ("read file. file good. ship."). Not a multi-agent plugin — useful only as a token-budget reference.
- **mattpocock-skills:** Skills-only, 23 directories, no agents. Already partly adopted by Fellowship (per quest log). Not multi-agent.

Both: nothing further to learn for this audit.

---

## 3. Patterns we should consider adopting

For Frodo to weigh — not decisions.

1. **Wave dispatch with file ownership** *(source: wshobson `agent-teams`, gsd `execute-phase`)*. For Tier-3 multi-file work, decompose into 2–3 parallel tasks, each with an explicit `owned_files: [...]` list. **Cost:** new dispatch logic in Gandalf skill (~200 lines of methodology); requires Tier classifier already partially present. **Why it might be worth it:** Frodo's context stays clean during long features; current sequential dispatch wastes both time and context on parallelizable work.

2. **`<files_to_read>` contract in dispatch prompts** *(source: gsd)*. Every dispatch prompt includes an explicit block listing files the agent MUST read first. **Cost:** small — a few lines of skill methodology. **Why it might be worth it:** removes ambiguity from "explore the codebase first"; makes dispatches reproducible.

3. **Routing reference table** *(source: ruflo, distilled)*. A short table mapping task shape → standard party (e.g., "Refactor = Aragorn (plan) → Merry (architecture review) → Gimli (build) → Pippin (tests)"). **Cost:** one page of reference material in `using-fellowship` skill. **Why it might be worth it:** Frodo can see the convention without re-deriving it; new contributors onboard faster. **Risk:** ossifies recommendation patterns Gandalf should re-evaluate per task.

4. **Universal `DONE|{path}` artifact contract** *(source: barkain)* for Tier-3 reports. Today our agents inline summaries in conversation; for large outputs (audits, plans, specs) the artifact-path pattern keeps Frodo's context lean. **Cost:** small format change to report convention. **Why it might be worth it:** matches our existing scratchpad pattern; just makes it normative for big outputs.

5. **Phase/plan state files** *(source: gsd)*. Persistent `PLAN.md`/`STATE.md`/`SUMMARY.md` per phase, on disk, resumable. **Cost:** medium — overlaps significantly with our quest log. **Why it might be worth it:** quest log already does most of this; could formalize the per-feature plan/state/summary triplet under `docs/fellowship/plans/`. **Risk:** adds ceremony to small tasks.

---

## 4. Patterns we explicitly should not adopt

Credit to existing Fellowship choices where the field made worse trades:

- **Ruflo's 60+ agents and IPFS plugin registry.** The Ring grew heavy. We chose nine deliberate roles; ruflo chose 60+ and lost discoverability. Frodo would never know which to dispatch. Our restraint is the win.
- **Ruflo's mandatory MCP-tool coordination layer.** Adds a coordination round-trip before any work happens. Fellowship's plain `Task` dispatch via Gandalf is one less moving part.
- **Barkain's hard tool allowlist on the main agent (`Edit`/`Write` blocked).** Forces *all* work through subagents. That's coherent for their model but wrong for Fellowship — Frodo decides; sometimes a one-line edit is just a one-line edit.
- **wshobson's 72-plugin marketplace approach.** Splitting `python-development` from `backend-development` from `code-refactoring` makes sense at scale; for nine agents in one plugin, it would fragment our orchestration story.
- **Caveman-style token compression.** Voice is craft, not decoration; "you read file. file good." breaks our character contract for marginal token savings.
- **OpenSpace's self-evolving skills.** Auto-mutating prompts contradict our "every skill must be deliberate" principle. Worth watching as research; not adopting.

---

## 5. Where Fellowship is genuinely ahead

Comparing across the eight plugins:

1. **Voice as a load-bearing primitive.** No other plugin treats agent personality as part of the engineering contract. Barkain's agents are spec-prefixed and terse (good); ruflo's are YAML stubs (effectively voiceless); wshobson's are role-summaries-with-bullet-lists. Fellowship's "Gimli's character" / "Aragorn's character" blocks make recommendations *legible* — you read a Pippin output and know it's Pippin. That's a discovery affordance no one else has built.

2. **Per-agent tool scoping with intent.** Fellowship is precise (Legolas can't `Edit`; Pippin can write tests only). Most plugins are wide open. Wshobson scopes tools but doesn't tie scoping to *role intent* — they're just defaults. Barkain scopes the main agent but agents themselves are loose.

3. **Structured report format with named status enum.** `DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED` is more expressive than barkain's binary `DONE|{path}` and infinitely more so than ruflo's status-message JSON. Wshobson uses TaskUpdate states. Ours encodes *why* a result is what it is, not just whether it's done.

4. **SessionStart skill injection as orchestrator.** We chose the skill route (light, automatic, ambient) over agent-as-orchestrator (wshobson, ruflo) or slash-command-as-orchestrator (gsd, gstack). Skill injection is the cleanest user surface: Frodo doesn't have to *invoke* Gandalf — he's just there. Only barkain comes close, and theirs requires plan-mode entry.

5. **Quest-log + handoff discipline.** Closest analog is gsd's PLAN/STATE/SUMMARY trio. Ours is more honest about what's *open* vs *resolved* vs *learned*. No other plugin treats project memory as a first-class artifact.

6. **Restraint.** Nine agents, two skills directories, two slash commands. Wshobson, ruflo, gstack, gsd all have hundreds of components. Fellowship is the only plugin in this set where you can hold the entire surface in your head. That's not a limitation — it's the design.

---

## Sources cited

- `examples/wshobson-agents/plugins/agent-teams/agents/team-lead.md`
- `examples/wshobson-agents/plugins/agent-teams/agents/team-implementer.md`
- `examples/wshobson-agents/README.md`
- `examples/gsd-get-shit-done/agents/gsd-executor.md`
- `examples/gsd-get-shit-done/agents/gsd-planner.md`
- `examples/gsd-get-shit-done/commands/gsd/execute-phase.md`
- `examples/ruflo/CLAUDE.md`
- `examples/ruflo/agents/architect.yaml`
- `examples/barkain-workflow/CLAUDE.md`
- `examples/barkain-workflow/agents/code-reviewer.md`
- `examples/gstack/agents/openai.yaml`
- `examples/gstack/ARCHITECTURE.md`
- `examples/openspace/README.md`
- `examples/caveman/README.md`

Word count: ~1950.
