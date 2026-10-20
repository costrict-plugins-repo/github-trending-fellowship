# Browser Verification Spec

**Date:** 2026-04-12
**Status:** Implemented — 2026-04-12

---

## Context

After Gimli builds and Legolas reviews the code, nobody opens `localhost` and clicks through the actual user flow. Legolas checks code quality. Pippin writes automated tests. But the question "does this actually work when a person uses it?" goes unanswered until the user checks manually.

This is a known gap. The reference implementation analysis (2026-03-23) identified it across the ecosystem:

- **Superpowers** has strict verification ("evidence before claims") — but it verifies test output and VCS diffs, not browser behavior.
- **GSD** ends its artifact pyramid at `UAT.md` — but UAT is human acceptance, not agent verification.
- **BMAD's Quinn** generates E2E test code — but generates tests, doesn't run live browser sessions.
- **Context-mode** uses Playwright and achieves 99% token reduction on browser snapshots — demonstrating both the value and the cost of browser interaction.

No reference implementation has an agent that navigates a running app, checks the console, and reports UX issues back. This spec fills that gap.

---

## Design Decision: Pippin + Gandalf, Not a New Companion

Browser verification is testing. It belongs with Pippin (test engineer) and Gandalf (orchestrator who decides when to verify).

Introducing a new companion (e.g., Faramir) was considered and rejected:
- The 10-companion roster exists for good reason — depth over breadth.
- Browser verification is a mode of testing, not a separate domain.
- Pippin already has three modes (test-after, test-first, test-infrastructure). A fourth mode fits naturally.
- Gandalf already decides when to dispatch Pippin and in which mode.

---

## Tooling: Playwright MCP

**Package:** `@playwright/mcp` (official Microsoft, Apache-2.0)

**Registration:**
```bash
claude mcp add playwright -- npx @playwright/mcp@latest --caps vision
```

Vision mode (`--caps vision`) is required, not optional — verification needs visual evidence to be useful. The accessibility tree alone can't catch visual problems (misaligned layouts, wrong colors, overlapping elements).

**Browser support:** Chrome, Firefox, WebKit, Edge. Default: Chromium. Runs headed by default (browser window visible). Add `--headless` for CI.

### Key Tools for Verification

| Category | Tools | Purpose |
|----------|-------|---------|
| **Navigation** | `browser_navigate`, `browser_navigate_back`, `browser_wait_for` | Walk through user flows |
| **Observation** | `browser_snapshot` (accessibility tree), `browser_take_screenshot` (opt-in) | See page state |
| **Interaction** | `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key` | Simulate user actions |
| **Diagnostics** | `browser_console_messages`, `browser_network_requests` | Catch runtime errors, failed API calls |
| **Assertions** | `browser_verify_text_visible`, `browser_verify_element_visible`, `browser_verify_value`, `browser_verify_list_visible` | Validate expected state |
| **JavaScript** | `browser_evaluate` | Check application state directly |
| **DevTools** | `browser_start_tracing`, `browser_stop_tracing` | Performance capture (opt-in, `--caps devtools`) |

### Token Cost Considerations

The Playwright MCP has significant context implications:

1. **Tool schema baseline:** ~60 tools loaded into context when the MCP is active. This is a fixed cost whether or not they're used.
2. **`browser_snapshot` (accessibility tree):** Primary observation mode. Returns structured text — far cheaper than screenshots, but can be large on complex SPAs with deep DOM trees.
3. **`browser_take_screenshot`:** Requires `--caps vision`. Sends image data — more expensive per call. Use for evidence capture (3-5 per verification), not continuous observation.
4. **`browser_console_messages`:** Returns raw arrays. Can be verbose on chatty apps. Filter guidance: focus on `error` and `warning` levels.
5. **`browser_network_requests`:** Raw request/response data. Can be very large. Filter guidance: focus on failed requests (4xx, 5xx status codes).

**Mitigation:** Pippin should use `browser_snapshot` as the primary mode, take screenshots only at key verification checkpoints, and filter console/network output to errors. The verification mode instructions must explicitly address this.

### MCP Availability

The Playwright MCP is **opt-in** — users must register it. Pippin's browser verification mode should fail gracefully:

- If MCP tools are not available: report `BLOCKED` with the registration command.
- If the browser can't reach `localhost`: report `BLOCKED` with dev server instructions.
- If the accessibility tree is too large for useful navigation: switch to screenshot-based observation (requires `--caps vision`).

---

## Changes to Pippin

### New Mode: Browser Verification (Mode 4)

Added alongside the existing three modes. Gandalf specifies `browser-verify` in the dispatch prompt.

**When this mode is used:**
- After Gimli builds a UI feature and Legolas approves the code
- When the user requests live verification ("does this actually work?", "click through it")
- When Arwen's design contract compliance check needs visual evidence

