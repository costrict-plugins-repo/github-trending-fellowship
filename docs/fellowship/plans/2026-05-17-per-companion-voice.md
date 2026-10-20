# Plan — Per-Companion Voice Persistence

**Date:** 2026-05-17
**Design spec:** `docs/fellowship/specs/2026-05-17-per-companion-voice-design.md`
**Predecessor:** `docs/fellowship/plans/2026-05-16-voice-persistence.md` (Gandalf v1)

## Goal

Bring LotR-distinct voice persistence to all nine companions (Aragorn, Gimli, Legolas, Merry, Pippin, Boromir, Sam, Arwen, Bilbo). Voice content lives directly in each agent's existing definition file (`agents/{name}.md`) as a structured section. No new infrastructure — Claude Code's existing dispatch process delivers the agent file as the subagent's system prompt at dispatch start. This is the bridge between Gandalf v1 (shipped 2026-05-16) and workflow templates (next thread, gated on this landing).

## Key decisions from brainstorming

- **Voice content lives in agent files directly** — `agents/{name}.md` as a structured `## Voice` section. No separate voice files, no hooks, no build step. Mechanism is Claude Code's existing dispatch process.
- **Slim template, four subsections** — character study, register & vocabulary, anchor exemplars, never-list. ~2000–3000 bytes per voice section.
- **Pilot Aragorn → distill process → batch the remaining eight** — sequential, with each new voice authored against prior voices open for contrast-checking. Convergence to generic-elevated-register is the risk; explicit distinctness is the defense.
- **Priority order from quest log** — Aragorn, Gimli (highest dispatch frequency), then Legolas, Merry, then Pippin, Boromir, Sam, Arwen, Bilbo.
- **Validation is qualitative** — Frodo reads the voice section AND the dispatched probe report after each companion lands. No automated assertions per companion. Mechanism plumbing is already validated by vp003 PASS.
- **No subagent-start hook exists** — `SessionStart`/`UserPromptSubmit` skip subagent contexts per Claude Code's documented lifecycle. The original brainstorm decision to use a SessionStart-equivalent injection was retired mid-flight on this discovery.

## Tech stack

- Markdown editing only. No code changes.
- Each agent file is a markdown file with YAML frontmatter; structure is preserved.
- Companion probe dispatches use the existing Task tool with the actual agent type.

## Tier recommendation

**Tier 1 — direct, in-session.**

This is craft work, not orchestration. Each voice authoring is a focused Frodo+Gandalf dialogue, no subagent dispatch for the writing itself. Subagent dispatches enter only at the validation probe step (Tier 2 for each — one dispatch, one report, one qualitative read).

**Cadence:** roughly one companion per session. Doing more than two voice sections back-to-back risks craft fatigue and voice convergence. Spread across nine sessions over time.

---

## File map

**Modified (in priority order):**
- `agents/aragorn.md` — pilot
- `agents/gimli.md`
- `agents/legolas.md`
- `agents/merry.md`
- `agents/pippin.md`
- `agents/boromir.md`
- `agents/sam.md`
- `agents/arwen.md`
- `agents/bilbo.md`

Each gains a `## Voice` section between the existing character paragraph (post-frontmatter, post-H1) and the role/workflow content. Existing `**{Name}'s character.**` lead paragraph may be folded into the new Character study subsection or kept as the elevator — pilot decides for Aragorn, subsequent companions follow that precedent.

**Created:**
- `docs/fellowship/processes/companion-voice-authoring.md` — process document distilled from the Aragorn pilot, used as the authoring template for the remaining eight.

**Possibly modified (judgment calls during execution):**
- `skills/using-fellowship/references/companions.md` — if cross-cutting voice guidance surfaces, update the companion summary view.
- Memory files — `project-voice-persistence-v1.md` and `project-workflow-templates.md` updated as voices land.
- `docs/fellowship/quest-log.md` — mark the per-companion voice entry done at the end.

---

## Quest Log

### Phase 1 — Pilot Aragorn

