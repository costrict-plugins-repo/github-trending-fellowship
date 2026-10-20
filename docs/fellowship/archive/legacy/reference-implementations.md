# Reference Implementations — What We Learned

Comparative analysis of five Claude Code plugin ecosystems, studied 2026-03-23. These observations inform Fellowship's design decisions and roadmap.

---

## Sources

| Project | Focus | Scale | Location |
|---------|-------|-------|----------|
| [Superpowers](https://github.com/obra/superpowers) | Workflow skills for coding agents | 14 skills, 1 agent | `examples/superpowers/` |
| [Ruflo](https://github.com/drumnation/claude-flow) (Claude Flow) | Swarm orchestration, MCP-heavy | 60+ agents, 259 MCP tools | `examples/ruflo/` |
| [wshobson-agents](https://github.com/wshobson/agents) | Plugin marketplace, domain agents | 72 plugins, 112 agents, 146 skills | `examples/wshobson-agents/` |
| [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) | Meta-prompting, spec-driven, context engineering | 16 agents, 44 commands, 46 workflows | `examples/gsd-get-shit-done/` |
| [context-mode](https://github.com/mksglu/context-mode) | MCP server for context virtualization and session continuity | 8 sandbox tools, 4 hooks | Not cloned (MCP server) |

---

## Superpowers — Key Patterns

### Verification Before Completion
Their strongest skill. Born from 24 real failure memories where the agent claimed success without evidence. Core rule: **no completion claims without fresh verification output.**

- Gate function: IDENTIFY command → RUN it → READ output → VERIFY claim → THEN speak
- Explicit rationalization prevention ("I'm confident" → "Confidence != evidence")
- Red-green cycle enforcement for regression tests
- Agent delegation distrust: "Agent reports success → Check VCS diff → Verify changes"

**What we should adopt:** A verification discipline, either as a skill or baked into dispatch protocol. Currently our agents can say "DONE" without proving it — Gimli self-verifies only when told to.

### Subagent-Driven Development
Two-stage review per task: spec compliance first, then code quality. Key design choice: **fresh subagent per task** (isolated context, no pollution from prior work).

- Spec reviewer prompt includes: "The implementer finished suspiciously quickly. Their report may be incomplete, inaccurate, or optimistic. You MUST verify everything independently."
- Code quality reviewer runs only after spec compliance passes
- Implementer stays alive via SendMessage for fix loops

**What we adopted:** Combined single-pass review (Legolas does both spec + quality). Works for our scale but the skepticism posture is worth stealing — Legolas should distrust Gimli's self-report by default.

### What makes Superpowers effective
14 skills, 1 agent, clean hooks. Works autonomously for hours. Proof that **depth beats breadth** — a few well-crafted skills outperform dozens of shallow ones.

---

## Ruflo (Claude Flow) — Cautionary Observations

### Over-engineering
259 MCP tools, 60+ agents, WASM pipelines, IPFS registry, 3-tier model routing, 8 AgentDB controllers. The CLAUDE.md alone is 80 lines of behavioral rules plus a full package architecture table.

### What to learn from
- 3-tier model routing (WASM → Haiku → Sonnet/Opus) is clever for cost optimization, though Claude Code doesn't expose model routing per-tool today
- Doctor health-check command validates the full stack — similar to our health-check.mjs but broader

### The lesson
Complexity without proportional value. We should resist building all 10 companions before the first three are proven.

---

## wshobson-agents — Key Patterns

### Comprehensive Review Command
Five-phase review workflow producing persistent artifacts:
1. Code Quality & Architecture (parallel agents)
2. Security & Performance (parallel agents)
3. **Checkpoint — user approves before continuing**
4. Testing & Documentation (parallel agents)
5. Best Practices & Standards (parallel agents)
6. Consolidated final report

Each phase writes to `.full-review/` directory. State tracked in `state.json` for resume capability.

**What we should adopt:** Review artifact persistence. Currently Legolas reports findings in conversation context — they vanish. For larger reviews, writing findings to files would let them accumulate and be referenced later.

### UI Design Plugin — Three Agents, Eight Skills
Not one "design agent" but three focused roles:
- **ui-designer** — component creation, layout systems, visual implementation
- **design-system-architect** — design tokens, system patterns, consistency
- **accessibility-expert** — WCAG compliance, screen reader optimization, a11y testing

Backed by deep skills: `visual-design-foundations` (CSS tokens, spacing grids, type scales), `responsive-design`, `interaction-design`, `accessibility-compliance`, `mobile-ios-design`, `mobile-android-design`, `web-component-design`, `react-native-design`.

**Relevance to Arwen:** This validates splitting design into focused skills rather than one generalist agent. Arwen could load different skills per task — a11y audit vs. visual design vs. interaction patterns.

### Agent Teams Plugin
Already built the command layer for Claude Code's experimental Teams mode:
- Commands: `/team-spawn`, `/team-review`, `/team-debug`, `/team-feature`, `/team-status`, `/team-shutdown`
- Agents: `team-lead`, `team-reviewer`, `team-implementer`, `team-debugger`
- Six coordination skills: composition patterns, task coordination, parallel debugging, multi-reviewer patterns, parallel feature dev, communication protocols
- File ownership enforcement for parallel implementation
- Hypothesis-driven debugging with competing investigators

**Relevance to Fellowship:** Direct blueprint for Teams mode support. Their skill structure (especially `team-composition-patterns` and `task-coordination-strategies`) maps to our orchestration needs.

### Progressive Disclosure Architecture
129 skills across 27 plugins, average 3.4 components per plugin. "Install only what you need." Skills load on activation, not at startup.

**We're already on this path** — skills load per-agent via frontmatter. But wshobson shows how deep individual skills can go (e.g., `visual-design-foundations` has concrete CSS systems, not just principles).

### What NOT to copy
- **Breadth over depth**: 72 plugins, 112 agents is a marketplace approach. For a solo dev, most of that is dead weight.
- **`general-purpose` subagent as catch-all**: Used for performance review, test analysis, docs review, DevOps review — agents with no personality, memory, or continuity. Our named companions with persistent context are better for solo dev workflows.

---

## GSD (Get Shit Done) — Key Patterns

GSD is the most architecturally mature Claude Code plugin studied. It prioritizes context engineering above all else — the system is designed to fight context rot, not just organize work.

### Fresh Context Per Agent — The Core Principle

Every spawned agent gets a clean 200K context window. This is explicit in the architecture doc: "This eliminates context rot — the quality degradation that happens as an AI fills its context window with accumulated conversation." The orchestrator (thin workflow file) never does heavy lifting — it loads context via `gsd-tools.cjs init`, spawns agents, collects results, and updates state.

**Relevance:** Fellowship already follows this pattern — companions dispatch fresh. But GSD is explicit about *why* this matters in a way we should be too. When a companion fails, fresh dispatch is the first recovery option.

### The Artifact Pyramid

Each workflow stage produces artifacts that feed forward and make any stage resumable:

```
PROJECT.md → REQUIREMENTS.md → ROADMAP.md
  → CONTEXT.md (per phase, user preferences)
    → RESEARCH.md (per phase, ecosystem)
      → PLAN.md (per task, with XML task structure)
        → SUMMARY.md (execution outcome)
          → VERIFICATION.md (goal-backward check)
            → UAT.md (human acceptance)
```

Every artifact is human-readable Markdown in `.planning/`. Nothing is locked in session history. Any phase can restart from the prior artifact if it fails.

**Relevance:** We have quest log and learnings, but no *phase-level* artifacts. For Tier 4 work specifically, companions should write outputs to files. The artifact is the handoff — not the conversation.

### Wave Execution Model

Plans are analyzed for dependencies and grouped into waves:
- Wave 1: plans with no dependencies (all run in parallel)
- Wave 2: plans that depend on Wave 1 (run in parallel with each other)
- Wave N: runs only after Wave N-1 completes

Parallel agents within a wave use **file locking** on the shared state file (`STATE.md.lock` with `O_EXCL` atomic creation) and **deferred hook runs** (`--no-verify` commits within waves, orchestrator runs `git hook run pre-commit` once after each wave). This prevents the read-modify-write race condition.

**Relevance:** Our Tier 4 wave execution is less formalized. The file locking pattern and deferred hook approach are directly applicable when we implement parallel Gimli dispatches.

### Model Profiles — Four Tiers

GSD's model assignment is the most principled of any implementation studied:

| Role | `quality` | `balanced` | `budget` |
|------|-----------|------------|----------|
| Planning (architecture decisions) | Opus | Opus | Sonnet |
| Execution (follows plans) | Opus | Sonnet | Sonnet |
| Research (web + ecosystem) | Opus | Sonnet | Haiku |
| Verification (reasoning, not pattern) | Sonnet | Sonnet | Haiku |
| Mapping/Exploration (pattern extraction) | Sonnet | Haiku | Haiku |

The rationale is explicit: "The plan already contains the reasoning; execution is implementation." Verifiers need reasoning (Sonnet), not just pattern matching (Haiku).

**Relevance:** Our Tier scoring spec already includes model routing guidance. GSD's tiering validates our approach — Legolas, Pippin, Boromir on Sonnet; Gimli and Aragorn inherit.

### Context Monitor Hook — The Agent Sees Its Own Limits

GSD's `gsd-context-monitor.js` is a PostToolUse hook that injects context warnings *into the agent's conversation* — not just the user's status bar:

- ≤ 35% remaining: "Avoid starting new complex work. Wrap up current task."
- ≤ 25% remaining: "Context nearly exhausted. Stop and save state to files immediately."

Key insight: the status bar shows the *user* how full the context is. The hook tells the *agent*. Without this, an agent can cheerfully start a large refactor at 20% remaining and produce garbage.

**What we should adopt:** A context warning hook for Fellowship. When companions reach 30-35% remaining context, they should receive an advisory to write their progress to a file and wrap up. This is especially important for long Gimli sessions.

### Debug Knowledge Base — Persistent Problem-Solving Memory

The `gsd-debugger` agent appends every resolved debug session to `.planning/debug/knowledge-base.md`. On new sessions, it consults this file first. The format:
- Problem: what broke
- Root cause: what actually caused it
- Solution: what fixed it
- Context: tech stack, relevant files

Sessions progress through states: `gathering → investigating → fixing → verifying → awaiting_human_verify → resolved`. Requires human verification before marking resolved.

**Relevance:** We have no debug knowledge base. When Gimli solves a hard problem, that solution vanishes after the session. Gimli's memory could maintain a `debug-knowledge-base.md` in `.fellowship/` — short entries, but cumulative.

### User Profiler Agent

GSD has a `gsd-user-profiler` agent that analyzes session messages across 8 behavioral dimensions:
communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth.

It produces a `USER-PROFILE.md` that gets injected into future dispatches, teaching agents how *this specific developer* works. Confidence levels and evidence citations — not guesses.

**Relevance:** Our Gandalf memory files serve part of this role. The user-profiler makes it systematic and evidence-based. Not a priority to build, but the pattern is worth noting for when Gandalf's memory becomes richer.

### Defense in Depth

GSD explicitly names four protection layers:
1. Plans are verified before execution (plan-checker, max 3 iterations)
2. Execution produces atomic commits per task (one commit = one plan)
3. Post-execution verification checks against phase goals (not task completion)
4. UAT provides human verification as the final gate

The plan-checker runs across 8 dimensions: requirement coverage, task atomicity, dependency ordering, file scope, verification commands, context fit, gap detection, Nyquist compliance.

**What we should adopt:** Legolas already functions as our plan-checker. But "verification against phase goals, not task completion" is a distinction we don't currently make. Legolas checks spec compliance and code quality — not whether the phase *goal* was achieved.

---

## context-mode — Key Patterns

Context Mode is not a coding workflow tool but an MCP server that operates at the transport layer — intercepting tool calls before their output reaches the context window. Studied because of its approach to the token efficiency problem.

### The Sandbox Architecture

Instead of letting Claude call `Bash` or `Read` directly (which dumps raw output into context), Context Mode intercepts these calls and runs them in sandboxed subprocesses. Only a compact summary enters the context:

| Operation | Raw size | Sandboxed size | Reduction |
|-----------|----------|----------------|-----------|
| Playwright snapshot | 56 KB | 299 B | 99% |
| 20 GitHub issues | 59 KB | 1.1 KB | 98% |
| 500-request access log | 45 KB | 155 B | 100% |
| Batch commands | 986 KB | 62 KB | 94% |

A full session: "315 KB of raw output becomes 5.4 KB. Session time extends from ~30 minutes to ~3 hours."

### PreCompact Strategy

Before context compaction occurs, Context Mode fires a `PreCompact` hook that:
1. Indexes all session events into FTS5 (SQLite full-text search) tables
2. Builds a priority-tiered XML snapshot (≤2KB) with: active files, current tasks, key decisions, unresolved errors
3. On resume, retrieves only semantically relevant state via BM25 ranking

The critical insight: **don't dump everything back into context after compaction — only what's relevant to the current task.**

**Relevance to Fellowship:** Our quest log serves a similar role but is static — it doesn't use semantic retrieval. The PreCompact hook is beyond what we'd build into the plugin, but the principle (only relevant state after compaction) informs how Gandalf should structure the quest log for post-compaction readability.

### Not Our Approach

Context Mode is MCP-only and requires changing how every tool is called. Fellowship doesn't use MCP. But the problem it solves is real — and our approach to it is different:

| Approach | Context Mode | Fellowship |
|----------|-------------|------------|
| Token reduction | Intercept + sandbox at transport layer | Focused companion prompts, scoped context |
| Session continuity | FTS5+BM25 semantic retrieval | Structured quest log (80-line budget) |
| Post-compaction | Priority-tiered XML snapshot | Three-zone quest log (Current / Recently Completed / What Exists) |
| Memory search | SQL full-text search | Human-readable markdown, manual curation |

---

## awesome-claude-skills — Key Patterns

The [Composio awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) repository is primarily a marketplace, not an architecture reference. Two patterns are worth noting.

### Skill-Creator Skill

A meta-skill that provides guidance for building other skills. Key: "extend capabilities with specialized knowledge, workflows, and tool integrations." Uses Composio's 850+ SaaS integrations as building blocks for new skills. The pattern reinforces that skills are first-class objects that can be evaluated and improved.

### Self-Improving Skills — The AutoResearch Pattern

The most significant finding from this research pass. Drawn from Karpathy's AutoResearch methodology, several creators have built skill self-improvement loops:

1. **Define binary assertions** (eval.json): each assertion is a pass/fail test against a skill's output
2. **Run eval overnight**: Claude Code reads the skill, runs 30-50 eval cycles, analyzes failures
3. **Propose edits**: failed assertions identify what the skill doesn't teach. Claude edits the skill.
4. **Iterate**: re-run evals, measure pass rate change

Results: skills starting at 40-50% pass rate reach 75-85% after overnight optimization. Binary (not LLM-graded) assertions are the key — deterministic, fast, unambiguous.

**Relevance to Fellowship:** We currently write skills by hand and hope they work. The AutoResearch pattern gives a path to *measure* and *improve* skill quality without human review on every edit. Gimli's engineering skill and Pippin's testing skill are strong candidates for eval — both involve objective outputs (does the code work? do the tests pass?). This connects to SkillsBench (see research.md) but as a lighter-weight, offline-first approach.

---

## Cross-Cutting Themes

| Theme | Superpowers | Ruflo | wshobson | GSD | Fellowship |
|-------|-------------|-------|----------|-----|------------|
| Verification | Strict enforcement | Not prominent | Checkpoint-based | 4-layer defense in depth | **Gap — need to add** |
| Review depth | Two-stage (spec + quality) | Basic | Five-phase with artifacts | Plan-checker (8 dimensions) + verifier | Single-pass (Legolas) |
| Agent count | 1 | 60+ | 112 | 16 | 4 active (targeting 10) |
| Skill depth | Deep (14 mature skills) | Shallow (MCP-heavy) | Deep (129 skills) | Deep workflows + references | Growing (6 skills) |
| State persistence | TodoWrite | MCP memory | File-based (.full-review/) | `.planning/` artifact pyramid | Conversation + memory |
| Teams mode | Not used | Swarm (custom) | Full implementation | Not implemented | **Planned** |
| Model routing | Not used | 3-tier (WASM/Haiku/Opus) | Per-agent model hints | 4 profiles (quality/balanced/budget/inherit) | Subagent model param (spec ready) |
| Context efficiency | Not addressed | Not addressed | Not addressed | Context monitor hook + fresh windows | Quest log (80-line budget) |
| Session continuity | None | None | None | `pause-work` / `resume-work` + `continue-here.md` | Quest log |
| Debug persistence | None | None | None | Debug knowledge base | None — **gap** |

---

## Potential Improvements — Companion by Companion

Concrete gaps and enhancements for each Fellowship companion, derived from what the reference implementations do well.

### Gandalf (Orchestrator)

**Gap: Verification enforcement.**
Superpowers has a dedicated `verification-before-completion` skill with an iron rule: no completion claims without fresh verification output. Our orchestration skill doesn't enforce this — Gimli can say "DONE" without running tests, and Gandalf trusts it. Superpowers even has rationalization prevention ("I'm confident" → "Confidence != evidence").

- **Improvement:** Add a verification gate to the dispatch protocol. When Gimli reports DONE, Gandalf should check: did the report include verification output? If not, send him back. This could be a lightweight verification skill or a section in the orchestration skill.
- **Source:** `examples/superpowers/skills/verification-before-completion/SKILL.md`

**Gap: Brainstorming hard gate.**
Superpowers enforces a hard gate: no implementation skill can be invoked until a design is presented and approved. "Every project goes through this process. A todo list, a single-function utility, a config change — all of them." Our brainstorming skill exists but has no enforcement mechanism.

- **Improvement:** Add a `<HARD-GATE>` equivalent to the brainstorming skill — Gandalf should not dispatch Gimli until the user has approved the design. For simple tasks, the design can be one sentence, but it must exist and be confirmed.
- **Source:** `examples/superpowers/skills/brainstorming/SKILL.md`

**Gap: Branch finishing workflow.**
Superpowers has a `finishing-a-development-branch` skill: verify tests → determine base branch → present 4 options (merge locally, create PR, keep as-is, discard). We have no post-implementation workflow — after Gimli builds and Legolas reviews, there's no structured "what now?" step.

- **Improvement:** Add a finishing phase to the orchestration skill. After the review cycle completes, Gandalf presents options: commit, create PR, park the branch, or iterate further.
- **Source:** `examples/superpowers/skills/finishing-a-development-branch/SKILL.md`

**Gap: Agent delegation distrust.**
Superpowers explicitly says: "Agent reports success → Check VCS diff → Verify changes → Report actual state." We should verify Gimli's self-report by checking the actual git diff before declaring success.

- **Improvement:** After Gimli reports DONE, Gandalf runs `git diff --stat` to confirm changes match expectations before dispatching Legolas or declaring complete.
- **Source:** `examples/superpowers/skills/verification-before-completion/SKILL.md` (agent delegation section)

### Gimli (Engineer)

**Gap: Systematic debugging protocol.**
Superpowers has a dedicated `systematic-debugging` skill with four phases: root cause investigation → hypothesis → fix → verify. Core rule: "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST." Our engineering skill says "verify your work" but has no debugging methodology.

- **Improvement:** Add a debugging section to the engineering skill or create a standalone debugging skill. Key elements: read error messages completely, reproduce consistently, check recent changes, gather evidence at component boundaries, form hypotheses before attempting fixes.
- **Source:** `examples/superpowers/skills/systematic-debugging/SKILL.md`

**Gap: Plan-aware task execution.**
Superpowers' `writing-plans` skill produces plans with bite-sized tasks (2-5 min each), explicit file paths, and checkbox tracking. Plans assume "the engineer has zero context for our codebase and questionable taste." Our plans are less structured — they describe what to build but don't always specify exact files to touch or decompose into TDD-sized steps.

- **Improvement:** When Gandalf writes plans for Gimli, include: exact file paths per task, checkbox steps (write test → verify fail → implement → verify pass → commit), and assume Gimli knows nothing about the codebase.
- **Source:** `examples/superpowers/skills/writing-plans/SKILL.md`

**Gap: No implementation code without failing test (TDD discipline).**
Superpowers has a strict iron law: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. Write code before the test? Delete it. Start over." Our engineering skill says Gimli "may write simple inline tests" but comprehensive testing is Pippin's domain. This creates a gap — Gimli builds, then Pippin tests after, which means bugs are caught late.

- **Improvement:** For critical-path work, consider dispatching Pippin first in test-first mode (already supported in our testing skill). This is a Gandalf routing decision, not a Gimli change. But the engineering skill could emphasize: "for pure functions and data transformations, write the test first even if Pippin will test later."
- **Source:** `examples/superpowers/skills/test-driven-development/SKILL.md`

### Legolas (Code Reviewer)

**Gap: Review artifact persistence.**
wshobson's comprehensive review writes findings to `.full-review/` files — persistent, referenceable, accumulable. Our Legolas returns findings in conversation context, which vanishes after the session. For small reviews this is fine; for multi-file reviews or review cycles that span sessions, it's a loss.

- **Improvement:** For reviews above a threshold (e.g., >3 files changed, or explicitly requested), Legolas writes findings to `docs/fellowship/reviews/YYYY-MM-DD-<feature>.md`. Smaller reviews stay conversational.
- **Source:** `examples/wshobson-agents/plugins/comprehensive-review/commands/full-review.md`

**Gap: Multi-dimensional review.**
wshobson runs parallel review agents: code quality + architecture in Phase 1, security + performance in Phase 2, testing + documentation in Phase 3. Our Legolas does a single pass covering everything, which works for small changes but may miss depth on specific dimensions.

- **Improvement:** Don't split Legolas into multiple agents (that's over-engineering for a solo dev). Instead, add review checklists per dimension to the code-review skill. A "Security Review Checklist" section, a "Performance Review Checklist" section — Legolas runs through them as part of his single pass. This gets the depth without the coordination overhead.
- **Source:** `examples/wshobson-agents/plugins/comprehensive-review/commands/full-review.md` (Phase 1-4 prompt templates)

**Gap: Code review reception protocol.**
Superpowers has a `receiving-code-review` skill that tells the implementer how to respond to feedback: "Verify before implementing. Ask before assuming. Technical correctness over social comfort." Forbidden responses include "You're absolutely right!" Our Gimli has no explicit guidance on how to handle Legolas's findings — he just gets them and fixes them.

- **Improvement:** Add a "receiving review" section to the engineering skill. Key rules: restate the technical requirement in your own words, verify against the codebase before implementing, push back with technical reasoning if the finding is wrong.
- **Source:** `examples/superpowers/skills/receiving-code-review/SKILL.md`

### Pippin (Test Engineer)

**Gap: Red-green verification.**
Superpowers enforces: "If you didn't watch the test fail, you don't know if it tests the right thing." Their TDD skill requires running the test in RED (fails) before writing production code, then GREEN (passes). wshobson's `tdd-red` command separately generates and verifies failing tests. Our Pippin writes tests and runs them, but doesn't explicitly verify the red-green cycle.

- **Improvement:** Add to the testing skill: "In test-first mode, after writing tests, run them and verify they FAIL. If any test passes before implementation exists, that test is suspect — it may not be testing what you think." In test-after mode: "For regression tests, temporarily revert the fix and confirm the test fails, then restore."
- **Source:** `examples/superpowers/skills/test-driven-development/SKILL.md`, `examples/wshobson-agents/plugins/tdd-workflows/commands/tdd-red.md`

**Gap: Diagnostic self-check (already addressed).**
Pippin must clean up lint/diagnostic warnings in test code before reporting done. Already captured in Gandalf's feedback memory. Should be formalized in the testing skill.

- **Improvement:** Add to testing skill: "Before reporting done, check for diagnostics (unused imports, unused variables, type warnings) in all test files you created or modified. Fix them. No one reviews your work — you are the last stop."
- **Source:** Fellowship feedback memory (`feedback_pippin_self_cleanup.md`)

### Arwen (Product Designer) — Not Yet Built

**Gap: No design skill depth.**
wshobson has 8 skills backing their UI design plugin: `visual-design-foundations` (concrete CSS token systems, spacing grids, type scales), `responsive-design`, `interaction-design`, `accessibility-compliance` (full WCAG 2.1/2.2 criteria, ARIA patterns, testing methodology), `mobile-ios-design`, `mobile-android-design`, `web-component-design`, `react-native-design`.

- **Improvement:** When building Arwen, create deep skills rather than one shallow "design" skill. Start with two: `visual-design` (design tokens, typography, color, spacing — draw from wshobson's `visual-design-foundations`) and `accessibility` (WCAG criteria, ARIA patterns, testing tools — draw from wshobson's `accessibility-compliance` and their `accessibility-expert` agent).
- **Source:** `examples/wshobson-agents/plugins/ui-design/skills/`, `examples/wshobson-agents/plugins/ui-design/agents/accessibility-expert.md`

### Boromir (Security Engineer) — Not Yet Built

**Gap: No security audit methodology.**
wshobson has a `security-auditor` agent with a structured approach: OWASP Top 10 checklist, input validation, auth/authz, cryptographic issues, dependency vulnerabilities, configuration security. They also have a `threat-modeling-expert` agent. Superpowers embeds security checks in code review but doesn't have a dedicated security workflow.

- **Improvement:** When building Boromir, his security skill should include concrete checklists (OWASP Top 10 mapped to code patterns), not just principles. Draw from wshobson's security-auditor prompts for the structure: each finding gets severity, CWE reference, file/line location, attack scenario, and remediation steps.
- **Source:** `examples/wshobson-agents/plugins/security-scanning/agents/security-auditor.md`, `examples/wshobson-agents/plugins/security-compliance/agents/security-auditor.md`, `examples/wshobson-agents/plugins/comprehensive-review/commands/full-review.md` (Phase 2A)

### Sam (DevOps / Infrastructure) — Not Yet Built

Sam is now DevOps/Infrastructure (not User Researcher — that role was retired). His skill should cover: CI/CD pipelines, deployment workflows, environment configuration, Docker/container patterns, monitoring and observability setup.

**Enhancement idea from GSD: Brownfield codebase mapping.**
GSD's `gsd-codebase-mapper` spawns 4 parallel Haiku agents to explore an existing codebase and produce structured analysis documents: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md, STRUCTURE.md, TESTING.md, INTEGRATIONS.md. This is read-only exploration at scale.

- **Improvement:** Sam's devops skill should include an infrastructure mapping mode: run on a new project to map the deployment setup, CI/CD config, container definitions, and environment variables — producing a single structured `infra-context.md` that Gandalf and other companions can reference.
- **Source:** `examples/gsd-get-shit-done/agents/gsd-codebase-mapper.md`

**Enhancement idea from wshobson: Parallel research (for future Sam capabilities).**
If Sam gains a secondary research capability, wshobson's parallel research pattern applies: spawn 3 Sam instances investigating different questions simultaneously, each producing a findings document with citations.

- **Source:** `examples/wshobson-agents/plugins/agent-teams/README.md` (Parallel Research section)

---

## Potential Skill Additions

New skills that don't exist in our plugin but are proven in reference implementations:

| Skill | Inspired By | Purpose | Priority |
|-------|-------------|---------|----------|
| `verification` | Superpowers | Evidence-before-claims gate for all companions | High |
| `debugging` | Superpowers | Systematic root-cause methodology for Gimli | High |
| `accessibility` | wshobson | WCAG compliance, ARIA patterns, a11y testing for Arwen | Medium (when Arwen is built) |
| `visual-design` | wshobson | Design tokens, typography, color, spacing for Arwen | Medium (when Arwen is built) |
| `security-audit` | wshobson | OWASP checklists, threat modeling for Boromir | Medium (when Boromir is built) |
| `finishing` | Superpowers | Post-implementation workflow (merge/PR/park) | Low |

---

## Action Items

Derived from this analysis, prioritized by impact:

### Immediate (next session)
1. **Add verification skill** — light, inspired by Superpowers. Evidence before claims, enforced at dispatch.
2. **Strengthen Legolas code-review skill** — add review dimension checklists (security, performance, testing gaps) and formalize distrust posture.
3. **Strengthen Pippin testing skill** — add red-green verification requirement and diagnostic self-check.

### Soon (before adding new companions)
4. **Add debugging skill for Gimli** — systematic root-cause investigation before attempting fixes.
5. **Add "receiving review" section to engineering skill** — how Gimli should handle Legolas's findings.
6. **Add review artifact persistence** — Legolas writes findings to files for larger reviews.

### When building new companions
7. **Arwen: deep skills (visual-design + accessibility)** — draw from wshobson's UI design plugin.
8. **Boromir: security-audit skill with OWASP checklists** — draw from wshobson's security agents.
9. **Sam: structured research with citations** — findings documents, not conversational research.

### Infrastructure
10. **Teams mode support** — study wshobson's agent-teams plugin when implementing.
11. **Keep depth over breadth** — resist adding companions until existing ones are proven. Superpowers' 14 skills > Ruflo's 259 tools.

### From GSD (new, highest priority)
12. **Context monitor hook** — PostToolUse hook that injects remaining-context warnings into Gimli's conversation. At ≤35%: "wrap up current task." At ≤25%: "write progress to file, stop." Prevents garbage output from context-exhausted agents.
13. **Debug knowledge base** — Gimli accumulates resolved debug sessions to `.fellowship/debug-knowledge-base.md`. Short entries: problem, root cause, solution, files. Consulted at the start of new debug sessions.
14. **Finalization workflow** — after Gimli builds and Legolas approves, Gandalf presents structured options: commit, create PR, park branch, or iterate. GSD's `finishing-a-development-branch` pattern is directly applicable.

### Skill self-improvement (future)
15. **AutoResearch eval loop** — define binary assertions for Gimli's engineering skill and Pippin's testing skill. Run eval overnight. Use pass rate as the signal. Start with 5-10 assertions per skill, measure weekly. This is the Karpathy/AutoResearch pattern applied to Fellowship's core skills.
