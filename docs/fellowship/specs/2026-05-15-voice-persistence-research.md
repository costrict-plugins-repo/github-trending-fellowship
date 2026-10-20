---
name: voice-persistence-research
status: active
created: 2026-05-15
type: research
---

# Voice Persistence — Research Brief

Scope: how non-default character voice can be made to survive long main-agent threads in Claude Code. Strictly observational — no Fellowship design proposals.

## Caveman's actual mechanism

Caveman ships its voice through **two hooks declared in `.claude-plugin/plugin.json`** plus a shared flag file. The skill text in `skills/caveman/SKILL.md` is the *content*; the hooks are what make that content stick.

**`src/hooks/caveman-activate.js` — `SessionStart` hook.** Runs once per session. Three jobs: (1) writes the active mode to a flag file at `$CLAUDE_CONFIG_DIR/.caveman-active` via a symlink-safe writer (`safeWriteFlag`); (2) emits the full caveman ruleset to stdout — and per Claude Code's hook contract, *"For UserPromptSubmit, UserPromptExpansion, and SessionStart hooks, anything you write to stdout is added to Claude's context"* — so the entire ruleset arrives as system context, invisible to the user; (3) checks statusline config. The injected text instructs persistence directly: *"ACTIVE EVERY RESPONSE. No revert after many turns... Off only: 'stop caveman' / 'normal mode'."*

