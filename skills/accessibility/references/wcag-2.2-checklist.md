# WCAG 2.2 Audit Checklist

Full checklist of Level A and AA criteria with inline HTML/CSS examples. Consult during a remediation pass; not all of this loads on every skill invocation.

---

## Perceivable (Principle 1)

### 1.1 Text Alternatives

**1.1.1 Non-text Content (Level A)**
- [ ] All images have alt text
- [ ] Decorative images have `alt=""`
- [ ] Complex images have long descriptions
- [ ] Icons with meaning have accessible names
- [ ] CAPTCHAs have alternatives

```html
<!-- Good -->
<img src="chart.png" alt="Sales increased 25% from Q1 to Q2" />
<img src="decorative-line.png" alt="" />

<!-- Bad -->
<img src="chart.png" />
<img src="decorative-line.png" alt="decorative line" />
```

### 1.2 Time-based Media

**1.2.1 Audio-only and Video-only (Level A)**
- [ ] Audio has text transcript
- [ ] Video has audio description or transcript

**1.2.2 Captions (Level A)**
- [ ] All video has synchronized captions
- [ ] Captions are accurate, complete, with speaker identification

**1.2.3 Audio Description (Level A)**
- [ ] Video has audio description for visual content

### 1.3 Adaptable

**1.3.1 Info and Relationships (Level A)**
- [ ] Headings use proper tags (h1–h6)
- [ ] Lists use `ul`/`ol`/`dl`
- [ ] Tables have headers
- [ ] Form inputs have labels
- [ ] ARIA landmarks present

```html
<!-- Heading hierarchy -->
<h1>Page Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
<h2>Another Section</h2>

<!-- Table headers -->
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Price</th>
    </tr>
  </thead>
</table>
```

**1.3.2 Meaningful Sequence (Level A)**
- [ ] Reading order is logical
- [ ] CSS positioning doesn't break order
- [ ] Focus order matches visual order

**1.3.3 Sensory Characteristics (Level A)**
- [ ] Instructions don't rely on shape/color alone
- [ ] "Click the red button" → "Click Submit (red button)"

### 1.4 Distinguishable

**1.4.1 Use of Color (Level A)**
- [ ] Color is not the only means of conveying info
- [ ] Links distinguishable without color
- [ ] Error states not color-only

**1.4.3 Contrast Minimum (Level AA)**
- [ ] Text: 4.5:1 contrast ratio
- [ ] Large text (18pt+ or 14pt bold): 3:1 ratio
- [ ] UI components: 3:1 ratio

Tools: WebAIM Contrast Checker, axe DevTools

**1.4.4 Resize Text (Level AA)**
- [ ] Text resizes to 200% without loss
- [ ] No horizontal scrolling at 320px
- [ ] Content reflows properly

**1.4.10 Reflow (Level AA)**
- [ ] Content reflows at 400% zoom
- [ ] No two-dimensional scrolling
- [ ] All content accessible at 320px width

**1.4.11 Non-text Contrast (Level AA)**
- [ ] UI components have 3:1 contrast
- [ ] Focus indicators visible
- [ ] Graphical objects distinguishable

**1.4.12 Text Spacing (Level AA)**
- [ ] No content loss with increased spacing
- [ ] Line height 1.5x font size
- [ ] Paragraph spacing 2x font size
- [ ] Letter spacing 0.12x font size
- [ ] Word spacing 0.16x font size

---

## Operable (Principle 2)

### 2.1 Keyboard Accessible

**2.1.1 Keyboard (Level A)**
- [ ] All functionality keyboard accessible
- [ ] No keyboard traps
- [ ] Tab order is logical
- [ ] Custom widgets are keyboard operable

```html
<!-- Custom button must be keyboard accessible -->
<div role="button" tabindex="0"
     onkeydown="if(event.key === 'Enter' || event.key === ' ') activate()">
  Action
</div>
```

**2.1.2 No Keyboard Trap (Level A)**
- [ ] Focus can move away from all components
- [ ] Modal dialogs trap focus correctly
- [ ] Focus returns after modal closes

### 2.2 Enough Time

**2.2.1 Timing Adjustable (Level A)**
- [ ] Session timeouts can be extended
- [ ] User warned before timeout
- [ ] Option to disable auto-refresh