1. ⬜ **Author Aragorn voice section** — Frodo + Gandalf, in-session. Hand-write all four subsections (character study, register & vocabulary, anchor exemplars, never-list) into `agents/aragorn.md`. Reference: existing `**Aragorn's character.**` paragraph at line 20; existing role section; LotR canon (book + film) for Aragorn's speaking patterns. ~2000–3000 bytes.
2. ⬜ **Probe dispatch — Aragorn** — Tier 2 dispatch. Send Aragorn on a trivial scoping probe (e.g., "scope this trivial feature request"). Capture his report verbatim.
3. ⬜ **Qualitative review** — Frodo reads the voice section and the probe report. Decision: does this sound like Aragorn? Distinct from Gandalf? In-craft (PM register, not generic-elevated)? Lock or iterate.
4. ⬜ **Lock Aragorn** — once Frodo approves, voice section is final. Commit.

### Phase 2 — Distill process

5. ⬜ **Write `docs/fellowship/processes/companion-voice-authoring.md`** — Frodo + Gandalf, in-session. Document what the Aragorn pilot revealed: which questions surfaced the character study, how vocabulary collisions with Gandalf's cluster were handled, how exemplars were chosen from canon vs. composed. This becomes the writing template for the remaining eight.

### Phase 3 — Batch (sequential, priority order)

Each companion follows the same three-step cycle: author → probe → review/lock. Each new voice is authored with **all prior voices open** for explicit contrast-checking — vocabulary clusters must diverge, anchor exemplars must not echo, never-lists may overlap on the universal Gandalf-shared filler/pleasantries but should add companion-specific anti-patterns.

6. ⬜ **Gimli voice** — author, probe, review/lock. Contrast against Aragorn (both elevated leaders → Gimli must be grounded craftsman, not statesman).
7. ⬜ **Legolas voice** — author, probe, review/lock. Contrast against Aragorn + Gimli (Legolas is reviewer — precise, observational, not a builder or scoper).
8. ⬜ **Merry voice** — author, probe, review/lock. Contrast against prior three (Merry is technical architect — pattern-noticing, structural, not the wisdom register).
9. ⬜ **Pippin voice** — author, probe, review/lock. Contrast against Merry especially (both observers → Pippin must be test-engineer-curious, not architecture-pattern-noticing).
10. ⬜ **Boromir voice** — author, probe, review/lock. Contrast against Aragorn (both elevated → Boromir is security register, harder edge, less hopeful).
11. ⬜ **Sam voice** — author, probe, review/lock. Contrast against Gimli (both grounded craftsmen → Sam is infra/devops-steady, not builder-decisive).
12. ⬜ **Arwen voice** — author, probe, review/lock. Contrast against Legolas (both elegant-observational → Arwen is designer-considered, not reviewer-precise).
13. ⬜ **Bilbo voice** — author, probe, review/lock. Contrast against all prior eight (Bilbo is documentarian — narrative voice, comfortable with retrospect, distinct from any active-craft register).

### Phase 4 — Wrap

14. ⬜ **Update `companions.md` if warranted** — if the contrast-checking surfaced guidance that belongs in the central companion reference (e.g., "Aragorn's `counsel` is reserved; Boromir's `peril` is sharp"), update accordingly. Skip if no cross-cutting guidance emerged.
15. ⬜ **Update memory** — mark `project-voice-persistence-v1.md` complete on the per-companion thread; refresh `project-workflow-templates.md` to note that voice gating is cleared and workflow brainstorm is now actionable.
16. ⬜ **Update quest log** — mark the per-companion voice entry done; cleanly hand off to workflow-templates as the next thread.

---

## Task detail

### Task 1: Author Aragorn voice section

**Assigned to:** Frodo + Gandalf, in-session.
**Depends on:** None — pilot.

**Files:**
- Modify: `agents/aragorn.md`

**What to build:**

A `## Voice` section inserted between the existing `**Aragorn's character.**` paragraph (line 20) and the `---` separator at line 22, containing:

