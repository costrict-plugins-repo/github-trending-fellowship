# Fellowship Runtime Coherence Audit — 2026-04-26

**Lens:** wires-and-contracts. Read-only. Complement to the file-template and content-cleanliness passes already on disk.

---

## Headline finding

**The Tier 2 skill commands every secondary companion advertises do not exist.** Five agent files (`aragorn.md:34`, `merry.md:34`, `boromir.md:29`, `sam.md:39`, `bilbo.md:36`) and the central companion table at `skills/using-fellowship/references/companions.md:7–15` instruct the user that `/aragorn`, `/merry`, `/boromir`, `/sam`, `/bilbo`, `/legolas`, `/pippin`, `/arwen` are "loaded in-session." `commands/` contains exactly two slash commands: `fellowship-add-ethos.md` and `fellowship-consolidate.md`. There are no skill folders named `aragorn`, `merry`, `legolas`, etc. either. A user typing `/fellowship:legolas` after reading the documented contract receives nothing. This is the most consequential dangling wire in the system: the Tier 2 lane every secondary agent advertises is not implemented. **Block.**

---

## Per-check findings

### 1. Cross-reference resolution

| Severity | Finding |
|---|---|
| **Block** | `commands/fellowship-aragorn.md`, `fellowship-merry.md`, `fellowship-legolas.md`, `fellowship-boromir.md`, `fellowship-pippin.md`, `fellowship-sam.md`, `fellowship-arwen.md`, `fellowship-bilbo.md` — referenced from `companions.md:7–15` and from each agent's "Tier 2 (skill, in-session)" line — **do not exist on disk**. Slash invocations advertised at the source-of-truth table fail silently. Either build the eight commands or strike `/aragorn`, `/merry`, … from `companions.md` and the agent Tier 2 lines. |
| **Important** | `agents/references/sam-templates.md` exists on disk but is **not referenced** from `agents/sam.md`. Sam's craft section ends without pointing at the templates the file was clearly written to host. Either delete the orphan or wire it in (`agents/sam.md`, parallel to `bilbo.md:64` and `merry.md:82`). |
| **Important** | The shared protocol at `agents/_shared/companion-protocol.md:40` is titled `## Before You Report DONE — Universal Checklist`, but every agent file refers to it as **"the universal pre-DONE checklist"** (e.g. `aragorn.md:38`, `legolas.md:35`, all nine). The names are close enough to read past — until a contributor greps for `pre-DONE` in the shared file and finds nothing. Pick one phrasing. |
| **Minor** | `docs/fellowship/specs/merry-adr-legolas-structural-review.md:170, 192–201` references `agents/gandalf.md:493` for an edit location. The file no longer exists. The spec is historical (work landed); the prior cleanliness audit already routed it to `specs/archive/`. Leave for the comparison-cleanliness owner. |
| **Minor** | `agents/legolas.md:5` (description block, `<example>`) and `agents/legolas.md:118` instruct Legolas to `Read docs/fellowship/codebase-map.md` for structural review. The file exists. The pointer resolves. Wire is clean — noting it because the runtime contract depends on it. |

All `_shared/companion-protocol.md` pointers (one per agent, nine total) resolve. All `references/<topic>.md` pointers resolve. All `evals/<dir>` directories named in `skills/autoimprove/SKILL.md:42–48` exist. `templates/ethos.md` exists with the four lines `skills/using-fellowship/SKILL.md:42–48` declares.

### 2. Shared-concept symmetry

