---
name: voice-persistence-spec
status: active
created: 2026-05-16
type: design-spec
implementer: Gimli (mechanism), Bilbo (voice.md compression pass)
companion: Sam (hook wiring review)
---

# Voice Persistence — Design Spec

How Gandalf's voice survives long main-agent conversations in Claude Code. Companion to `2026-05-15-voice-persistence-research.md` (the research brief that mapped Caveman, native Claude Code mechanisms, and the persona-drift literature).

## Problem

The voice reference at `skills/using-fellowship/references/voice.md` defines Gandalf's register in detail — exemplars, vocabulary, anti-patterns, hard rules. In practice, the voice does not reliably hold across long main-agent sessions. Default Claude register reasserts within 8–12 turns (consistent with Li et al., *Measuring and Controlling Persona Drift*).

The diagnosed root cause is mechanical, not content. The skill currently *instructs the model* to read voice.md at session start. There is no hook that forces the file into context. The model may or may not invoke Read; even when it does, the content sits in the cached prefix and decays under attention pressure as new turns arrive.

## Decision

Adopt a two-layer reinforcement mechanism modelled on the Caveman plugin pattern, tuned for Gandalf's register. Skip the Output Style layer for v1 (undocumented marginal contribution). *(2026-06-11: the mechanism is single-layer now — Layer 2 was removed after the vp001 evals showed the per-turn anchor cannot push past the additive-prompting ceiling; Layer 1 below is the sole live mechanism, and the Layer 2 section is preserved as design history.)*

### Layer 1 — SessionStart hook (full ruleset injection)

A `SessionStart` hook reads `skills/using-fellowship/references/voice.md` from disk and writes its contents to stdout. Per Claude Code's hook contract, SessionStart stdout is added to the main agent's context automatically — this is the same mechanism Caveman uses for its full ruleset injection.

**Why this is necessary:** without this, the per-turn anchor (Layer 2) is reinforcing content the model may have never seen. Layer 1 guarantees the voice content enters context every session.

**Hook location:** `hooks/fellowship-voice-session-start.mjs` (new file, mirrors the existing `hooks/fellowship-session-end.mjs` naming).

**Hook contract:**
- Reads voice.md from disk relative to plugin root.
- Writes contents to stdout, prefixed with a short framing line (e.g. `# Gandalf Voice — Active Throughout This Conversation`) so the injection is identifiable in any trace logs.
- Fail-silent: if voice.md cannot be read, the hook exits 0 and writes nothing. The session continues without voice reinforcement rather than failing.
- Subagent-aware: bails (exits 0 without output) when running in subagent context. See "Companion-aware behavior" below.

### Layer 2 — UserPromptSubmit hook (per-turn anchor)

> **Removed 2026-06-11.** The vp001 evals showed the per-turn anchor cannot push past the additive-prompting ceiling (2/3 regardless of anchor formulation), so its ~90 tokens per user message bought nothing. The hook was unregistered and deleted; Layer 1 (SessionStart injection) is the sole voice layer. Drift on very long sessions is accepted. The section below is preserved as design history.

A `UserPromptSubmit` hook injects a fixed ~295-character anchor as `additionalContext` on every user message. Per Caveman's empirically-validated pattern and the persona-drift literature, this is the single highest-leverage mitigation against attention decay.

**Anchor text (verbatim):**

```
GANDALF VOICE ACTIVE. Speak in this register: "Even the very wise cannot see all ends." "When in doubt, follow your nose." "Gimli next — this is builder's work." A clause of context, then the sentence lands short. Counsel, folly, mark, prudent, peril, burden — words that do the work.
```

**Rationale for the exact text:**
- **Identity token (`GANDALF VOICE ACTIVE`)** — Caveman's anchor-phrase pattern. A distinctive label the model latches onto under load.
- **Imperative framing (`Speak in this register`)** — makes the exemplars the target, not decoration.
- **Three exemplars, three Gandalf modes:**
  - *"Even the very wise cannot see all ends."* — wisdom-limitation, unhurried register, canonical Tolkien quote.
  - *"When in doubt, follow your nose."* — decisive counsel, short and final; shows the model that *certain direction* is also Gandalf, not just wisdom-hedge. Canonical Tolkien quote.
  - *"Gimli next — this is builder's work."* — workflow-routing, decisive (no `unless you see it differently` abdication); aligned with workflow-template autonomy goal.
- **Rhythm cue (`A clause of context, then the sentence lands short`)** — the one structural rule worth stating explicitly; the three exemplars also demonstrate it by example.
- **Vocabulary cluster** — six words, framed as functional (`words that do the work`), not ornamental.
- **No anti-patterns in the anchor.** Pink-elephant problem. Anti-patterns belong in Layer 1 only.

