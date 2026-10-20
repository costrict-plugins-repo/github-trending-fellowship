# docs/fellowship — Directory Guide

One rule per directory. Write to the right place. Archive moves are automatic at SessionEnd — you don't run them by hand.

The canonical shape is defined in `specs/2026-05-15-project-state-contract.md`. Anything outside this shape is drift; the SessionStart hook flags it.

---

## `specs/` — What we're building

Formal scope and design artifacts. One file per feature.

- **PRDs** — Aragorn's requirements documents (what the feature must do, for whom, why)
- **ADRs** — Merry's architecture decision records (how the system will handle it)
- **Skill/feature specs** — any formal description of scope before execution

**Naming:** `YYYY-MM-DD-{slug}.md`
**Active work** lives at the top level of `specs/`.
**On `reviewed` status** — auto-moved to `archive/specs/` by the SessionEnd sweep.

## `plans/` — How we'll build it

Step-by-step execution plans produced by the planning skill. One file per quest.

- Who does what, in what order
- File-level tasks and ownership
- Verification checkpoints

**Naming:** `YYYY-MM-DD-{slug}.md`
**On `reviewed` status** — auto-moved to `archive/plans/`.

## `handoffs/` — Companion-to-companion briefs

Cross-companion handoff notes, including session-to-session continuity when context runs low. Template: `skills/using-fellowship/references/handoff-template.md`.

**Naming:** `YYYY-MM-DD-{from}-to-{to}-{topic}.md`
**On `reviewed` status** — auto-moved to `archive/handoffs/`.

## `design/` — Visual and interaction artifacts

Wireframes, Figma exports, HTML/CSS mockups, screenshots, flow diagrams. Anything visual.

- One subdirectory per feature if multiple files: `design/{feature-slug}/`
- Loose files are fine for single artifacts

**Naming:** `YYYY-MM-DD-{slug}.md` (or directory)
**On `reviewed` status** — auto-moved to `archive/design/`.

**Do not** sprinkle wireframes into `specs/` or `plans/`. They have a home here.

## `research/` — Model and landscape research briefs

Research that informs routing decisions — model capability briefs, ecosystem
surveys, competitive landscape notes. Admitted to the canonical tree 2026-06-11.

**Naming:** `YYYY-MM-DD-{slug}.md`
**Lifecycle:** briefs carry `status: reference` and are not auto-archived — they
keep ongoing reference value. The directory is optional; it exists only when
research work does.

## `archive/` — Graveyard

Flat, one folder per artifact type. Populated automatically by the SessionEnd archival sweep.

```
archive/
├── specs/
├── plans/
├── handoffs/
└── design/
```

Files keep their original date-prefixed names. No quarterly or yearly subdivision. The archive stays in git — it is the project's long memory.

### `archive/legacy/` — dogfood-only

Because this repo *is* the Fellowship plugin, it carries plugin-development memory that other projects don't need. `archive/legacy/` holds top-level files retired by the project-state-contract sweep (e.g., `research.md`, `reference-implementations.md`, `examples/`, the old `templates/` directory). User projects do not have this directory.

## Top-level files

- **`quest-log.md`** — decisions and commitments that survive across sessions. Updated silently by Gandalf.
- **`quest-log-archive.md`** — overflow from quest-log.md when it exceeds size limits.
- **`product.md`** — what we're building, for whom, why. The ground truth for every dispatch.
- **`codebase-map.md`** — output of `/fellowship:map` (may not exist yet).

## Project-local skills and agents

Projects can extend Fellowship with their own skills and agents under `.claude/` in the project root:

- **`.claude/skills/{skill-name}/SKILL.md`** — project-specific skills
- **`.claude/agents/{agent-name}.md`** — project-specific agents

At session start, the Fellowship hook surveys both directories and surfaces the inventory to Gandalf via a `<PROJECT_LOCAL>` context block. **On name collision, project-local takes precedence over plugin.** If your project has a `planning` skill, the project's version is used.

Use this when the project has patterns the plugin doesn't know about — domain terminology, specific review checklists, dispatch conventions unique to the codebase.

## What is NOT here

The following used to live at the top level but are now plugin-owned or retired:

- **`templates/ethos.md`** — moved to plugin at `skills/using-fellowship/references/ethos.md`. Loaded on demand for Tier 3+ dispatches.
- **`session-log.md`** — retired. Git log records what changed; quest-log records decisions.
- **`research.md`, `reference-implementations.md`, `examples/`** — dogfood-only artifacts from this repo's early days. Archived under `archive/legacy/`.

---

## Who writes where

| Agent / Source | Writes to |
|---|---|
| Aragorn (PRD) | `specs/` |
| Merry (ARD/ADR) | `specs/` |
| Planning skill | `plans/` |
| Arwen (wireframes, design contracts) | `design/` |
| Gandalf (quest log, product.md updates) | top-level files |
| Gimli | code, not docs |
| SessionEnd hook | `archive/{type}/` |

If you are writing something that doesn't fit — stop and ask. Don't invent a new location.
