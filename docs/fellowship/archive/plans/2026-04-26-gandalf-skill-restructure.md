# Plan: Gandalf-as-Skill Restructure (v1.0 blocker fix)

**Date:** 2026-04-26
**Status:** Draft — awaiting user approval before dispatch
**Tier:** 3 (multi-file restructure with verification gate)

## Goal

Resolve the v1.0 blocker (`TodoWrite exists but is not enabled in this context` for main-thread Gandalf) by moving Gandalf from a default-agent override to a SessionStart-injected skill. Consolidate user-facing voice into Gandalf alone. Ship a v1.0 where the live checklist works.

## Decisions Locked (from 2026-04-26 design conversation)

1. `agents/gandalf.md` → `skills/using-fellowship/SKILL.md`. Skill name follows Superpowers' `using-<plugin>` convention.
2. SessionStart hook injects `using-fellowship/SKILL.md` content as `additionalContext` with strong wrapper ("You are Gandalf... inhabit this"), mirroring Superpowers' mechanism.
3. Default-agent override removed. Default agent stays vanilla; the injection makes it Gandalf.
4. Voice rules consolidate to Gandalf. All nine companion files (Gimli, Legolas, Pippin, Boromir, Sam, Aragorn, Merry, Arwen, Bilbo) lose their Tolkien-register sections, gain a one-paragraph character note. Bilbo additionally keeps his writing-style guidance (documentation register, not Tolkien register) — if his character paragraph conflicts with the writing guidance, drop the paragraph; writing skills win.
5. README rewrites to reflect "nine companions, one orchestrator" — Gandalf is not an agent.

## Why This Works

- Default agent has TodoWrite (and every other native tool) by default. Override loses them. Skill-injection preserves them.
- Superpowers proves the pattern: hook-injected skill content drives behavior from message one.
- 95%+ of agent voice is unread (dispatched flow → Gandalf re-voices). The 5% direct-mode case is served by a one-paragraph character note.
- Single source of voice truth = no drift across nine files.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Injection wrapper is too weak — agent treats voice as optional | Use Superpowers' strong-wrapper pattern: "You are Gandalf... inhabit this" |
| SessionStart hook fails silently — user gets vanilla Claude with no Fellowship behavior | Graceful degradation is correct fallback. Add a one-line console message on hook failure for debuggability. |
| Stripping voice from agents loses character in direct mode | Keep one-paragraph character note per agent. Verify direct mode subjectively in fresh session. |
| Settings/manifest references to `agent: fellowship:gandalf` break | Audit `.claude/settings.json`, `plugin.json`, `marketplace.json` for default-agent references. Remove cleanly. |
| Quest-log auto-consolidate hook references `agents/gandalf.md` | Audit hook scripts for hardcoded path references. |
| Bilbo's character/voice section conflicts with new structure | Leave Bilbo untouched. Document the exception in his file's header. |

## File-by-File Work Breakdown

### Create
- `skills/using-fellowship/SKILL.md` — orchestration logic + Gandalf voice. Frontmatter: `name: using-fellowship`, `description: Use when starting any conversation in a Fellowship project — establishes Gandalf as orchestrator, defines voice, routing tiers, memory rules`. Body: adapt from `agents/gandalf.md` minus the agent-frontmatter and `<SUBAGENT-STOP>` block (we want Gandalf active in the main thread, not skipped).

### Modify
- `hooks/session-start` (and `.mjs` if applicable) — extend to read `skills/using-fellowship/SKILL.md` and inject as `additionalContext` with strong wrapper. Pattern from Superpowers' `hooks/session-start`.
- `agents/gimli.md` — strip register section (~80-150 lines), replace with character paragraph. Preserve all craft methodology, tools list, model: inherit, hard rules.
- `agents/legolas.md` — same treatment.
- `agents/pippin.md` — same.
- `agents/boromir.md` — same.
- `agents/sam.md` — same.
- `agents/aragorn.md` — same.
- `agents/merry.md` — same.
- `agents/arwen.md` — same.
- `README.md` — rewrite roster section: "nine companions, one orchestrator. Gandalf is not an agent — he is the orchestration skill loaded by the default agent at session start." Fold in Aragorn pre-publication copy fixes (top-level descriptions, "On First Run" section, validation-gap honesty note).
- `.claude/settings.json` — audit for default-agent setting; remove if present.
- `.claude-plugin/plugin.json` / `marketplace.json` — audit for default-agent references.
- `docs/fellowship/codebase-map.md` (if exists) — refresh roster summary.
- `docs/fellowship/quest-log.md` — already updated with the architectural decision.

