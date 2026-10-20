# The Fellowship

A LotR-themed multi-agent system for solo product development. Built as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin.

You are Frodo. You carry the Ring — your product, your vision, your burden. The Fellowship exists to serve you on the quest.

## How it works

Open Claude Code in a project. Gandalf is already there. Before he writes a line, he reads the state of the repo — what you're building, what's open, where things stood when you last left off. *"Where shall we begin?"* he asks, and means it.

When you give him a task, he weighs it. A typo fix is a Tier 1 — he handles it himself. A new component is Tier 2 — he loads a skill or sends one companion. A multi-file refactor is Tier 3 — companions work in sequence. A whole feature is Tier 4 — Aragorn first reviews the scope, then companions work in parallel. Gandalf is conservative; he never summons the full Fellowship when one will do.

Every companion has a craft. Aragorn defines *what* to build. Merry decides *how*. Gimli builds it. Legolas reviews it. Boromir guards it. Pippin tests it. Sam ships it. Arwen designs the surface. Bilbo writes it down. They each have scoped tools, persistent memory, and a voice you'll come to recognize.

When Gimli builds on a critical path, Legolas reviews. If issues surface, Gimli fixes — Legolas re-reviews — repeat until approved. The cycle runs to completion; the work is worthy or it doesn't ship. *"That still only counts as one!"*

## Install

```
/plugin marketplace add KarolusD/fellowship
/plugin install fellowship@fellowship
```

Open Claude Code in any project. Gandalf greets you and reads the state of the repo before anything else.

- **Fresh project:** he bootstraps `docs/fellowship/` and asks *"What are we building, and who is it for?"*
- **Existing project:** he picks up the thread from the quest log.

**Mid-session shortcuts:**

- `/fellowship:start` — Gandalf reads the repo and asks where to begin (also fires automatically on session start)
- `/fellowship:aragorn`, `/fellowship:merry`, `/fellowship:gimli`, `/fellowship:legolas`, `/fellowship:boromir`, `/fellowship:pippin`, `/fellowship:sam`, `/fellowship:arwen`, `/fellowship:bilbo` — load a specific companion's craft directly
- `/fellowship:brainstorming`, `/fellowship:planning`, `/fellowship:investigate`, `/fellowship:learn` — load a cross-cutting workflow skill
- `/fellowship:map`, `/fellowship:accessibility`, `/fellowship:ux-audit`, `/fellowship:using-worktrees` — codebase mapping, a11y audit, UX audit, parallel-worktree workflow

**Verify the install:** start a fresh Claude Code session in any project. Gandalf greets you in voice and reads the repo before doing anything else. If he doesn't, the plugin isn't loaded.

**Updating:**

```
/plugin update fellowship
```

## The Fellowship

Ten companions walk beside you. Each carries a distinct purpose — no two share the same blade.

| | Name | Role | Why this character |
|---|---|---|---|
| 🧙 | **Gandalf** | Orchestrator | Assembled the Fellowship, chose the path, knew when to guide and when to step aside. Routes tasks, classifies complexity, handles the small things directly. |
| 👑 | **Aragorn** | Product Manager | The king who served before he ruled — made the hardest calls, chose the Paths of the Dead when no other road remained. Decides *what* to build and *why*. |
| 🍺 | **Merry** | Technical Architect | Most scholarly hobbit — mapped the Old Forest, studied Rohan's military history, wrote *The Reckoning of Years*. Decides *how* to build it. |
| 🪓 | **Gimli** | Engineer | Dwarves built Khazad-dûm and reforged the gates of Minas Tirith in mithril. Builds new features, new code, new systems. |
| 🏹 | **Legolas** | Code Reviewer | Elven eyes that never miss — spotted threats from miles away, counted every kill at Helm's Deep. Reviews code for spec compliance and quality. |
| 🗡️ | **Boromir** | Security Engineer | Defended the White City his whole life — and fell to the Ring's corruption. He knows what it costs to leave a door unguarded. |
| 🍄 | **Pippin** | Test Engineer | Dropped a stone in Moria, looked into the Palantír, lit the beacons on instinct. The fool finds what careful minds overlook. |
| 🌻 | **Sam** | DevOps / Infrastructure | Gardener of Bag End — tended the soil so others could grow. Maintained the supply lines into Mordor. The unglamorous work that keeps everything else alive. |
| 🌟 | **Arwen** | Product Designer | Wove the banner of the King — designed Aragorn's identity before he claimed it. Shapes visual language, user flows, and audits the craft for UX, accessibility, and style. |
| 📖 | **Bilbo** | Technical Writer | Author of *There and Back Again*. Built the map that made the Lonely Mountain quest repeatable. Clear writing is a form of engineering. |