**Hook location:** `hooks/fellowship-voice-prompt-submit.mjs` (new file).

**Hook contract:**
- Emits JSON: `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "<anchor text>"}}`
- No flag-file check (voice is always-on per Frodo's decision).
- Subagent-aware: bails for subagent context.
- Default timeout 30 seconds (UserPromptSubmit hot-path limit); implementation must complete in <100ms.

### Layer 3 — Output Style — NOT in v1

Anthropic's Output Style docs claim "built-in adherence reminders" but the mechanism is uncharacterized. Adding it alongside Layers 1 and 2 would consume prompt budget for undocumented marginal contribution. Revisit only if Layers 1 and 2 prove insufficient in live use.

---

## Voice.md compression pass

Voice.md ships in every session via Layer 1. Token cost is paid once per session but accumulates across the project lifetime. Compress, but with strict guardrails.

**Target:** ~10.5 KB → ~7.25 KB (~31% reduction). The brainstorm estimated the source at ~5 KB; actual was 10.5 KB. After applying the protect rules below (all exemplars + LotR character framing + hard rules + vocabulary cluster), the floor is ~6.5–7 KB. The original 3.5–4 KB target was unreachable without cutting protected content. Bilbo's compression pass landed at 7250 bytes (2026-05-16).

**Cut:**
- Meta-framing (`Read once at session start. Internalize, then speak that way every turn.`) — the hook is reading the file for the model; the instructions become obsolete and slightly misleading.
- Explanatory tags after exemplars where the exemplar speaks for itself (e.g. `← formal subject, principle, verdict. The structure for naming a mistake.` can collapse to a one-clause tag or be dropped).
- Structural redundancy across sections.

**Protect (do not cut):**
- Every Tolkien exemplar (lines 46–58).
- Every software-applied exemplar (lines 62–71).
- Every "thinking aloud" pattern exemplar (lines 73–87).
- Every "You do not sound like this" counter-example (lines 89–97).
- The vocabulary cluster (line 30).
- The hard rules (lines 99–104).
- LotR character framing — the metaphor patterns (`bridges, foundations, weather, craftsmanship`), the personality prose (`you notice more than you say`, `urgency exists but panic doesn't`). These shape the *feel* even though they are not exemplars. The user explicitly flagged this as a guardrail: *"the tone and the inspiration must be highly inspired by Lord of the Rings."*

### Caveman cut-list addition

Voice.md currently forbids five phrases (`sounds like`, `makes sense`, `that's fair`, `totally`, `looks good`). This list is too short. Default Claude register includes a wider filler/pleasantry/hedge inventory that voice.md does not name. Extending the "Never:" section, Caveman-style:

- **Filler words:** *just, really, basically, actually, simply, literally, definitely, certainly, essentially.*
- **Pleasantries:** *great question, happy to help, sure thing, no problem, absolutely, of course.*
- **Empty hedges:** *I think* (when not load-bearing), *I believe*, *it seems like*, *sort of, kind of*, *I'd say*.
- **Trailing fluff:** *at the end of the day, to wrap up, in summary, hope this helps, let me know.*

This is enrichment in the SessionStart slot, where the pink-elephant problem is bounded (paid once per session, not per-turn). The cut-list earns its tokens by giving the model a closed set of register tells to suppress.

### What NOT to bring from Caveman

- **Fragments-as-default.** Caveman drops to fragments routinely. Gandalf's sentences *gather a clause of context, then land short*. Pure fragments would wreck the rhythm.
- **Dropped articles.** *He that breaks a thing* collapses without the article. Formal register requires them.
- **Intensity modes** (ultra/medium/light). Gandalf has one register, calibrated to the moment by the model's own reading of context.
- **"Code/commits write normal" framing.** Already covered by Gandalf's hard rule — *voice colors conversation, never artifacts.*

---

## Companion-aware behavior

### Subagent dispatch (true Tier 3+) — voice suspends

When a Fellowship companion is dispatched as a subagent (Aragorn, Merry, Gimli, Legolas, Pippin, Boromir, Sam, Arwen, Bilbo), that subagent has its own voice (per its agent file). Gandalf's voice hooks must not inject into the subagent's context.

**Detection mechanism:** to be confirmed during implementation. Likely paths:
- `CLAUDE_SUBAGENT_TYPE` or equivalent env var, if Claude Code sets one for subagent processes.
- Hook input payload — SessionStart and UserPromptSubmit hooks receive structured input; subagent context may be indicated there.
- Worst case: a sentinel file written by the dispatching parent before subagent invocation, removed after. Likely unnecessary.

Gimli investigates during implementation; the spec commits to the *behavior* (suspend) and leaves the *mechanism* to discovery.

The existing `<SUBAGENT-STOP>` block in `skills/using-fellowship/SKILL.md` is a model-level instruction; the hook gate is the mechanical backstop.

### In-session skill loading (Tier 2) — voice stays Gandalf

When the user loads a companion skill in-session (`/fellowship:merry`, `/fellowship:legolas`, etc.), the main-thread speaker is still Gandalf — only the companion's *craft* loads. Voice hooks continue to fire. No change.

### Artifact mode — voice rule already handles it

Plans, specs, code, structured outputs stay clean and clear per the existing hard rule. The hooks still fire (they shape the surrounding conversation), but the artifact-exemption rule in voice.md tells the model not to bleed voice into the artifact itself. No mechanical gate needed.

---

## Scope

### v1 — Gandalf only

Ships everything above for the main-thread Gandalf voice. Validates the mechanism on the highest-traffic voice before extending.

### v1.1 — per-companion voice persistence (deferred, listed in quest log)

Once v1 proves itself in live use, extend the same two-layer mechanism to each companion subagent:
- Each companion gets its own `references/voice.md` (or equivalent) at `agents/<name>/references/voice.md`.
- Each companion needs an LotR-distinct character study, vocabulary cluster, anchor exemplars.
- The SessionStart and UserPromptSubmit hooks gain companion-aware branches that inject the appropriate voice based on detected subagent type.
- Companions to prioritize: Aragorn and Gimli (highest dispatch frequency), followed by Legolas, Merry, then the rest.

This is genuinely additive labour — not a copy-paste of Gandalf with the name swapped. Each character study is voice-design work in its own right.

---

## Out of scope (do not do as part of this work)

- **Output Style integration.** Deferred. Revisit only if v1 proves insufficient.
- **Kill switch / deactivation phrases.** Frodo's decision: voice is always-on.
- **Voice drift detection / post-hoc correction.** No empirical support for plugin-accessible style classifiers. Stay additive.
- **Forbidden-phrase regex in output filter.** Same reasoning as above. Caveman does not do this either.
- **Per-companion voices.** v1.1 — quest-log entry.

---

## Implementation tasks (for Gimli)

1. **Write `hooks/fellowship-voice-session-start.mjs`** — reads `skills/using-fellowship/references/voice.md`, writes to stdout, fail-silent, subagent-aware.
2. **Write `hooks/fellowship-voice-prompt-submit.mjs`** — emits the fixed anchor JSON, subagent-aware, <100ms execution.
3. **Wire both hooks in `.claude-plugin/plugin.json`** — declare `SessionStart` and `UserPromptSubmit` events with `${CLAUDE_PLUGIN_ROOT}` paths.
4. **Determine subagent-detection mechanism** — investigate env vars / hook input payloads; document in `hooks/README.md` for v1.1 reference.
5. **Compress voice.md** (Bilbo's pass) — apply the cut/protect rules above. Target ~3.5–4 KB after Caveman cut-list addition.
6. **Extend voice.md "Never:" section** with the Caveman-style cut-list (filler / pleasantries / empty hedges / trailing fluff).
7. **Remove the "Read once at session start" instruction line** from voice.md — the hook makes it obsolete.
8. **Update `skills/using-fellowship/SKILL.md`** — the existing line *"Voice register, anchors, applied examples, and anti-patterns: see `references/voice.md`. Read once at session start; do not re-read between turns."* needs adjusting to reflect that the hook injects the content, not the model.
9. **Pippin** — write evals/scenarios that exercise voice persistence across 10+ turn conversations. Specific assertions: presence of vocabulary cluster words, absence of forbidden phrases, exemplar rhythm in non-artifact prose.
10. **Quest-log update** — Frodo or Bilbo adds v1.1 follow-on entry: *per-companion voice persistence*.

---

## Open questions for implementation

- **Subagent-detection mechanism.** Listed under Implementation task 4. The spec commits to *behavior*; implementation discovers the *mechanism*.
- **Token cost in practice.** Revised estimate after Bilbo's compression: ~1800 tokens per session (Layer 1, 7250 bytes ÷ ~4 chars/token) + ~75 tokens × turns (Layer 2, 284-char anchor). At 50 turns, ~5550 tokens of pure persistence cost. Acceptable within typical session budgets but worth measuring against real conversations.
- **Compaction behavior.** When Claude Code compacts the conversation, the Layer 1 injection may be summarized away. Layer 2 keeps firing, so the anchor persists — but the full ruleset may degrade. The exemplar-led anchor in Layer 2 is designed partly to survive this case. Worth observing in live use; possible v1.1 mitigation: re-fire SessionStart on compaction events if such a hook exists.

---

## Success criteria

Voice persistence is working when:

1. Gandalf's register is recognizable from the *first* response in a session, not just after a clarifying turn.
2. Across a 20+ turn conversation, the model does not drift into default Claude register (no `great question`, no `I went ahead and`, no `that's fair`).
3. The exemplar rhythm — *clause of context, then the sentence lands short* — appears in casual exchange, not only in weighted moments.
4. Vocabulary cluster words (*counsel, folly, mark, prudent, peril, burden*) appear naturally where they fit, not forced.
5. Subagents (when v1.1 lands) speak in their own LotR-distinct register, not Gandalf's.

Failure modes to watch for:
- **Voice without weight.** Gandalf vocabulary deployed as costume, not as the words that do the work. ("Hark! Let us venture forth...")
- **Drift after compaction.** Voice holds for 20 turns, then collapses post-compact.
- **Bleed into artifacts.** Voice colors a spec or plan or commit message. The hard rule should prevent this; if it doesn't, the rule needs strengthening, not the hook.

---

---

## v1 eval results (2026-05-16, after two iteration cycles)

Run via `evals/voice-persistence/run.mjs` against `claude-sonnet-4-6`. Mechanism unchanged across both iterations; content (voice.md + anchor) iterated.

**Final state after iteration 2:**

```
vp001 (10-turn recognizability):       2/3  FAIL no_forbidden_phrases (mechanism bound)
                                            PASS vocabulary_at_least_one
                                            PASS exemplar_rhythm_at_least_one
vp002 (20-turn drift resistance):      1/1  PASS no_drift (first=0.100, second=0.100, tol=0.05)
vp003 (subagent isolation):            manual walkthrough — run before commit
vp004 (artifact-mode):                 1/1  PASS prose has voice, artifacts clean

Total: 4/5 automated assertions pass. Improvement from initial Haiku baseline of 2/5.
```

**Iteration 1 → 2 progression:**

| Scenario | Initial Sonnet | After iter 2 | Change |
| --- | --- | --- | --- |
| vp001 | 2/3 | 2/3 | unchanged (at bound) |
| vp002 | 1/1 | 1/1 | held |
| vp004 | 0/1 | 1/1 | fixed via voice.md hard-rule rewording |

**Headline:** Layer 2 anchor empirically suppresses attention decay across 20 turns (vp002). The principal claim of this spec holds on Sonnet. Artifact-mode behavior holds after rewording. Filler suppression hits an empirical bound.

**vp001 — the empirical bound on filler suppression.**

Three anchor variations measured:
1. Original positive-only (*"words that do the work"*) — initial Sonnet run leaked *actually, i think, kind of*.
2. Named-words contrast (*"not just, really, actually, makes sense, great question"*) — leaked *actually, i think, kind of*.
3. Category-only contrast (*"No filler, no pleasantry, no empty hedge"*) — leaked *actually, i think, just*.

Same count across all three; *actually* and *i think* appeared in all three. Pink-elephant is NOT the dominant factor — removing the explicit forbidden-word list did not reduce leakage. This is consistent with the persona-drift literature: high-prior tokens cannot be fully suppressed by additive prompting alone. Model-side levers (split-softmax, CFG, RLHF) would be required to push past this bound; none are available to plugin authors.

The spec retains the strict eval assertion (*"zero forbidden phrases in 10 turns"*) as a north star for future content work. Loosening the test post-hoc would lose the ability to measure whether v1.1 content iterations actually help. Better an honest failing test than a quietly passing one with shifted thresholds.

**Anchor reverted to original positive-only phrasing.** The data showed no metric benefit from the contrast tail; positive framing is more Gandalf-coherent. The Never-list at recency position in voice.md (moved 2026-05-16) is the suppression lever; the anchor's job is register reinforcement.

**What this means for v1 ship:**

The mechanism works. Drift mitigation, register presence, vocabulary, rhythm, and artifact-mode all hold empirically. The one persistent gap is bounded and named. Real validation is live use on Opus 4.7 (the user's main-thread model) — the synthetic Sonnet harness cannot tell us how the voice *feels* in practice. v1.1 content iteration is queued for after live-use sample size accrues.

---

## References

- Research brief: `docs/fellowship/specs/2026-05-15-voice-persistence-research.md`
- Voice reference (will be compressed): `skills/using-fellowship/references/voice.md`
- Using-fellowship skill (will be updated): `skills/using-fellowship/SKILL.md`
- Caveman plugin (mechanism source): https://github.com/JuliusBrussee/caveman
- Persona drift literature: Li et al., arXiv:2402.10962
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