### Delete
- `agents/gandalf.md` — content migrates to `skills/using-fellowship/SKILL.md`. Delete only after migration is verified.

### Bilbo (special case)
- `agents/bilbo.md` — strip Tolkien register like the others; preserve writing-style/methodology guidance (documentation register, not character register). Add character paragraph. **If the character paragraph conflicts with his writing-style guidance, drop the character paragraph entirely.** Writing skills always win for Bilbo.

### Untouched
- All other skills, hooks, evals, examples.

## Character Paragraphs (Spec for Gimli)

Each stripped agent gains a single paragraph in place of the register section. Tone: brief, descriptive, not performative. Example:

> **Gimli's flavor.** Gruff, focused on durability. Prefers boring solutions that won't break. Speaks tersely; explains tradeoffs in terms of what fails when. In direct mode, opens with a brief acknowledgment ("on it") and reports outcomes without ceremony.

Gimli will draft these per agent. Voice rules and elaborate examples do not appear here — that work lives once, in `using-fellowship`.

## Order of Operations

1. **Gimli — structural restructure** (background dispatch)
   - Create `skills/using-fellowship/SKILL.md` from `agents/gandalf.md` content.
   - Modify SessionStart hook to inject the skill.
   - Audit and clean default-agent references in settings/manifest.
   - Strip register from 8 agent files; add character paragraphs.
   - Leave `agents/gandalf.md` in place (delete in step 3 after verification).
   - Report DONE with verification instructions.

2. **Fresh-session verification gate** (manual, by user)
   - User starts a fresh `claude` session in the Fellowship project.
   - Confirms: Gandalf voice from msg 1; `TodoWrite` works when Gandalf attempts it; quest log injection still fires; companions still dispatch correctly.
   - If any check fails → SendMessage Gimli with specifics; do not proceed.

3. **Cleanup** (after verification passes)
   - Delete `agents/gandalf.md`.
   - Bilbo dispatched on README rewrite + Aragorn pre-pub copy fixes folded in.
   - Legolas review pass on the structural changes (skill file + hook + agent diffs).
   - Health check passes.

4. **Quest log update + version bump**
   - Move this plan to `plans/archive/`.
   - `marketplace.json` version → `1.0.0`.
   - Tag release.

## Verification Approach

- **Functional:** Fresh session → first message returns Gandalf voice → call `TodoWrite` → confirm acceptance.
- **Structural:** `agents/` contains nine files (Bilbo + eight craftsmen, no Gandalf). `skills/using-fellowship/SKILL.md` exists. Hook injects on session start.
- **Behavioral:** Dispatch Gimli on a small test task; confirm he reports back; confirm Gandalf re-voices the report cleanly.
- **Regression:** Quest log auto-consolidate fires on session end. Codebase map references update. Health check passes.

## Rollback

If verification fails and the cause isn't quickly diagnosable:
- `git checkout` the structural commit.
- `agents/gandalf.md` returns; SessionStart hook reverts; settings revert.
- Fall back to documenting the TodoWrite limitation in README and shipping v1.0 with the quest-log-as-checklist workaround. Gandalf-skill restructure becomes v1.1.

## Out of Scope

- Eval scenario coverage for Boromir/Merry/Aragorn/Arwen/Sam/Bilbo (separate quest, deferred).
- New skill creation or feature additions.
- Bilbo restructure (he stays as-is for v1.0).

## Acceptance Criteria

- [ ] Fresh session shows Gandalf voice from message one.
- [ ] `TodoWrite` succeeds when called by main-thread Gandalf.
- [ ] All nine companions still dispatchable; reports flow back through Gandalf in voice.
- [ ] README accurately states "Gandalf is not an agent."
- [ ] Health check passes 25/0 (or current baseline).
- [ ] No references to `fellowship:gandalf` as a dispatched agent remain in plugin manifest, settings, hooks, or docs.
- [ ] `agents/gandalf.md` deleted; `skills/using-fellowship/SKILL.md` exists with full orchestration content.
