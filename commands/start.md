---
name: fellowship:start
description: Bootstrap Fellowship in this project — create docs/fellowship/ scaffolding, quest log, and product context.
---

# Start Fellowship

You are bootstrapping the Fellowship in this project. The plugin is installed but `docs/fellowship/` does not yet exist (or is incomplete). Walk the user through the bootstrap routine defined in `skills/using-fellowship/SKILL.md` (Bootstrap section) and the canonical project tree defined in `docs/fellowship/specs/2026-05-15-project-state-contract.md` (or the plugin equivalent).

## What to do

1. **Create the directory scaffold under `docs/fellowship/`:**

   Active artifact directories:
   - `specs/`
   - `plans/`
   - `handoffs/`
   - `design/`

   Archive directories (one per artifact type — flat, no quarterly subdivision):
   - `archive/specs/`
   - `archive/plans/`
   - `archive/handoffs/`
   - `archive/design/`

   For any directory that would otherwise be empty at bootstrap, write a `.gitkeep` file so the directory survives the first commit.

   Top-level files:
   - `quest-log.md`
   - `quest-log-archive.md`
   - `product.md`
   - `README.md` (the directory guide)

   **Do not create:**
   - `templates/` (any flavor) — ethos and plugin templates live in the plugin, not the project
   - `session-log.md` — retired

2. **Initialize `quest-log.md`** with:

   ```markdown
   # Quest Log

   **Last updated:** YYYY-MM-DD

   ## Open

   Decisions and commitments that survive across sessions. One line per entry, dated.
   ```

3. **Initialize `quest-log-archive.md`** with a one-line stub:

   ```markdown
   # Quest Log Archive

   Older entries from `quest-log.md` land here when the active log exceeds its size limit. Managed by the SessionEnd sweep.
   ```

4. **Initialize `product.md`** with the product context template, then ask the user: *"What are we building, and who is it for?"* — fill from their answer. Foundation precedes brainstorming and planning.

5. **Write `docs/fellowship/README.md`** — the directory guide. Mirror the canonical tree (specs, plans, handoffs, design, archive subdirs, top-level files). Note that ethos is plugin-owned and `session-log.md` is retired. Use the plugin's own `docs/fellowship/README.md` as the reference shape.

6. **Offer the codebase map.** Once product.md is filled, ask: *"Want me to generate the codebase map now? It takes a couple of minutes and every Tier 3+ dispatch leans on it."* If yes, run `/fellowship:map`. If no, leave it for later — the SessionStart hook will surface a staleness signal when the map starts to drift.

7. **Open in voice.** Brief, grounded, with a question that reflects you've been paying attention — not a generic offer to help.

## Guardrails

- If `docs/fellowship/` already exists with content, do not overwrite. Report what exists and ask before adding missing pieces.
- Do not skip the product.md question. A session without product context is a quest without a map.
- Do not dispatch any companion until product.md is filled.
- Do not create any directory or file not named in the scaffold list above. The canonical tree is closed — additions are drift.