- **Character study** — what moves Aragorn (good craftsmanship, scope discipline), what he refuses (impose decisions on Frodo), what he notices that others miss (the three-month cost of a feature request).
- **Register & vocabulary** — sentence rhythm (measured, weight-at-the-end, like Gandalf but more pragmatic than philosophical), vocabulary cluster (6–8 words: e.g., *scope*, *cost*, *risk*, *deferred*, *contract*, *counsel*, *honor*), contractions in conversation but full forms when locking decisions.
- **Anchor exemplars** — 3–5 quotes drawn from Aragorn's LotR canon speaking lines (the coronation, the parley at the Black Gate, the council scenes), each annotated with what to study from it.
- **Never-list** — does NOT use pleasantries, filler, empty hedges (universal Gandalf-shared); does NOT impose decisions on Frodo (Aragorn-specific — "your call" is the stop point); does NOT relitigate locked decisions.

**Acceptance criteria:**
- [ ] All four subsections present, ~2000–3000 bytes total
- [ ] Vocabulary cluster does not duplicate Gandalf's Tolkien cluster (no `counsel`, `folly`, `prudent`, `peril`, `burden`, `mark`, `haste` as Aragorn's primary words — those are Gandalf's)
- [ ] Existing role content (Scope Read, Locked Decisions, Frodo Counsel) is untouched
- [ ] Existing `**Aragorn's character.**` paragraph either kept as elevator or folded into Character study — decision documented in the process doc afterwards

**Verification:**
- Visual review of the diff before commit. Voice section should read as Aragorn, not Gandalf.

**Notes:**
- Aragorn IS a Frodo-counsellor in canon. His vocabulary will be elevated but its weight is *strategic*, not *philosophical*. Where Gandalf reaches for *peril* and *folly*, Aragorn reaches for *cost* and *scope*.
- The existing line *"Loyalty is not to what Frodo asks but to what Frodo actually needs"* is already proto-voice — the new section deepens this, doesn't replace it.

### Task 2: Probe dispatch — Aragorn

**Assigned to:** Tier 2 dispatch via Task tool, target `fellowship:aragorn`.
**Depends on:** Task 1.

**Files:** None (read-only probe).

**What to build:**

Dispatch Aragorn with a trivial scoping probe — e.g., *"Aragorn, scope this trivial request: add a 'mark as read' button to the notifications panel. Do not write a full PRD; just return your scoping read in your own voice."*

**Acceptance criteria:**
- [ ] Aragorn returns a scoping read
- [ ] The prose carries the voice section's register (Frodo's qualitative read)

**Verification:**
- Read the report. The vocabulary cluster appears; the rhythm matches the exemplars; no Gandalf-vocabulary bleed; no filler/pleasantries.

**Notes:**
- This is the only Tier 2 work in the plan. Everything else is in-session authoring.

### Task 3: Qualitative review

**Assigned to:** Frodo.
**Depends on:** Task 2.

**Acceptance criteria:**
- Either: voice section is locked (matches Aragorn, distinct from Gandalf, in-craft).
- Or: revisions identified, Task 1 re-opened with specific edits.

**Notes:**
- The bar is *recognisable LotR Aragorn*, not perfect canon adherence. Voice studies for v1 prioritize distinctness and in-character feel over scholarly accuracy.

### Task 4: Lock Aragorn

**Assigned to:** Frodo + Gandalf.
**Depends on:** Task 3.

**Acceptance criteria:**
- [ ] `agents/aragorn.md` committed with the voice section.
- [ ] Commit message references the spec: `feat: aragorn voice section (per-companion voice work, see spec 2026-05-17)`

### Task 5: Write companion-voice-authoring.md

**Assigned to:** Frodo + Gandalf, in-session.
**Depends on:** Tasks 1–4.

**Files:**
- Create: `docs/fellowship/processes/companion-voice-authoring.md`

**What to build:**

