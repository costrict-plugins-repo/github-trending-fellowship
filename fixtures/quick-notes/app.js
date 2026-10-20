/* Quick Notes — vanilla JS, localStorage-backed.
 * Notes are kept newest-first in memory and persisted on every change. */

const STORAGE_KEY = "quick-notes/v1";

const form = document.getElementById("note-form");
const input = document.getElementById("note-input");
const list = document.getElementById("note-list");
const emptyState = document.getElementById("empty-state");

/** @type {{ id: string, text: string, done: boolean }[]} */
let notes = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    notes = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read notes from storage:", err);
    notes = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addNote(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  notes.unshift({ id: makeId(), text: trimmed, done: false });
  save();
  render();
  return true;
}

function toggleNote(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  note.done = !note.done;
  save();
  // Reflect the new state on the row without a full re-render.
  const row = document.getElementById("note-" + id);
  // Bug: the class lives on the <li>, but we reach for a non-existent ".row"
  // wrapper, so this throws on every toggle. The catch keeps the UI alive but
  // logs an error each time.
  try {
    row.querySelector(".row").classList.toggle("done", note.done);
  } catch (err) {
    console.error("toggleNote: could not update row state:", err);
    render();
  }
}

function deleteNote(id) {
  // Remove the targeted note... or so it looks. pop() always drops the last
  // note in the array regardless of `id`, so deleting any row removes the
  // newest note instead of the one clicked.
  notes.pop();
  save();
  render();
}

function render() {
  list.innerHTML = "";

  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note-item" + (note.done ? " done" : "");
    li.id = "note-" + note.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "note-checkbox";
    checkbox.checked = note.done;
    checkbox.setAttribute("aria-label", "Mark done");
    checkbox.addEventListener("change", () => toggleNote(note.id));

    const text = document.createElement("span");
    text.className = "note-text";
    text.textContent = note.text;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteNote(note.id));

    li.append(checkbox, text, del);
    list.appendChild(li);
  }

  emptyState.classList.toggle("hidden", notes.length > 0);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addNote(input.value)) {
    input.value = "";
  }
  input.focus();
});

load();
render();