**2.2.2 Pause, Stop, Hide (Level A)**
- [ ] Moving content can be paused
- [ ] Auto-updating content can be paused
- [ ] Animations respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

### 2.3 Seizures and Physical Reactions

**2.3.1 Three Flashes (Level A)**
- [ ] No content flashes more than 3 times/second
- [ ] Flashing area is small (<25% viewport)

### 2.4 Navigable

**2.4.1 Bypass Blocks (Level A)**
- [ ] Skip to main content link present
- [ ] Landmark regions defined
- [ ] Proper heading structure

```html
<a href="#main" class="skip-link">Skip to main content</a>
<main id="main">...</main>
```

**2.4.2 Page Titled (Level A)**
- [ ] Unique, descriptive page titles
- [ ] Title reflects page content

**2.4.3 Focus Order (Level A)**
- [ ] Focus order matches visual order
- [ ] `tabindex` used correctly (avoid positive integers)

**2.4.4 Link Purpose (Level A)**
- [ ] Links make sense out of context
- [ ] No "click here" or "read more" alone

```html
<!-- Bad -->
<a href="report.pdf">Click here</a>

<!-- Good -->
<a href="report.pdf">Download Q4 Sales Report (PDF)</a>
```

**2.4.6 Headings and Labels (Level AA)**
- [ ] Headings describe content
- [ ] Labels describe purpose

**2.4.7 Focus Visible (Level AA)**
- [ ] Focus indicator visible on all elements
- [ ] Custom focus styles meet 3:1 contrast

```css
:focus {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

**2.4.11 Focus Not Obscured (Level AA) — WCAG 2.2**
- [ ] Focused element not fully hidden behind sticky headers
- [ ] Sticky headers account for focus indicator position

---

## Understandable (Principle 3)

### 3.1 Readable

**3.1.1 Language of Page (Level A)**
- [ ] HTML `lang` attribute set and correct

```html
<html lang="en">
```

**3.1.2 Language of Parts (Level AA)**
- [ ] Language changes marked with `lang` attribute

```html
<p>The French word <span lang="fr">bonjour</span> means hello.</p>
```

### 3.2 Predictable

**3.2.1 On Focus (Level A)**
- [ ] No context change on focus alone
- [ ] No unexpected popups on focus

**3.2.2 On Input (Level A)**
- [ ] No automatic form submission
- [ ] User warned before context change

**3.2.3 Consistent Navigation (Level AA)**
- [ ] Navigation consistent across pages
- [ ] Repeated components in same order

**3.2.4 Consistent Identification (Level AA)**
- [ ] Same functionality has same label
- [ ] Icons used consistently

### 3.3 Input Assistance

**3.3.1 Error Identification (Level A)**
- [ ] Errors clearly identified
- [ ] Error message describes the problem
- [ ] Error linked to the field

```html
<input aria-describedby="email-error" aria-invalid="true" />
<span id="email-error" role="alert">Please enter a valid email address</span>
```

**3.3.2 Labels or Instructions (Level A)**
- [ ] All inputs have visible labels
- [ ] Required fields indicated
- [ ] Format hints provided

**3.3.3 Error Suggestion (Level AA)**
- [ ] Errors include specific correction suggestion

**3.3.4 Error Prevention (Level AA)**
- [ ] Legal/financial forms reversible
- [ ] Data checked before submission
- [ ] User can review before submit

---

## Robust (Principle 4)

### 4.1 Compatible

**4.1.1 Parsing (Level A) — Obsolete in WCAG 2.2**
- [ ] Valid HTML (good practice regardless)
- [ ] No duplicate IDs
- [ ] Complete start/end tags

**4.1.2 Name, Role, Value (Level A)**
- [ ] Custom widgets have accessible names
- [ ] ARIA roles are correct
- [ ] State changes are announced

```html
<!-- Accessible custom checkbox -->
<div role="checkbox"
     aria-checked="false"
     tabindex="0"
     aria-labelledby="label">
</div>
<span id="label">Accept terms</span>
```

**4.1.3 Status Messages (Level AA)**
- [ ] Status updates announced via live regions
- [ ] Live regions used correctly (polite vs. assertive)

```html
<div role="status" aria-live="polite">3 items added to cart</div>
<div role="alert" aria-live="assertive">Error: Form submission failed</div>
```
