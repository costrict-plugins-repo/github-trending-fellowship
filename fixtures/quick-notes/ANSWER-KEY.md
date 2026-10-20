# ANSWER KEY — Quick Notes fixture

> **DO NOT SHOW TO VALIDATORS.** This is ground truth for grading Pippin's blind walk
> only. A validator who reads this has not been tested.

Two defects are planted in `app.js`. Everything else is genuinely correct. The defects
are the kind only an end-to-end walk catches — neither white-screens the page, so a
validator who merely loads the app and stops would wrongly PASS everything.

---

## Planted defects

### Defect A — wrong-target delete (logic bug)
**Location:** `deleteNote(id)` in `app.js`.
**What's wrong:** The handler ignores its `id` argument and calls `notes.pop()`, which
always removes the **last element of the array**. Notes are stored newest-first
(`unshift` on add), so the last array element is the **oldest** note. Clicking Delete on
*any* row removes the oldest note, not the clicked one.
**How a live walk surfaces it:** Add "first", "second", "third" (rendered top-to-bottom
as third, second, first — newest first). Click Delete on the middle row ("second").
"second" stays; "first" (oldest, last in array) disappears instead. A code reader who
trusts the function name can miss it; a walker who watches the wrong note vanish cannot.
**Invisible to:** static read that trusts the handler name.

### Defect B — console error on toggle (runtime bug)
**Location:** `toggleNote(id)` in `app.js`.
**What's wrong:** After flipping `note.done` and saving, the handler does
`row.querySelector(".row").classList.toggle(...)`. There is no `.row` element inside the
`<li>` (the `done` class belongs on the `<li>` itself), so `querySelector` returns
`null` and `.classList` throws `TypeError`. The throw is caught; the catch logs
`console.error("toggleNote: could not update row state:", err)` and falls back to a full
`render()`. So the strikethrough **still applies** (via render), but **every toggle emits
a console error**.
**How a live walk surfaces it:** Toggle any note's checkbox, then read
`browser_console_messages` — a `TypeError` error line appears. The visible done-mark
still works, so a validator who only eyeballs the UI and skips the console misses it; one
who checks the console catches it.
**Invisible to:** static read; UI-only eyeballing that ignores the console.

---

## Expected verdict per contract assertion

| # | Assertion (short) | Expected | Why |
|---|---|---|---|
| 1 | Page loads, no console error **on load** | **PASS** | Load path is clean. `load()` + `render()` run with no error. Defect B only fires on toggle, not on load. |
| 2 | Adding a note shows it immediately | **PASS** | `addNote` → `unshift` → `render` works correctly; note appears at top. |
| 3 | Empty / whitespace submission rejected | **PASS** | `addNote` trims and returns early on empty; count unchanged, no blank row. |
| 4 | Toggle visibly marks done, **no console error** | **FAIL** | Defect B. Strikethrough applies (via the catch's `render()`), but every toggle logs a `console.error`. The assertion requires *both* visible mark *and* no console error — the error fails it. |
| 5 | Delete removes **that specific** note | **FAIL** | Defect A. Deleting the middle note removes the oldest note instead. The clicked note remains; the wrong note vanishes. |
| 6 | (P1) Notes persist across reload | **PASS** | `save()` writes to localStorage on every change; `load()` restores on boot. Reload preserves notes. |

**Gate result:** Two P0 assertions (4 and 5) are FAIL → the quest does **not** pass its
gate. A correct Pippin report marks 1, 2, 3 PASS; 4, 5 FAIL; 6 PASS.

### Discrimination check (how to grade Pippin)
- **Sound flows he must PASS:** 1, 2, 3, 6. Marking any of these FAIL is a false positive
  — the validator is over-eager or the walk was sloppy.
- **Broken flows he must FAIL:** 4, 5. Marking either PASS is a miss — the validator
  rubber-stamped a real defect.
- **Assertion 4 is the subtle one:** the UI *looks* right (done-mark applies), so a
  console-blind walk wrongly PASSes it. Catching it requires reading
  `browser_console_messages` after a toggle. This is the assertion that separates a
  thorough Mode-4 walk from a shallow one.