> *You (Frodo) are the eleventh. You carry the weight. You make the final call. The Fellowship serves the Ring-bearer.*

## Architecture

**Skills** are cross-cutting workflow patterns — methodology any agent or the user can invoke mid-session. Brainstorming, planning, accessibility audits, codebase mapping, investigation.

**Agents** are self-contained companions. Each agent's craft methodology lives inline in their agent file — character, role, craft, behavioral contracts, and reporting format in one document. No cross-referencing, no drift.

Gandalf is the orchestration skill loaded at session start by a SessionStart hook. The nine companions are agents.

### Tiered Routing

Gandalf classifies every task by weight before assembling the party.

| Tier | What happens | Overhead |
|------|-------------|----------|
| **1** | Gandalf handles it alone | None |
| **2** | Gandalf loads a skill or dispatches one agent | Minimal |
| **3** | Sequential chain — agent output feeds the next | ~3-5 min |
| **4** | Aragorn consulted on scope, then parallel agents | ~8-15 min |

Gandalf is conservative — a solo dev's time is precious. Borderline cases err toward the lower tier. Before Tier 4 work, Gandalf consults Aragorn; scope that seems necessary in the moment often isn't.

### The Review Cycle

When Gimli builds on critical paths (auth, payments, data mutations, public APIs), Legolas reviews. Inspired by [Superpowers](https://github.com/obra/superpowers)' subagent-driven-development.

```
Gandalf → Gimli builds, reports DONE
  → Gandalf dispatches Legolas to review
    → IF issues found:
        Gimli stays alive via SendMessage, fixes, reports DONE
        → Legolas re-reviews
        → repeat until approved
    → approved → task complete
```

- Gandalf decides whether to dispatch Legolas — not all work needs review.
- Legolas never edits code — findings flow back through Gandalf to Gimli.
- Once review starts, the cycle runs to completion.

Findings are categorized **Critical** (bugs, security, data loss), **Important** (architecture, missing features, test gaps), or **Minor** (style, optimization, docs).

### Agent Tool Scoping

Each agent gets only the tools they need.

| Agent | Tools | Why |
|---|---|---|
| **Gimli** | Read, Write, Edit, Glob, Grep, Bash | Full implementation |
| **Legolas** | Read, Glob, Grep, Bash | Pure reviewer — never edits |
| **Boromir** | Read, Glob, Grep, Bash | Security audit — never modifies |
| **Pippin / Sam / Bilbo / Arwen** | Read, Write, Edit, Glob, Grep, Bash | Create and update artifacts |
| **Aragorn / Merry** | Read, Write, Glob, Grep, Bash | Create requirements and architecture docs |
| **Arwen** | + Figma MCPs | Design artifact manipulation |

### Project Memory

The Fellowship remembers across sessions. `docs/fellowship/quest-log.md` carries the thread; per-agent memory accumulates domain knowledge; feedback you give a misbehaving companion silently becomes new eval scenarios for AutoImprove.

## What runs on your machine

The Fellowship is a local plugin — no network calls, no external services. When active, hooks fire on every Claude Code session in this project. Bilbo would have you know exactly what runs, and when.

- **SessionStart** — fires on `startup`, `clear`, `compact`, and `resume`. Four hooks run in order:
  - `hooks/session-start` — reads `docs/fellowship/*.md` (quest-log, product context, debug-log, handoffs, codebase-map) and injects them into the model's context.
  - `hooks/fellowship-voice-session-start.mjs` — injects the voice persistence layer so Gandalf and the companions hold their register across long sessions. Single-layer since 2026-06-11: the per-turn UserPromptSubmit re-anchor was removed (it could not push past the additive-prompting ceiling the evals measured), so this SessionStart injection is the sole voice mechanism.
  - `hooks/fellowship-opener-session-start.mjs` — on second and later sessions, surfaces a short orientation derived from `git log -5`, the top open quest-log items, and in-flight project memory. First session is skipped (gated by a per-project history marker under `~/.claude/fellowship/state/` — never written into your project tree).
  - `hooks/fellowship-drift-check-session-start.mjs` — walks the top level of `docs/fellowship/` once per session and surfaces any files or folders outside the canonical tree.
- **PreToolUse** (`hooks/fellowship-plan-gate.mjs`) — runs on every `Edit`, `Write`, and `MultiEdit` tool call.
- **PostToolUse** (`hooks/fellowship-context-monitor.mjs`) — runs after every tool call to monitor context pressure.
- **SessionEnd** (`hooks/fellowship-session-end.mjs`) — runs when the session closes. Reconciles companion status frontmatter against repository state, sweeps any artifact marked `status: reviewed` into `archive/<type>/`, keeps `quest-log.md` under 50 entries (oldest 25 spill to `quest-log-archive.md`), and prints one summary line. The full design lives in `docs/fellowship/specs/2026-05-24-adr-cluster-d-hooks.md`; the contract it enforces is `docs/fellowship/specs/2026-05-15-project-state-contract.md`.

All hooks are pure-stdlib Node.js or bash. No network calls, no external dependencies. Treat any `.md` file under `docs/fellowship/` as trust-equivalent to your project source code — its content is injected into the model's context on every session start.

The eval harness (`evals/_runner/improve.sh`) invokes `claude --dangerously-skip-permissions` against a throwaway worktree. Do not run it on a repository containing secrets you are not willing to expose to a fully-permissioned Claude session.

## Known Limitations

**Coexistence with other identity-injecting plugins.** Fellowship's SessionStart hook injects a strong "you are Gandalf" identity wrapper. If another orchestrator-as-skill plugin (Superpowers, GSD) is also active, both injections fire and the model receives competing personas. Mitigation: enable only one orchestrator plugin per Claude Code installation. Skill-only and agent-only plugins coexist cleanly.

## AutoImprove

A self-improvement loop for agent instruction files. Each agent has an eval suite (`scenarios.jsonl`, `holdout.jsonl`, `hard.py`, `soft.md`). The runner invokes fresh Claude instances per scenario, measures pass rate, proposes one change per cycle, commits improvements or reverts failures. A separate holdout set validates against overfitting.

```bash
./evals/_runner/improve.sh gimli --cycles 15
./evals/_runner/improve.sh --all --cycles 15  # ~3-5 hours
```

Currently covers all nine companions (Aragorn, Merry, Gimli, Legolas, Boromir, Pippin, Sam, Arwen, Bilbo) plus Gandalf and a `voice-persistence` suite that exercises the voice hook end-to-end. Outer loop on Sonnet, inner workers on Haiku — ~$0.60–$1.50 per 15-cycle run, originally measured per single-agent target; the per-run figure should hold per target but `--all` runs scale linearly across twelve suites. Scope guardrail: the loop modifies only `agents/<target>.md` and `evals/<target>/`.

## Compared to Superpowers

The Fellowship is inspired by [Superpowers](https://github.com/obra/superpowers) (MIT) and adapts it for solo product development.

| Capability | Superpowers | Fellowship |
|---|---|---|
| Workflow skills | ✅ Mature, proven | ✅ Ported and extended |
| Specialized agents | 1 (code-reviewer) | 10 (scoped tools + memory) |
| Code review cycle | Two-stage, every task | Combined single-pass, Gandalf's judgment per task |
| Product / Security / Design / Docs / DevOps | — | ✅ Aragorn / Boromir / Arwen / Bilbo / Sam |
| Project memory | — | ✅ Persistent across sessions |
| Agent memory | — | ✅ Domain-specific accumulation |
| Tool scoping | All to all | Scoped per agent |
| Identity | Generic skill names | Memorable characters, themed commands |

## Principles

- **The Ring must not grow heavier.** Scope is sacred. Every addition is a burden.
- **Not every quest needs the full Fellowship.** Most tasks need one companion, maybe two.
- **Agent craft lives in the agent.** Each agent is a complete document. Skills are for cross-cutting patterns.
- **Insight flows forward.** Each agent's output feeds the next — no work is lost.
- **Memory endures.** Key decisions persist across sessions.
- **Latency is the enemy.** Default conservative. Escalate only when the task demands it.
- **Start with Gandalf.** Add agents one at a time, only when you feel the gap.

## Status

v1.0.0. All ten companions built; triple-audit passed before tag. The thing to validate now is real-project orchestration — finding the gaps that only appear when the stakes are real.

Battle-tested on Fellowship's own development; actively seeking feedback from first real-project users.

Research, design notes, and source list at [`docs/fellowship/research.md`](docs/fellowship/research.md).

## Feedback

Issues, ideas, and orchestration gaps welcome at [github.com/KarolusD/fellowship/issues](https://github.com/KarolusD/fellowship/issues). Real-project usage reports are especially valuable — the gaps that only appear when the stakes are real are exactly what v1.1 needs to find.

## License

MIT