A process document distilled from the Aragorn pilot. Sections:
- The four-subsection template (character, register & vocabulary, anchors, never-list) with prompt questions for each.
- Vocabulary-collision avoidance (Gandalf's cluster is reserved; companion clusters must diverge).
- Anchor-exemplar sourcing (canon-first; in-character composition when canon is thin).
- Never-list pattern (universal anti-patterns + companion-specific additions).
- Contrast-checking ritual: open prior voices side-by-side; identify shared register dimensions; ensure each new voice sits in its own corner.

**Acceptance criteria:**
- [ ] Document is short (<3 KB) and actionable — a writer's checklist, not a treatise.
- [ ] Captures the specific judgment calls made during Aragorn pilot (Character section folding, vocabulary picks, exemplar sources).

### Tasks 6–13: Batch the remaining eight

Each task is structured identically to Tasks 1–4 (author → probe → review → lock), with the addition that *all prior voices are opened during authoring* for contrast-checking. The companion-voice-authoring.md process document is the template; the contrast pairs noted in the quest log entries are the explicit watch-list for each.

**Per-task acceptance criteria (applies to each of 6–13):**
- [ ] Voice section authored to slim-template structure.
- [ ] Vocabulary cluster diverges from all prior voices (no shared signature words).
- [ ] Anchor exemplars do not echo prior voices' rhythm or vocabulary.
- [ ] Probe dispatch returns a recognisable in-character report (Frodo's read).
- [ ] Commit before moving to the next companion.

### Task 14: Update companions.md (judgment call)

**Assigned to:** Frodo + Gandalf.
**Depends on:** Tasks 6–13.

**Acceptance criteria:**
- If cross-cutting guidance surfaced during batch authoring — update the companion summary. Otherwise skip.

### Task 15: Update memory

**Assigned to:** Gandalf.
**Depends on:** Tasks 1–14.

**Files:**
- Modify: `~/.claude/projects/-Users-Karolus-projects-Fellowship/memory/project_voice_persistence_v1.md`
- Modify: `~/.claude/projects/-Users-Karolus-projects-Fellowship/memory/project_workflow_templates.md`

**Acceptance criteria:**
- [ ] Voice persistence memory notes the per-companion thread complete.
- [ ] Workflow-templates memory notes that voice gating is cleared and the brainstorm is the next actionable thread.

### Task 16: Update quest log

**Assigned to:** Gandalf.
**Depends on:** Task 15.

**Files:**
- Modify: `docs/fellowship/quest-log.md`

**Acceptance criteria:**
- [ ] Per-companion voice entry marked closed.
- [ ] Workflow-templates entry retained; its predecessor (voice work) is no longer blocking.

---

## Execution notes

- **Sessions over single-sit.** The brainstorming skill and the spec both call out craft fatigue and voice convergence as risks of doing all nine in one session. Plan for one companion per session, two at most.
- **Order is load-bearing.** The priority order matters for contrast-checking — Aragorn first establishes the "elevated leader" corner; Gimli second establishes the "grounded craftsman" corner; later voices position themselves relative to those anchors. Reordering the batch risks the corners not being staked when they're needed.
- **Pilot first, then batch.** Do not start Gimli before Aragorn's pilot is locked AND the process doc is written. The process doc IS the deliverable that makes batching possible at quality.
- **Probe dispatches use real companions.** Each probe is a live Task-tool dispatch against the agent file just edited. If a probe fails — voice doesn't carry — that is signal about the voice content, not the mechanism (mechanism = Claude Code's dispatch process, validated by every existing companion dispatch).

## Risks

- **Vocabulary collision pressure.** Tolkien vocabulary has finite cluster space. Some words (*counsel*, *peril*, *prudent*) are Gandalf's; others (*mark*, *burden*, *haste*) are shared across multiple characters in canon. By the seventh or eighth voice, the writer is reaching for words and the unclaimed corners shrink. Mitigation: claim vocabulary deliberately, accept that later companions may need composed-not-canon words.
- **Role-voice conflict in existing prose.** Pippin's agent file is 16KB with long technical paragraphs. The voice section may say "Pippin asks short questions" while the role section is written long. Resolution will require editorial sweeps to the role content too, not just adding a voice section. Budget for this on Pippin specifically.
- **Workflow-templates re-pressure.** If after three or four companion voices the user wants to go back to workflows, that is a valid pivot — voice work is not all-or-nothing. The plan can be paused after any locked companion; subsequent voices land later. Decision held with Frodo throughout.