**What Pippin does in this mode:**

```
1. Check for dev server
   - Probe common ports: 3000, 5173, 4321, 8080, 8000
   - If a server is already running: use it (don't start a second one)
   - If none found: read package.json scripts, try to start it
     (npm run dev / bun dev / pnpm dev — whichever the project uses)
   - Wait up to 10 seconds for the server to be reachable
   - If still unreachable: report BLOCKED with what was tried

2. Navigate to the entry point
   - browser_navigate to localhost:<port>
   - browser_snapshot to get the accessibility tree
   - Verify the page loaded (not error page, not blank)

3. Walk the specified user flow
   - Follow the steps from the dispatch prompt or spec
   - At each step: browser_snapshot → interact → browser_snapshot
   - browser_console_messages after each navigation (filter to errors/warnings)
   - browser_network_requests after each API call (filter to 4xx/5xx)

4. Capture evidence at key states
   - browser_take_screenshot at meaningful checkpoints (initial state, after key actions, final state)
   - Save screenshots to docs/fellowship/verifications/ for persistent evidence
   - Name: verification-[feature]-[step]-[date].[ext]

5. Write verification report to docs/fellowship/verifications/
```

**What Pippin does NOT do in this mode:**
- Write test code (that's test-after or test-first mode)
- Fix anything (findings go to Gimli via the report)
- Run automated test suites (that's separate from live verification)
- Navigate outside the specified flow (scope discipline)
- Guess what to verify — the dispatch prompt must specify the flows, routes, and components to test

### Verification Report Format

Extension of Pippin's existing report format:

```
Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

What was verified:
  [user flow description — what was walked through]

Steps taken:
  1. [action] → [result] ✓ | ✗
  2. [action] → [result] ✓ | ✗
  ...

Console errors:
  [list of console errors/warnings captured, or "None"]

Failed network requests:
  [list of 4xx/5xx requests with URL and status, or "None"]

Screenshots:
  [saved to docs/fellowship/verifications/ — list paths and what each shows]

Issues found:
  1. [issue title]
     - Severity: blocker | major | minor | cosmetic
     - Step: [which step in the flow]
     - Expected: [what should happen based on spec]
     - Actual: [what happened in the browser]
     - Evidence: [screenshot reference or console error]

Concerns: (DONE_WITH_CONCERNS only)
  [things that technically work but feel wrong — slow responses, confusing UX, accessibility gaps visible in the accessibility tree]

Blocker: (BLOCKED only)
  [what's blocking — MCP not available, dev server not running, page won't load]
```

### Pippin Agent File Changes

**Description update** (frontmatter):
Add browser verification to the examples:

```
<example>Context: Gimli built a UI feature, Legolas approved the code. user: [Legolas reports APPROVED — auth flow implementation complete] assistant: Dispatches Pippin in browser-verify mode with the auth flow spec and Gimli's file list. <commentary>Browser-verify mode: live verification of a UI feature after code review passes. Pippin opens the running app, walks the flow, checks the console, and reports issues.</commentary></example>
```

**Modes section:** Add Mode 4 after Mode 3 (Test Infrastructure).

**New section:** `## Browser Verification Tools` — following Arwen's Figma MCP documentation pattern. Document the Playwright MCP tools Pippin needs, organized by task. Include:
- Exact tool name format: `mcp__playwright__browser_navigate`, etc.
- Common failure mode: MCP not registered
- Token budget guidance: snapshot-first, screenshots at checkpoints only
- Console/network filtering: errors and warnings only

### What NOT to Change in Pippin

- The three existing modes stay exactly as they are.
- The "What You Don't Do" section is unchanged — browser verification is observation, not implementation.
- The First Principle ("Tests are a specification, not a mirror") still applies — in browser-verify mode, the spec is the user flow description, not what the app currently shows.
- The Anti-Paralysis Guard applies — if 5+ consecutive observations without a finding or a report, stop and write what you know.
- Pippin's voice is unchanged. *"Hang on — that button didn't do anything. The spec says it should open the modal. Let me check the console..."*

---

## Changes to Gandalf

### New Dispatch Option: Browser Verification

Add to the "When to dispatch Pippin" section:

```markdown
- **Browser verification (post-review):** After Legolas approves a UI feature.
  Pippin opens the running app, walks the user flow, checks for console
  errors and failed API calls, and reports what he finds.
```

### Browser Verification Workflow

Add as a new workflow subsection after "Test-first workflow":

```
### Browser verification workflow

1. Legolas approves a UI feature (APPROVED or APPROVED_WITH_CONCERNS)
2. Assess: does this feature have a user-visible flow worth verifying?
   - Yes → dispatch Pippin in browser-verify mode
   - No (backend, config, refactor) → skip
3. Dispatch Pippin with:
   - "Mode: browser-verify"
   - The exact user flows to walk through — routes, components, interactions
   - Expected behavior at each step (from the spec or design contract)
   - What Gimli built (file list from his report)
   Pippin does not guess what to verify — the dispatch must be specific.
4. Pippin walks the flow, reports back:
   - DONE → flow works, no issues
   - DONE_WITH_CONCERNS → flow works but something is off
   - BLOCKED → can't reach the app (MCP not available, dev server not running)
5. If Pippin found issues:
   - Blockers/majors → SendMessage to Gimli with findings
   - Gimli fixes → re-dispatch Pippin to re-verify (same flow, same steps)
   - Minors/cosmetic → note in quest log, user decides priority
```

### When NOT to Browser-Verify

Gandalf should NOT dispatch Pippin for browser verification on:
- Backend/API-only changes (no UI)
- Config changes, refactors, dependency updates
- Changes already covered by Pippin's automated tests (don't duplicate)
- Quick fixes where the user will see the result immediately

### Key Rule Addition

Add to existing key rules:

```
- **Browser verification requires the Playwright MCP.** Before dispatching
  Pippin in browser-verify mode, confirm the user has registered the MCP.
  If not: "Browser verification needs the Playwright MCP. Register it with:
  `claude mcp add playwright -- npx @playwright/mcp@latest --caps vision`"
- **Browser verification is for UI flows, not unit behavior.** If the
  change is purely logic, dispatch Pippin in test-after mode instead.
```

### Model Routing

Browser verification dispatches use `sonnet` — it's structured checklist work (walk steps, observe, report), not judgment. Same as Pippin's other modes.

---

## What This Does NOT Cover

### Not in scope — Gandalf self-verification

Gandalf already has a verification posture: "DONE means verified, not believed" and "Never skip verification." This spec does not change Gandalf's own verification behavior — he already runs tests and checks diffs. Browser verification is a *new capability* dispatched to Pippin, not a change to Gandalf's personal verification loop.

### Not in scope — CI/CD integration

Browser verification is a development-time tool, not a CI gate. Playwright in CI is Pippin's test-infrastructure mode (Mode 3), not browser-verify mode. The two are complementary:
- **Browser-verify** = human-like walkthrough during development, catches UX issues
- **E2E tests** = automated regression in CI, catches regressions

### Not in scope — network mocking or state setup

Playwright MCP supports `browser_route` (network mocking) and storage manipulation. These are powerful but add complexity. First version: Pippin verifies the app as-is, with whatever state the dev server provides. State setup and network mocking can be added later if needed.

### Not in scope — performance profiling

Playwright MCP supports `browser_start_tracing` / `browser_stop_tracing` (requires `--caps devtools`). Performance verification is a separate concern — it could become a Mode 5 later, or part of Sam's domain. Not this spec.

### Not in scope — mobile/responsive verification

Playwright MCP supports `--device "iPhone 15"` for device emulation. Responsive verification is valuable but adds scope. First version: desktop only. Add device emulation in a follow-up if needed.

---

## Implementation Order

| # | Change | Where | Effort |
|---|--------|-------|--------|
| 1 | Add Mode 4: Browser Verification section | `agents/pippin.md` | Medium |
| 2 | Add Browser Verification Tools section (MCP docs) | `agents/pippin.md` | Medium |
| 3 | Update Pippin description in frontmatter | `agents/pippin.md` | Low |
| 4 | Add browser-verify dispatch option | `agents/gandalf.md` | Low |
| 5 | Add browser verification workflow | `agents/gandalf.md` | Low |
| 6 | Add MCP prerequisite check rule | `agents/gandalf.md` | Low |
| 7 | Update health check tests | `health-check.mjs` | Low |

Steps 1-3 are one unit (Pippin). Steps 4-6 are one unit (Gandalf). Step 7 validates both.

---

## Resolved Decisions

1. **Dev server:** Check for an already-running server first (probe common ports). Only start one if nothing is found. Read `package.json` to pick the right command. 10-second timeout. Report BLOCKED if still unreachable.

2. **Screenshot storage:** Save to `docs/fellowship/verifications/` for persistent evidence. Screenshots in conversation context vanish after the session — files give Gimli something to reference when fixing.

3. **Step limit:** No artificial limit. Gandalf's dispatch prompt must specify exactly which flows, routes, and components to verify. Pippin walks what he's told to walk — no more, no less.

4. **Re-verification:** Same flow, same steps. When Gimli fixes an issue, Pippin re-runs the full verification. Simple, no special logic.

5. **Vision mode:** `--caps vision` is required, not optional. Accessibility tree is for navigation and element interaction. Screenshots are for evidence. A verification that can't see the visual state isn't a verification for UI work.