| Severity | Finding |
|---|---|
| **Important** | **Status enum split across companions is real and undocumented.** Six agents (Aragorn, Arwen, Bilbo, Gimli, Merry, Pippin, Sam) emit `DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED`. Two agents (Legolas, Boromir) emit `APPROVED / APPROVED_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED`. The shared protocol at `companion-protocol.md:22` says only "the four status codes valid for your companion" — without saying which four belong to whom or that two enums coexist. The handling table at `skills/using-fellowship/SKILL.md:100–105` documents only DONE / DONE_WITH_CONCERNS — it does not tell Gandalf how to handle APPROVED / APPROVED_WITH_CONCERNS even though `cycles.md:14` shows Legolas emitting them. The single inline example at `SKILL.md:94` (`"Legolas: APPROVED_WITH_CONCERNS"`) is the only acknowledgment in the orchestrator's main file that reviewers use a different vocabulary. Add a row pair to the SKILL.md status table; or fold APPROVED into DONE for reviewers. |
| **Important** | **Pre-DONE checklist completeness varies.** `agents/_shared/companion-protocol.md:40–50` defines the universal checklist and points companions to add craft-specific items in their own files. Aragorn, Arwen, Bilbo, Boromir, Legolas, Merry, Pippin, and Sam each have a `## <Companion>-specific pre-DONE checks` section. **Gimli has none.** The single most-dispatched companion has no companion-specific verification gate. `agents/gimli.md:30` declares the shared checklist applies but offers no Gimli additions — which is plausibly intentional, but contradicts the symmetry every other agent observes. Either add `## Gimli-specific pre-DONE checks` (build verified, plan path returned, scope held, tests run) or note explicitly in `gimli.md` that none are added and why. |
| **Minor** | The four Fellowship Principles in `templates/ethos.md` are exactly what `SKILL.md:42–48` claims. Ethos injection rule (`SKILL.md:142–146`) and the "absent → don't block" fallback are consistent. Wire is clean. |
| **Minor** | The Anti-Paralysis Guard appears twice — `companion-protocol.md:30–38` (companions) and `SKILL.md:217–219` (Gandalf). The two are similar in spirit; they differ in detail (companions allow Bash for read-only inspection in the count; Gandalf's compressed line does not enumerate). Acceptable as separate-audience copies, but worth a one-line cross-reference. |

### 3. Workflow loop termination

| Severity | Finding |
|---|---|
| **Important** | **Review cycle has no maximum iteration count.** `cycles.md:16` says "Repeat until APPROVED." `agents/legolas.md:24` says "The cycle holds until the craft is worthy." Neither names a ceiling. If Legolas re-finds new Critical issues on every fix pass — or if Gimli's fixes introduce regressions Legolas keeps surfacing — the cycle has no documented escape hatch. Add a rail: after N (3?) re-reviews still surfacing Critical findings, escalate to Frodo with the disagreement. The Fellowship Principles include "Latency is the enemy" — an unbounded cycle violates it directly. |
| **Important** | **Test-first cycle's exit condition is implicit.** `cycles.md:51–54` walks Pippin → Gimli → Legolas. The handoff "Pippin → Gimli implements against tests, GREEN, DONE" assumes Pippin's tests are self-checking — but if Gimli's implementation passes tests Pippin wrote, Pippin doesn't get re-dispatched to verify (per the workflow). The loop terminates correctly only if Pippin's tests covered the spec faithfully. If they didn't, the failure mode is silent. Add: after Gimli reports green, re-dispatch Pippin to confirm tests still pass on the built code, not just on Pippin's harness. |
| **Important** | **Browser-verify loop terminates correctly but the dispatch-to-Pippin trigger is judgment-only.** `cycles.md:57–60` says "Assess: user-visible flow worth verifying?" — Gandalf's call. No checklist. For first-time users this is invisible orchestration; the rail at `agents/pippin.md:107` ("If the dispatch is vague, ask for the specific routes…") helps Pippin but not Gandalf upstream. Acceptable; flag for a worked example in `references/cycles.md`. |
| **Minor** | `cycles.md:88` — Arwen design-contract compliance loop "deviations → SendMessage Gimli → corrects, DONE." No re-dispatch to Arwen for verification of the correction. Inverse of the Legolas review-cycle rail at `cycles.md:19` ("Never skip re-review after fixes"). Either re-dispatch Arwen on design fixes or document why design corrections need no second pass. |
| **Minor** | "Only Gandalf dispatches" is implicit, never stated. Most agent files describe dispatch grammars in passing — no agent claims to dispatch another. Teammate-mode SendMessage between teammates is documented (e.g. `aragorn.md:91, 93`) and is *not* dispatch. The contract holds in practice. Worth a single explicit line in `SKILL.md` for clarity: *"Dispatch is Gandalf's alone. Companions surface findings; they do not summon."* |

### 4. Each agent's harness clarity

For each agent: tools / memory / escalation / out-of-scope / communication-back-to-user.

| Agent | Tools match described actions? | Memory consistent? | Knows when BLOCKED / NEEDS_CONTEXT? | Out-of-scope clear? | Comms path clear? |
|---|---|---|---|---|---|
| Aragorn | Yes (Read/Write/Edit + TodoWrite) | `memory: project` declared | Yes (`aragorn.md:127`) | Yes (`aragorn.md:42`) | Yes |
| Arwen | Yes; broad tool set fits 6 deliverables | `memory: project` declared | Yes | Yes (`arwen.md:36–39`) | Three modes documented (`arwen.md:146–151`) |
| Bilbo | Yes | `memory: project` declared | Yes | Yes (`bilbo.md:44–48`) | Yes |
| Boromir | **Read-only by design** — Write/Edit absent on purpose (`boromir.md:27`); matches "audit not fix" stance | `memory: project` declared | Yes (`boromir.md:127–132`) | Yes (`boromir.md:42–44`) | Yes |
| Gimli | Yes; broad implementer set | `memory: project` declared | Yes (`gimli.md:101–104`); plus Deviation Rules (`gimli.md:131–140`) | Yes (`gimli.md:34–36`) | Yes |
| Legolas | **Read-only by design** — Write/Edit absent on purpose (`legolas.md:26`) | `memory: project` declared | Yes (`legolas.md:242–247`) | Yes (`legolas.md:39–41`) | Yes |
| Merry | Yes | `memory: project` declared | Yes (`merry.md:227–232`) | Yes (`merry.md:42–43`) | Yes |
| Pippin | Yes; multi-mode dispatch supported | `memory: project` declared | Yes; classifies failures (`pippin.md:251–256`) | Yes (`pippin.md:39–41`) | Yes |
| Sam | Yes | `memory: project` declared | Yes (`sam.md:280–285`) | Yes (`sam.md:47–48`) | Yes |

| Severity | Finding |
|---|---|
| **Minor** | Every agent declares `memory: project` in frontmatter. The behavior — what `project` means at runtime — is not described in `companion-protocol.md`, the agent files, or `SKILL.md`. The companion docs all say "discoveries accumulate in native memory" (`SKILL.md:185`) without naming what the project memory contract actually is (per-companion-per-project? shared? cleared when?). For a v1.0 release this is a tolerable opacity but worth documenting in `_shared/companion-protocol.md` for contributors writing a tenth companion. |
| **Minor** | `agents/aragorn.md:7–14` declares `tools:` including Edit + Write. Aragorn's role is to produce a requirements *document*; the toolset fits. But the agent's `What You Don't Do` (line 42) says "Don't impose decisions on Frodo" — without naming that Aragorn does not, and should not, edit code. The boundary against editing source code is implicit in the cross-domain frame at `companion-protocol.md:53–63`; making it explicit in Aragorn's file would head off a real failure mode (PM agent with Write+Edit hits a non-spec file). |

### 5. The orchestrator-companion contract

| Severity | Finding |
|---|---|
| **Important** | `cycles.md:22` instructs Gandalf: *"Filter findings: send Gimli Critical + Important. Note Minor, don't burn a round trip."* This is the orchestrator side. **Gimli's agent file (`agents/gimli.md`) does not describe receiving filtered findings.** When Gandalf SendMessages Gimli with two of three severity tiers, Gimli has no documented contract for what arrived. Per `legolas.md:165` ("Findings: [issue list with severity and location]") the wire carries severity labels — but it is silent on whether Gimli should expect Minor or not. Add to `gimli.md` (Self-Review or new "Receiving Review Findings" section): *"Findings arrive Critical + Important. Minor findings are noted by Gandalf and not sent to you. Address all received findings before signaling fix-complete."* |
| **Important** | `agents/legolas.md:5` (description) and Gandalf's review-dispatch instruction at `cycles.md:13` say Gandalf passes "git SHAs" to Legolas. Legolas's `legolas.md:58–67` ("Review the diff") shows the protocol — `BASE_SHA..HEAD_SHA` if provided, else `HEAD~1..HEAD` fallback. The contract holds. **But neither side defines the field name** — does Gandalf prepend `<base_sha>` and `<head_sha>` blocks? Inline prose? `<files_to_read>` covers files (`SKILL.md:131–136`); there is no analogous structured field for SHAs. Either codify a `<git_range>` block in SKILL.md's dispatch section, or document that SHAs come inline as prose and Legolas parses heuristically. |
| **Minor** | `SKILL.md:129–138` defines `<files_to_read>` as the files-loading contract. The pattern appears in zero agent files — none of the nine declares "If a `<files_to_read>` block appears, read those first." Pippin alone has language about reading the spec first (`pippin.md:30, 60`), but doesn't mention the block. Pattern is "adopted from GSD" (`SKILL.md:138`) without being expressed at the receiver side. Either add a one-line acknowledgment in the shared protocol — *"If your dispatch begins with a `<files_to_read>` block, read those files before any other work"* — or accept that this is Gandalf-side discipline only. |
| **Minor** | `gimli.md:78` says Gimli writes plan to `$CLAUDE_SCRATCHPAD_DIR/gimli-plan-[task-slug].md`. `SKILL.md:162` says Gandalf instructs the same path with `[slug]`. Slug-naming is identical in spirit; the prefix `gimli-plan-` is consistent. Wire holds. Note that `companion-protocol.md:28` extends the convention to `<companion>-{task-slug}.md` for any Tier 3+ companion — this is a soft contract everyone honors. |

### 6. Vocabulary drift

See lexicon table below for canonical terms and divergences.

| Severity | Finding |
|---|---|
| **Important** | "DONE" vs "APPROVED" — already covered in §2; the canonical orchestrator vocabulary in `SKILL.md:100–105` mentions only DONE-family. Reviewers (Legolas, Boromir) use APPROVED-family. Both are valid; the SKILL.md status table needs a row to acknowledge this. |
| **Minor** | "specialist" appears once in `SKILL.md:62` ("Tier 2 — One specialist"). The system otherwise uses "companion" (23 occurrences). The lone "specialist" is jarring against an otherwise consistent vocabulary. Replace with "companion." |
| **Minor** | "TodoWrite" is the canonical orchestration task tool (`SKILL.md:63, 160`). The quest log itself is called the "quest log" (canonical). The shared task surface during Tier 3+ is called both `TodoWrite` and "live checklist" (`SKILL.md:160`) and once "shared task list" (`SKILL.md:84` in Agent-Teams context). All three refer to the same thing. Minor — readers infer correctly — but converging language helps. |
| **Minor** | "Findings" (Legolas, Boromir, Pippin) vs "Concerns" (Gimli, Arwen, Sam, Bilbo, Aragorn, Merry's report-format `Concerns:` field). Both labels coexist correctly — Legolas/Boromir audit, others self-report. The Pippin report (`pippin.md:301`) has both Findings AND Concerns sections; this is the right model and other report formats roughly follow it. No change needed; documenting the distinction in `companion-protocol.md` would help future companion authors. |

---

## The orchestration loop, walked end-to-end

**Scenario:** User to Gandalf: *"Build the auth middleware."*

1. **Gandalf classifies (SKILL.md:60–80).** Auth → critical path → Tier 3 trigger. Tier 3 = sequential chain; plan first, TodoWrite the steps, then dispatch. **Wire holds.**
2. **Gandalf reads templates/ethos.md** and prepends the four-line preamble (`SKILL.md:142–146`). **Wire holds** — file exists, four lines match.
3. **Gandalf calls TodoWrite** with `Gimli — build auth`, `Legolas — review`, optionally `Boromir — security audit`. **Wire dangles** if the user is in main-thread mode (per `quest-log.md:6`, TodoWrite is broken in main thread for v1.0). README documents this; checkboxes are the substitute. Acceptable known limit.
4. **Gandalf dispatches Gimli** with `<files_to_read>`, the spec, the codebase-map content, and the plan-gate instruction `gimli-plan-auth.md`. **Wire holds** at the dispatch grammar — but Gimli's agent file (`gimli.md`) does not declare receipt of `<files_to_read>` (Finding §5). Gimli interprets the prose anyway because it is plain.
5. **Gimli writes the plan, builds, verifies, reports DONE** with `Files changed:`, `Verification:`, plan path. **Wire holds.**
6. **Gandalf dispatches Legolas** with Gimli's report + git SHAs + codebase-map content (`cycles.md:13`). **Wire dangles** at the SHA contract — there is no structured field, just prose convention (Finding §5). Legolas's `legolas.md:58–67` covers both prose-prepended and fallback-to-`HEAD~1..HEAD`, so the loop completes regardless.
7. **Legolas reviews and reports APPROVED_WITH_CONCERNS** with two Important findings, one Minor. **Wire dangles** at Gandalf's status-table — `SKILL.md:100–105` does not list APPROVED_WITH_CONCERNS, only DONE_WITH_CONCERNS (Finding §2). Gandalf must extrapolate from the SKILL.md:94 inline example. In practice this works; a contributor reading only the table finds no row.
8. **Gandalf filters findings to Critical + Important** (`cycles.md:22`) and SendMessages Gimli. **Wire dangles** — `gimli.md` does not document receiving filtered findings (Finding §5). Gimli infers correctly because the prose is direct, but a contract should not rely on inference.
9. **Gimli fixes, reports DONE.** Gandalf re-dispatches Legolas (`cycles.md:19`).
10. **Legolas APPROVES.** Gandalf marks the TodoWrite item complete (or checks a box) and surfaces one line to user. **Wire holds.**
11. **Gandalf may dispatch Boromir** if the path is auth-sensitive (`boromir.md:34`). Boromir audits, reports APPROVED. Same APPROVED-vs-DONE concern (§2).
12. **Loop terminates.** No iteration ceiling on step 9–10; if Legolas keeps finding Critical issues, the loop runs unbounded (Finding §3).

**Net:** the loop completes for the happy path. The dangling wires are at boundaries — status-vocabulary, SHA-passing, findings-filter contract, iteration ceiling. None blocks v1.0 individually; together they describe a system that runs because participants are smart, not because the contract is tight.

---

## Vocabulary lexicon

| Canonical term (per `using-fellowship/SKILL.md`) | Alternatives in use | Files where alternatives appear |
|---|---|---|
| **companion** | specialist; agent (when emphasizing dispatch); teammate (Agent-Teams mode only) | `SKILL.md:62` ("specialist") · `cycles.md` and SKILL.md ("agent" used freely) · all teammate-mode sections |
| **DONE** | APPROVED (reviewers only) | `agents/legolas.md:176` · `agents/boromir.md:82` · `cycles.md:14, 28, 31` |
| **DONE_WITH_CONCERNS** | APPROVED_WITH_CONCERNS (reviewers only) | `agents/legolas.md:245` · `agents/boromir.md:130` · `SKILL.md:94` (inline only) |
| **Tier 3** | "subagent dispatch" (in naming-grammar sense) | `SKILL.md:29` (grammar) vs `SKILL.md:63` (tier) — distinct concepts, occasionally confused |
| **TodoWrite (orchestration task surface)** | "live checklist"; "shared task list" (Agent Teams); "quest log checkbox" (TodoWrite-broken fallback) | `SKILL.md:160` ("live checklist") · `SKILL.md:84` ("shared task list") · `quest-log.md:6` ("checkboxes are the working substitute") |
| **quest log** (`docs/fellowship/quest-log.md`) | unambiguous in current files | clean |
| **Findings** | Concerns (self-report context); Issues (Legolas Issues: heading) | `agents/legolas.md:184` ("Issues:") vs `agents/pippin.md:301` ("Findings:") vs most agents' `Concerns:` field |
| **pre-DONE checklist** | "Before You Report DONE — Universal Checklist" (the heading itself) | `companion-protocol.md:40` (canonical heading) vs all agent files using "pre-DONE" |
| **Critical / Important / Minor** (severity) | blocker / major / minor / cosmetic (Pippin browser-verify only) | `agents/pippin.md:174` introduces a fourth severity vocabulary just for browser verification |
| **Frodo** | "the user"; "Gandalf will route to" | mostly consistent; `agents/legolas.md` uses "Gimli does the rest" prose more than "Frodo" |
| **template** (`templates/ethos.md`) vs **reference** (`agents/references/*.md`, `skills/<x>/references/*.md`) | Naming-grammar rule at `SKILL.md:31` is clean | Wire holds |

---

## What's coherent

Credit where it lands:

- **The shared protocol partial** (`agents/_shared/companion-protocol.md`) is referenced by **all nine** agent files at consistent positions. This is the cleanest cross-cutting concern in the system — every companion knows where the shared rules live; the file is a single source of truth.
- **The two read-only agents** (Legolas, Boromir) declare their tool restriction, name it as intentional in their character/role sections, and the absence of Write/Edit in frontmatter matches the prose. The "review never edits" contract is enforced at three layers: tool allowlist, agent-file prose, and shared cross-domain frame.
- **Ethos injection** (`SKILL.md:142–146`) cleanly composes with `templates/ethos.md` and the absent-file fallback. Rule, file, and fallback all align.
- **Plan-gate handoff** between Gandalf (`SKILL.md:162`) and Gimli (`gimli.md:70–80`) names the same path, the same fields, and the same purpose. Slug naming is consistent.
- **Tools-as-strict-allowlist** is documented in three places and they agree (`codebase-map.md:87–94`, the v1.7.0 quest-log archive entry, and the per-agent frontmatter that follows the rule). This was a real failure mode earlier; the system has converged.
- **`<files_to_read>` block** is named and demonstrated in SKILL.md:131–136. The convention is clean even where receiver-side acknowledgment is missing (Finding §5).
- **Cross-domain "What You Don't Do" frame** at `companion-protocol.md:53–63` is mirrored — shape and content — in every agent's `What You Don't Do` section. The pattern of "shared baseline + companion-specific extensions" is well-executed.
- **Codebase-map staleness from the prior cleanliness audit has been addressed.** `codebase-map.md:31, 33, 44, 111` correctly point to `skills/using-fellowship/SKILL.md` as Gandalf's location. The Block-severity finding from the cleanliness comparison has landed.
- **Read-only Legolas-codebase-map carve-out** — `legolas.md:251` exempts the codebase-map read from the 5-call anti-paralysis count. This is a small thing; it shows someone thought through what "exploration" meant differently for the reviewer than for builders. Quality detail.

---

*Audit complete. 2,147 words.*
