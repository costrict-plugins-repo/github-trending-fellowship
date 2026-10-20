# Companions

Each companion is an **agent** file (`agents/<name>.md`) with a thin `/fellowship:<name>` slash-command pointer in `commands/`. Loading the slash command surfaces the agent's craft — character, methodology, report format — into the current session without a dispatch; dispatching the agent runs the same craft in an isolated subagent context. Only Gandalf is the orchestrator skill (`skills/using-fellowship/`); the other nine companions are not dual skill+agent — the slash command is a convenience pointer, not a separate skill definition.

| Companion | Role | Skill (in session) | Agent (dispatched) |
|---|---|---|---|
| **Aragorn** | Product Manager | `/aragorn` — product thinking, scope, requirements | Independent PRD analysis, requirement docs |
| **Merry** | Technical Architect | `/merry` — system design, tradeoffs, data modeling | Independent architecture design |
| **Gimli** | Engineer | Engineering standards reference | Implementation, building features |
| **Legolas** | Code Reviewer | `/legolas` — quick code review lens | Review Gimli's work for spec compliance + quality |
| **Boromir** | Security Engineer | `/boromir` — security review lens | Full security audit |
| **Pippin** | Test Engineer | `/pippin` — testing methodology | Write and run tests |
| **Sam** | DevOps / Infrastructure | `/sam` — infrastructure thinking, deployment, CI/CD | Pipeline setup, environment config, deployment automation |
| **Arwen** | Senior Product Designer | `/arwen` — design thinking, design contract | Design Contract, UX audit, accessibility, Figma work, visual exploration |
| **Bilbo** | Technical Writer | `/bilbo` — documentation lens | README, changelog, inline docs, API reference |

**Skills enhance agents.** Multiple agents can load the same skill. Gimli building UI loads the design skill. Legolas reviewing auth code loads the security skill.

## Skill hooks

- **User describes a bug** ("X is broken", "Y isn't working", "this keeps failing") → dispatch Gimli with `fellowship:investigate` loaded. Investigation precedes fix.
- **User asks what you remember, or memory feels stale** ("what do you know about X", "have we done this before", "what did we decide about Y") → load `fellowship:learn` in session before responding.

## Project-Local Skills and Agents

At session start, the hook surveys `.claude/skills/` and `.claude/agents/` in the project root. If present, they surface in the `<PROJECT_LOCAL>` context block — you will see the inventory before any dispatch.

**Precedence on name collision: project-local wins.** If a project has `.claude/skills/planning/` and the plugin has a `planning` skill, the project's version is used. The project owner knows what they need better than the plugin does.

**When to load a project-local skill:** whenever you would have loaded the plugin version. The decision is the same; the source differs.

**What not to do:** do not assume the plugin set is complete. If a project has its own `.claude/agents/auth-specialist.md`, that is the intended dispatcher for auth work on that project — not Gimli with generic auth instructions. Read the project-local agent file before routing.

## Model Routing

Pass a `model` parameter at dispatch based on the companion's role. Principle: companions following structured checklists run on sonnet; companions making judgment calls inherit the user's model.

| Companion | Default | Use `inherit` when | Use `sonnet` when |
|-----------|---------|-------------------|------------------|
| Gimli | inherit | New features, critical paths, complex logic | Simple fixes, config changes, established patterns |
| Legolas | sonnet | Reviewing complex architecture decisions | Standard code review (most dispatches) |
| Pippin | sonnet | Complex test infrastructure setup | Writing tests from specs (most dispatches) |
| Merry | inherit | Always — architecture decisions need strong reasoning | — |
| Aragorn | inherit | Always — product strategy needs nuance | — |
| Boromir | sonnet | Novel security concerns | OWASP checklist audits (most dispatches) |
| Sam | sonnet | — | Infrastructure and deployment tasks (all dispatches) |
| Arwen | sonnet | Greenfield design (Design Contract, new visual direction) | Compliance checks, audits, a11y passes (most dispatches) |
| Bilbo | sonnet | — | Documentation passes (all dispatches) |

No frontmatter changes needed — model routing happens at dispatch time via the `model` parameter. Agent files keep `model: inherit` as default.

## Agent Teams compositions

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set and Tier 4 with independent streams:

| Scenario | Team | Why Teams helps |
|----------|------|-----------------|
| Parallel review | Legolas (code quality) + Boromir (security) | Two dimensions simultaneously, findings don't overlap |
| Cross-layer feature | Gimli (backend) + Gimli (frontend) | File ownership boundaries, parallel build |
| Parallel deployment review | Sam (infra) + Boromir (security) | CI/CD and security concerns in parallel before a release |
| Full feature cycle | Gimli (build) + Legolas (review) | Review starts on early files while Gimli builds later ones |

**Never default to Teams.** Most Tier 4 tasks are served by parallel subagents.
