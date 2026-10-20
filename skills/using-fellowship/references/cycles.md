# Workflow Cycles — Review, Testing, Design

## Review Cycle (Gimli → Legolas)

After Gimli DONE on critical paths, dispatch Legolas. Cycle runs to completion once started.

**When to dispatch:**
- Always: auth, payments, data mutations, public APIs, security-sensitive code
- Usually: new features with meaningful logic, multi-file changes
- Skip: config, copy, one-line fixes, non-code artifacts

**Cycle:**
1. Dispatch Legolas with Gimli's report + original spec + git SHAs + content of `docs/fellowship/codebase-map.md` if it exists.
2. Legolas reports: APPROVED / APPROVED_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
3. On Critical or Important findings: SendMessage to Gimli with filtered list, Gimli fixes, re-dispatch Legolas.
4. Repeat until APPROVED.

**Rails:**
- Never skip re-review after fixes. Worth fixing = worth verifying.
- Gimli stays alive via SendMessage — preserves build context. Never spawn fresh Gimli mid-cycle.
- Legolas never edits code. Findings flow through you.
- Filter findings: send Gimli Critical + Important. Note Minor, don't burn a round trip.
- Cap at three iterations. If Critical or Important findings remain after three rounds, escalate to Frodo with both the implementation and the accumulated findings — a fourth round usually means the spec is wrong, not the code.

**Statuses:**

| Status | Action |
|---|---|
| APPROVED | Mark complete. Proceed. |
| APPROVED_WITH_CONCERNS | Correctness → Gimli. Observation → note and proceed. |
| NEEDS_CONTEXT | Add missing info, re-dispatch. |
| BLOCKED | Too large → incremental commits. Unfamiliar domain → Boromir or Pippin. |

---

## Testing Cycle (Pippin)

Pippin writes tests from the spec, not the implementation. That independence is his value — he catches what the builder misses.

**When to dispatch:**
- **Test-after (most common):** After Legolas flags gaps, or after Gimli completes non-trivial logic.
- **Test-first (complex logic):** Before Gimli builds, when the spec can be expressed as assertions. Pippin writes failing tests; Gimli implements against them.
- **Test infrastructure:** Frameworks, fixtures, CI config. Goes on the quest log like any feature.
- **Browser verification:** After Legolas approves a UI feature. Pippin walks flows, checks console + failed API calls, reports.

**Test-after workflow:**
1. Gimli DONE → Legolas flags gaps (or you identify them).
2. Dispatch Pippin with original spec (source of truth), what Gimli built (files, interfaces), specific gaps if flagged.
3. Pippin writes tests from spec, runs, reports: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT (spec ambiguous) / BLOCKED (no infra).
4. Spec violations in tests → SendMessage Gimli; Gimli fixes; re-dispatch Legolas if significant.

**Test-first workflow:**
1. Dispatch Pippin with spec → failing tests (red), DONE.
2. Dispatch Gimli with task + Pippin's test files: *"Implement against these tests — they define the contract."* → green, DONE.
3. Dispatch Legolas to review both tests and implementation.

**Browser verification workflow:**
1. Legolas approves UI feature (APPROVED or APPROVED_WITH_CONCERNS). Assess: user-visible flow worth verifying? Yes → dispatch Pippin browser-verify. No (backend, config, refactor, quick fix) → skip.
2. Dispatch Pippin with `"Mode: browser-verify"`, exact flows (routes, components, interactions, starting URL), expected behavior at each step, files Gimli built. Be specific — Pippin does not guess.
3. Pippin reports: DONE / DONE_WITH_CONCERNS / BLOCKED (MCP not registered, dev server unreachable, page won't load).
4. Issues found: Blocker/major → SendMessage Gimli → fix → re-dispatch Pippin (same flow). Minor/cosmetic → quest log; user decides priority.

**Rails:**
- Pippin reads the spec, not the code. Dispatch must include task description or spec — not just "write tests for auth.ts".
- Spec violations are findings, not test errors. Code diverges from spec → report to Gimli, not a test fix.
- Critical paths → dispatch Legolas to review Pippin's test files too.
- Browser verification requires the Playwright MCP. Confirm registration before dispatching browser-verify. If not: *"Browser verification needs the Playwright MCP — register it with: `claude mcp add playwright -- npx @playwright/mcp@latest --caps vision`"*
- Browser verification is for UI flows only. Backend, API, refactors, config → test-after instead.

---

## Design Review (Arwen)

Arwen reviews design quality — Legolas reviews code quality. Complementary. Legolas is automatic on critical code paths; **Arwen is dispatched on judgment.** Not every Gimli build has a visible face worth auditing.

**When to dispatch:**
- **Design contract exists** — Gimli built against Arwen's spec. Compliance check, not a full audit.
- **Task is user-facing and significant** — new page, new flow, redesigned component. Not a label tweak.
- **User signals it** — "make this accessible," "careful with the UX," "review the design."
- **Visual exploration before building** — Arwen produces HTML/CSS mockups; user picks direction; dispatch Gimli with the chosen mockup as design contract. Arwen's HTML is input, not final deliverable.

**Do not dispatch Arwen** for backend, API routes, config, or anything without a visible interface. Not automatically after every Gimli build.

**Design contract compliance (most common):**
1. Gimli builds against contract, DONE.
2. Dispatch Arwen with contract path + what Gimli built (files, screenshots if available).
3. Arwen reports: DONE / DONE_WITH_CONCERNS (drift) / NEEDS_CONTEXT (can't assess without running UI).
4. Deviations → SendMessage Gimli with specifics → corrects, DONE.

**Full UX audit / WCAG audit (on request):** Dispatch with `"Run a full UX audit"` or `"Run an accessibility audit"` only when explicitly requested. Deep passes — 6-pillar audit, full WCAG 2.2. Reserve for pre-launch, significant releases, user-reported a11y issues.

**Rails:**
- Arwen never edits code. Findings flow through you to Gimli.
- Compliance ≠ full audit. Compliance is fast, full audit is expensive. Don't conflate.
- Legolas and Arwen can run in parallel when a Gimli build warrants both.
- Figma work requires MCP. Confirm figma-console MCP is connected before dispatching Arwen on Figma. If Arwen reports BLOCKED on MCP availability: *"Figma MCPs aren't reaching Arwen through the plugin. Copy `agents/arwen.md` to `.claude/agents/arwen.md` in this project — project-level agents don't have the same MCP restrictions as plugin agents."*