**`src/hooks/caveman-mode-tracker.js` — `UserPromptSubmit` hook.** Runs on **every** user message. Three responsibilities: slash-command activation (`/caveman ultra` etc.), natural-language activation/deactivation phrases, and — the relevant one — **per-turn reinforcement**. When the flag is set and the mode is not in `INDEPENDENT_MODES` (commit/review/compress), the hook prints:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "CAVEMAN MODE ACTIVE (mode). Drop articles/filler/pleasantries/hedging. Fragments OK. Code/commits/security: write normal."
  }
}
```

That string is injected as a **system reminder alongside the user's prompt on every turn**. The author's stated rationale: keep caveman *"visible in the model's attention on every user message"* — explicit awareness that the initial SessionStart injection alone drifts when other plugins inject competing instructions mid-conversation.

**No PostMessage gate, no forbidden-phrase regex, no output filter.** Enforcement is purely additive prompting: one large injection at session start, one short reminder every turn, both keyed on the flag file. The intensity-level text in SKILL.md does state hard rules ("Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries") but nothing checks the output.

**Files that matter:**
- `.claude-plugin/plugin.json` — declares the two hooks with `${CLAUDE_PLUGIN_ROOT}` paths
- `src/hooks/caveman-activate.js` (6.2 KB) — SessionStart, full ruleset to stdout
- `src/hooks/caveman-mode-tracker.js` (5.8 KB) — UserPromptSubmit, per-turn `additionalContext`
- `src/hooks/caveman-config.js` (10 KB) — `safeWriteFlag`, mode whitelist, symlink guards
- `skills/caveman/SKILL.md` (3.9 KB) — the rule text the activate hook filters and emits

## Claude Code main-agent voice — official guidance

Claude Code offers four mechanisms that touch main-agent voice. Each has a different lifecycle and a different relationship to "every turn."

**Output Styles (`/output-style`, `.claude/output-styles/*.md`)** — the canonical, voice-shaped feature. From the official docs: *"Output styles directly modify Claude Code's system prompt... All output styles trigger reminders for Claude to adhere to the output style instructions during the conversation."* That second clause is the only documented per-turn reinforcement Claude Code provides natively, though its internals are not specified. Frontmatter supports `keep-coding-instructions: true|false` and `force-for-plugin: true`, which makes a plugin's output style activate automatically and override the user's selection. Stored in `~/.claude/output-styles` (user), `.claude/output-styles` (project), or `output-styles/` at a plugin root. Critically: *"Because the output style is set in the system prompt at session start, changes take effect the next time you start a new session. This keeps the system prompt stable throughout a conversation so prompt caching can reduce latency and cost."* So the style is **stable, cached system-prompt text** — not re-injected per turn at the application layer, but the docs claim built-in reminders during the conversation.

**Hooks — `SessionStart` and `UserPromptSubmit` (the two Caveman uses).** Both can inject text into the main agent's context. `SessionStart` fires once; `UserPromptSubmit` fires every user message and supports `additionalContext`, *"injected as a system reminder that Claude reads as plain text"*. The hooks reference explicitly states: *"Text returned via `additionalContext` is kept from every hook and passed to Claude together."* Default timeout for `UserPromptSubmit` is 30 seconds (shorter than other hooks) — Anthropic acknowledges it runs on the hot path. Hooks cannot modify model output, cannot replace the user prompt (an open issue, #53330, requests `replaceUserMessage`), and cannot force a regeneration. Cap on injected text: **10,000 characters per hook output**.

**CLAUDE.md.** The docs are explicit on what it is and isn't: *"CLAUDE.md adds a user message after the system prompt"* — not modification of the system prompt, but a separate user-role message at session start. Persistent for the session, not re-injected per turn. Loaded once. The official comparison table places it as the "always know your project conventions" lane and routes voice work to Output Styles instead.

**System prompts.** `--append-system-prompt` exists for one-off additions to a single invocation. Plugins do not get a hook into the assembled system prompt other than via Output Styles. Dan Breunig's reverse-engineered map of Claude Code's system-prompt assembly confirms Output Styles enter as a conditional component in the "Communication / Tone / Output Efficiency" segment; MCP server instructions are *"Recomputed every turn (not cached)"*, but Output Styles are not in the per-turn recomputation list.

**Prompt caching tradeoff.** Anthropic's own justification for keeping output styles session-stable is cache hit rate. Any mechanism that injects fresh per-turn text *after* the cached prefix (which is exactly what `UserPromptSubmit` `additionalContext` does — it lands with the user message, not in the system prefix) costs nothing in cache invalidation, but adds input tokens proportional to (injection length) × (turns). Caveman's per-turn reminder is ~150 characters; at 100 turns that is ~15 KB of input tokens spent purely on persistence.

**No documented field labeled "voice," "character," or "persona."** Output Styles are the only feature documented with the word "persona" attached, and even there it is community framing — the official docs call them *"role, tone, and output format."*

## Prior art — voice-persistent plugins/agents

The honest finding: **almost no public plugin solves the long-thread main-agent voice persistence problem.** The vast majority of "persona" plugins ship one prompt and hope.

**`schmitthub/claude-code-personas`** — slash-command file in `commands/*.md`. The Captain Barbossa file is 17.5 KB of single-shot prompt invoked via `/personas:barbossa`. No hook, no output style, no re-injection. The README's own description: *"Each persona will stick around for the rest of your conversation"* — wishful, not enforced. This is exactly the Fellowship's current failure mode.

**`alirezarezvani/claude-skills` (personas/)** — startup-cto, growth-marketer, etc. Documented as skills with "Identity & Memory" sections, activated by user typing "Activate startup-cto mode." No per-turn injection mechanism. Role embodiment via skill text only.

**`SuperClaude-Org/SuperClaude_Framework`** — 16 "cognitive personas." Auto-activation is, per its own docs, *"behavioral instructions in context files... when documentation says agents 'auto-activate', it means Claude Code reads instructions to engage specific domain expertise based on keywords."* Enforcement is via subagent dispatch and post-hoc validators (`validate_kiss.py`, `validate_solid.py`, `validate_purity.py`) — code-quality checks, not voice checks. The personas themselves are static prompt files.

**`hesreallyhim/awesome-claude-code-output-styles-that-i-really-like`** — curated output styles. Tabloid Journalist, Zen Master, Haiku Helper, Existentialist Poet, Door-to-Door Vim Salesman. All rely solely on the Output Style mechanism — i.e., the system-prompt modification + built-in adherence reminders Anthropic ships. None layer hooks on top. None are documented as battle-tested over long orchestrator-style threads.

**`takechanman1228/claude-persona`** — generates *panels* of persona agents for synthetic user research. Each persona runs as a separate agent, not the main thread. Not applicable.

**Caveman is the outlier.** It is the only public plugin found that combines the Output-Style-equivalent (SessionStart stdout) with explicit `UserPromptSubmit` per-turn reinforcement of style. The author writes the rationale into the source comments — competing plugin instructions arriving mid-conversation will displace style if you do not push it back.

## Attention decay — what is known

Persona/instruction decay over long contexts is documented in both academic and practitioner sources, and the cause is mechanically understood.

**Mechanical cause.** Two stacking effects. (1) **Lost-in-the-middle** (Liu et al., 2024, TACL): tokens at the start and end of context receive disproportionate attention; middle tokens get progressively less. The accuracy curve on long-context QA is U-shaped, with 30%+ degradation when target content sits at position 10 of 20. The cause traces to Rotary Position Embedding decay in the attention dot product. (2) **Persona drift specifically** (Li et al., *Measuring and Controlling Persona Drift*, arXiv:2402.10962): in LLaMA2-chat-70B, persona consistency *"degraded by more than 30% after just 8–12 dialogue turns."* They observe *"sharp drops in attention between turns and rough plateaus within turns"* — i.e., each new user turn pulls the model's attention away from the system prompt as a step function, not gradually.

**Counters with empirical support.**

- **System Prompt Repetition (SPR).** Re-inject the system prompt with some probability p before each user utterance. Most effective intervention at high turn counts. Tradeoff explicitly named: *"system prompt repetition consumes a substantial portion of the context window."* Caveman's `UserPromptSubmit` reminder is the lightweight version of this — short reminder, not full re-injection.
- **Split-softmax.** Decoder-side intervention rescaling attention weights to system-prompt tokens via a power law. More efficient than SPR at low turn counts; equal stability at high turn counts. Not available to plugin authors — requires model-internal access.
- **Classifier-Free Guidance (CFG) in logit space.** Double-pass decoding contrasting with-prompt and without-prompt logits. Also model-internal.
- **Persona-aware alignment / RL fine-tuning** (Persona-Aware Alignment Framework, arXiv:2511.10215; Multi-Turn RL, arXiv:2511.00222). Train the model to be persona-consistent. Not available to plugin authors.

**Practitioner-level counters that survive without model access.** Hierarchical/recency anchoring (put the voice rules at the end of context where attention is highest, not just at the start). Anchor phrases (short, distinctive tokens the model will reach for under load — see Caveman's "ACTIVE EVERY RESPONSE" phrasing, or Output Styles' built-in adherence reminders). Examples over rules (concrete in-voice exemplars outperform abstract style descriptions in low-attention regimes — Crafting a Good Prompt vs. Providing Exemplary Dialogues, arXiv:2402.09954). Output structure constraints (forcing the response into a structure where the voice has to manifest — fewer degrees of freedom for drift).

**What does not have empirical support but is folk wisdom.** Forbidden-phrase lists. No paper found supports negative constraints as effective for style; some prompt-engineering writeups note that listing forbidden phrases can prime the model to produce them (the "don't think of a pink elephant" failure mode), though this is anecdotal in the literature reviewed.

**Practical takeaway from the Li et al. paper that the Fellowship voice problem matches almost exactly.** Drift becomes measurable at 8 turns and severe by 12 — well inside the Fellowship's typical orchestrator session length. The single highest-yield mitigation available to a plugin author (no model access) is SPR-equivalent re-injection at `UserPromptSubmit`. That is, mechanically, what Caveman does.

## Sources

### Caveman
- Repo: https://github.com/JuliusBrussee/caveman
- `plugin.json`: https://github.com/JuliusBrussee/caveman/blob/main/.claude-plugin/plugin.json
- `caveman-activate.js` (SessionStart): https://github.com/JuliusBrussee/caveman/blob/main/src/hooks/caveman-activate.js
- `caveman-mode-tracker.js` (UserPromptSubmit, per-turn reminder): https://github.com/JuliusBrussee/caveman/blob/main/src/hooks/caveman-mode-tracker.js
- `SKILL.md`: https://github.com/JuliusBrussee/caveman/blob/main/skills/caveman/SKILL.md
- `CLAUDE.md` (architecture notes): https://github.com/JuliusBrussee/caveman/blob/main/CLAUDE.md

### Claude Code official docs
- Output Styles: https://code.claude.com/docs/en/output-styles
- Hooks guide: https://code.claude.com/docs/en/hooks-guide
- Hooks reference: https://code.claude.com/docs/en/hooks
- Memory / CLAUDE.md: https://code.claude.com/docs/en/memory
- Plugins reference: https://code.claude.com/docs/en/plugins-reference
- Modifying system prompts (Agent SDK): https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts
- Open feature request — UserPromptSubmit prompt replacement: https://github.com/anthropics/claude-code/issues/53330
- Reverse-engineered system-prompt assembly: https://www.dbreunig.com/2026/04/04/how-claude-code-builds-a-system-prompt.html
- Piebald-AI dump of Claude Code system prompts: https://github.com/Piebald-AI/claude-code-system-prompts

### Prior art
- `schmitthub/claude-code-personas`: https://github.com/schmitthub/claude-code-personas
- `alirezarezvani/claude-skills` (personas wiki): https://github.com/alirezarezvani/claude-skills/wiki/Personas-Overview
- `SuperClaude-Org/SuperClaude_Framework`: https://github.com/SuperClaude-Org/SuperClaude_Framework
- `hesreallyhim/awesome-claude-code-output-styles-that-i-really-like`: https://github.com/hesreallyhim/awesome-claude-code-output-styles-that-i-really-like
- `takechanman1228/claude-persona`: https://github.com/takechanman1228/claude-persona

### Attention decay & persona drift
- Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, TACL: https://arxiv.org/abs/2307.03172
- Li et al., *Measuring and Controlling Persona Drift in Language Model Dialogs*: https://arxiv.org/html/2402.10962v1 — code at https://github.com/likenneth/persona_drift
- *Persona-Aware Alignment Framework for Personalized Dialogue Generation*: https://arxiv.org/html/2511.10215v1
- *Consistently Simulating Human Personas with Multi-Turn Reinforcement Learning*: https://arxiv.org/abs/2511.00222
- *Crafting a Good Prompt or Providing Exemplary Dialogues?*: https://ar5iv.labs.arxiv.org/html/2402.09954v1
- Morph, *Lost in the Middle LLM: The U-Shaped Attention Problem Explained*: https://www.morphllm.com/lost-in-the-middle-llm
- *Understanding Persona Drift in LLMs* (Emergent Mind summary): https://www.emergentmind.com/topics/persona-drift
