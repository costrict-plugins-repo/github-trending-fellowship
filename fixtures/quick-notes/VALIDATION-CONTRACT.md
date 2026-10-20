# Validation Contract — Quick Notes

> The quest is done when every P0 assertion below is PASS, with cited evidence, and
> zero P0 assertions are FAIL. P1/P2 FAILs are logged, not gates.

This contract describes the **intended** behavior of the Quick Notes app. Score each
assertion by walking the running app at **http://localhost:5050** (started with
`python3 -m http.server 5050 --directory fixtures/quick-notes`). You are given only the
URL and this contract — not the source, not an answer key. Mark each assertion
**PASS**, **FAIL**, or **UNTESTABLE** with cited evidence (what you did, what you saw).

---

- **[P0] [Pippin]** The page loads at http://localhost:5050 and produces no errors in the browser console on load.
  - Verify: Navigate to the URL. Read `browser_console_messages` immediately after load. PASS if the page renders (heading "Quick Notes" and a text input visible) and the console shows zero `error`-level messages. FAIL if any console error appears.
  - Defends: App boots cleanly; no broken script on initial load.

- **[P0] [Pippin]** Adding a note with non-empty text shows that note in the list immediately, without a reload.
  - Verify: Type "Buy milk" into the input, click Add. PASS if "Buy milk" appears in the visible note list right away. FAIL if it does not appear, or appears only after a reload.
  - Defends: Core add flow — feature 1 and 2 (create note, list shows it).

- **[P0] [Pippin]** Submitting an empty or whitespace-only note is rejected: the note count does not change and no blank entry is added.
  - Verify: Note the current number of notes. Click Add with the input empty; then type three spaces and click Add. PASS if the note count is unchanged after both attempts and no blank row appears. FAIL if a blank or whitespace note is added.
  - Defends: Unhappy path — empty-submission rejection (feature 6).

- **[P0] [Pippin]** Toggling a note's done state visibly marks it done (e.g., strikethrough) without throwing a console error.
  - Verify: Add a note. Click its checkbox. PASS if the note text becomes visibly struck through (or otherwise clearly marked complete) AND `browser_console_messages` shows no new error from the toggle. FAIL if it does not visibly mark done, or if toggling produces a console error.
  - Defends: Done-toggle flow (feature 3); clean runtime on interaction.

- **[P0] [Pippin]** Deleting a note removes *that specific note* and leaves the other notes intact.
  - Verify: Add three distinct notes (e.g., "first", "second", "third"). Click Delete on the **middle** note ("second"). PASS if "second" is gone and "first" and "third" both remain. FAIL if a different note disappears or more than one note is removed.
  - Defends: Targeted delete (feature 4) — the wrong-target failure mode is exactly what a blind walk must catch.

- **[P1] [Pippin]** Notes persist across a full page reload.
  - Verify: Add two notes, then reload the page (full navigation, not just re-render). PASS if both notes are still present after reload. FAIL if any added note is lost.
  - Defends: localStorage persistence (feature 5).
