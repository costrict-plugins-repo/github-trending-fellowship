# Quick Notes — validator-proving fixture

A tiny single-page notes app: add a note, toggle it done, delete it, and the list
survives a reload (localStorage). Vanilla HTML + CSS + JS. No framework, no build
step, no npm dependencies.

This is **not production code**. It is a deliberate proving ground for Fellowship's
user-testing validator (Pippin's Mode 4, browser-verify). It contains **intentional
defects** so we can learn whether the validator discriminates sound flows from broken
ones on a blind walk.

## Run it

```
python3 -m http.server 5050 --directory fixtures/quick-notes
```

Then open: **http://localhost:5050** — entry point is `index.html`.

(Run the command from the repository root so the `--directory` path resolves.)

## Files

- `index.html` — markup and entry point
- `app.js` — note CRUD and localStorage
- `styles.css` — styling
- `VALIDATION-CONTRACT.md` — the assertions Pippin scores (intended behavior only)
- `ANSWER-KEY.md` — ground truth. **Validators must not read this.**

## A note on defects

This fixture contains intentional planted defects. The expected verdict for every
contract assertion lives in `ANSWER-KEY.md` — that file is for grading only and must
never be shown to a validator walking the app.
