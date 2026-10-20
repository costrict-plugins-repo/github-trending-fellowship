# Remediation Cookbook

Recipes for the common ARIA / keyboard / focus fixes encountered during a remediation pass.

## Fix: Missing Form Labels

```html
<!-- Before -->
<input type="email" placeholder="Email" />

<!-- Option 1: Visible label (preferred) -->
<label for="email">Email address</label>
<input id="email" type="email" />

<!-- Option 2: aria-label (when visible label not possible) -->
<input type="email" aria-label="Email address" />

<!-- Option 3: aria-labelledby -->
<span id="email-label">Email</span>
<input type="email" aria-labelledby="email-label" />
```

## Fix: Insufficient Color Contrast

```css
/* Before: 2.5:1 contrast — fails AA */
.text { color: #767676; }

/* After: 4.5:1 contrast — passes AA */
.text { color: #595959; }
```

## Fix: Keyboard Navigation

```javascript
class AccessibleDropdown extends HTMLElement {
  connectedCallback() {
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'combobox');
    this.setAttribute('aria-expanded', 'false');

    this.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          this.toggle();
          e.preventDefault();
          break;
        case 'Escape':
          this.close();
          break;
        case 'ArrowDown':
          this.focusNext();
          e.preventDefault();
          break;
        case 'ArrowUp':
          this.focusPrevious();
          e.preventDefault();
          break;
      }
    });
  }
}
```

## Fix: Modal Focus Management

```html
<!-- Accessible modal structure -->
<div role="dialog"
     aria-modal="true"
     aria-labelledby="dialog-title"
     aria-describedby="dialog-desc">
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-desc">This action cannot be undone.</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

```javascript
function openModal(modal) {
  lastFocus = document.activeElement;
  modal.querySelector('h2').focus();
  modal.addEventListener('keydown', trapFocus);
}

function closeModal(modal) {
  lastFocus.focus();
}

function trapFocus(e) {
  if (e.key === 'Tab') {
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
  if (e.key === 'Escape') closeModal(modal);
}
```

## Fix: Live Regions

```html
<!-- Status messages (polite — announces after current speech) -->
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- Updates announced politely -->
</div>

<!-- Alerts (assertive — interrupts current speech) -->
<div role="alert" aria-live="assertive">
  <!-- Updates interrupt immediately -->
</div>

<!-- Progress bar -->
<div role="progressbar"
     aria-valuenow="75"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-label="Upload progress">
</div>

<!-- Log (additions only, removals not announced) -->
<div role="log" aria-live="polite" aria-relevant="additions">
</div>
```

## Fix: Tab Interface

```html
<div role="tablist" aria-label="Product information">
  <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1">
    Description
  </button>
  <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2" tabindex="-1">
    Reviews
  </button>
</div>

<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  Product description content...
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  Reviews content...
</div>
```

```javascript
// Arrow key navigation within tablist
tablist.addEventListener('keydown', (e) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement);
  let newIndex;

  switch (e.key) {
    case 'ArrowRight': newIndex = (index + 1) % tabs.length; break;
    case 'ArrowLeft': newIndex = (index - 1 + tabs.length) % tabs.length; break;
    case 'Home': newIndex = 0; break;
    case 'End': newIndex = tabs.length - 1; break;
    default: return;
  }

  tabs[newIndex].focus();
  activateTab(tabs[newIndex]);
  e.preventDefault();
});
```

## Debugging: What the Screen Reader Sees

```javascript
function logAccessibleName(element) {
  const computed = window.getComputedStyle(element);
  console.log({
    role: element.getAttribute('role') || element.tagName,
    name:
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent,
    state: {
      expanded: element.getAttribute('aria-expanded'),
      selected: element.getAttribute('aria-selected'),
      checked: element.getAttribute('aria-checked'),
      disabled: element.disabled,
    },
    visible: computed.display !== 'none' && computed.visibility !== 'hidden',
  });
}
```
