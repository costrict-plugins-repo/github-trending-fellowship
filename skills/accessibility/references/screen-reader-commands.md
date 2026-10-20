# Screen Reader Commands

Command references for the four major screen readers. Consulted during manual SR testing passes.

## Coverage

| Screen Reader | Platform | Browser | Usage Share |
|---------------|----------|---------|-------------|
| **VoiceOver** | macOS/iOS | Safari | ~15% |
| **NVDA** | Windows | Firefox/Chrome | ~31% |
| **JAWS** | Windows | Chrome/IE | ~40% |
| **TalkBack** | Android | Chrome | ~10% |
| **Narrator** | Windows | Edge | ~4% |

**Minimum coverage:**
1. NVDA + Firefox (Windows) — highest real-world usage
2. VoiceOver + Safari (macOS) — likely your own setup
3. VoiceOver + Safari (iOS) — mobile

**Comprehensive coverage adds:** JAWS + Chrome, TalkBack + Chrome, Narrator + Edge

## Modes

| Mode | Purpose | When Used |
|------|---------|-----------|
| **Browse/Virtual** | Read content | Default reading |
| **Focus/Forms** | Interact with controls | Filling forms |
| **Application** | Custom widgets | ARIA `role="application"` |

---

## VoiceOver (macOS)

**Setup:**
```
Enable: System Preferences → Accessibility → VoiceOver
Toggle: Cmd + F5
Quick Toggle: Triple-press Touch ID
```

**Essential Commands:**
```
VO modifier = Ctrl + Option

Navigation:
VO + Right Arrow    Next element
VO + Left Arrow     Previous element
VO + Shift + Down   Enter group
VO + Shift + Up     Exit group

Reading:
VO + A              Read all from cursor
Ctrl                Stop speaking
VO + B              Read current paragraph

Interaction:
VO + Space          Activate element
VO + Shift + M      Open context menu
Tab                 Next focusable element
Shift + Tab         Previous focusable element

Rotor (VO + U):
Left/Right Arrow    Change rotor category (Headings, Links, Forms, Landmarks)
Up/Down Arrow       Navigate within category
Enter               Go to item

Web Quick Nav:
VO + Cmd + H        Next heading
VO + Cmd + J        Next form control
VO + Cmd + L        Next link
VO + Cmd + T        Next table
```

**VoiceOver Testing Checklist:**

Page Load:
- [ ] Page title announced
- [ ] Main landmark found
- [ ] Skip link works

Navigation:
- [ ] All headings discoverable via rotor
- [ ] Heading levels logical (H1 → H2 → H3)
- [ ] Landmarks properly labeled
- [ ] Skip links functional

Links & Buttons:
- [ ] Link purpose clear from name alone
- [ ] Button actions described
- [ ] New window/tab announced

Forms:
- [ ] All labels read with inputs
- [ ] Required fields announced
- [ ] Error messages read
- [ ] Instructions available
- [ ] Focus moves to errors on submit

Dynamic Content:
- [ ] Alerts announced immediately
- [ ] Loading states communicated
- [ ] Content updates announced via live regions
- [ ] Modals trap focus correctly

Tables:
- [ ] Headers associated with cells
- [ ] Table navigation works (VO + Cmd + T)
- [ ] Complex tables have captions

---

## NVDA (Windows)

**Setup:**
```
Download: nvaccess.org
Start: Ctrl + Alt + N
Stop: Insert + Q
```

**Essential Commands:**
```
NVDA modifier = Insert

Navigation:
Down Arrow          Next line
Up Arrow            Previous line
Tab                 Next focusable
Shift + Tab         Previous focusable

Reading:
NVDA + Down Arrow   Say all
Ctrl                Stop speech
NVDA + Up Arrow     Current line

Headings:
H                   Next heading
Shift + H           Previous heading
1–6                 Heading level 1–6

Forms:
F                   Next form field
B                   Next button
E                   Next edit field
X                   Next checkbox
C                   Next combo box

Links:
K                   Next link
U                   Next unvisited link
V                   Next visited link

Landmarks:
D                   Next landmark
Shift + D           Previous landmark

Tables:
T                   Next table
Ctrl + Alt + Arrows Navigate cells

Elements List:
NVDA + F7           All links, headings, form fields, landmarks
```

**Browse vs. Focus Mode:**
```
NVDA automatically switches modes:
- Browse Mode: Arrow keys navigate content
- Focus Mode: Arrow keys control interactive elements

Manual switch: NVDA + Space

Watch for:
- "Browse mode" announcement when navigating
- "Focus mode" when entering form fields
- Application role forces forms mode
```

**NVDA Test Script:**

Initial Load:
1. Navigate to page, let it finish loading
2. Press Insert + Down to read all
3. Note: page title announced? Main content identified?

Landmark Navigation:
1. Press D repeatedly
2. Check: All main areas reachable? Landmarks properly labeled?

Heading Navigation:
1. Press Insert + F7 → Headings
2. Check: Logical heading structure?
3. Press H to navigate — all sections discoverable?

Form Testing:
1. Press F to find first form field
2. Check: Label read with the input?
3. Fill in invalid data, submit
4. Check: Errors announced? Focus moved to error?

Interactive Elements:
1. Tab through all interactive elements
2. Check: Each announces role and state
3. Activate buttons with Enter/Space
4. Check: Result announced?

Dynamic Content:
1. Trigger content update — change announced?
2. Open modal — focus trapped?
3. Close modal — focus returns to trigger?

---

## JAWS (Windows)

**Essential Commands:**
```
Start: Desktop shortcut or Ctrl + Alt + J
Virtual Cursor auto-enabled in browsers

Navigation:
Arrow keys          Navigate content
Tab                 Next focusable
Insert + Down       Read all
Ctrl                Stop speech

Quick Keys:
H                   Next heading
T                   Next table
F                   Next form field
B                   Next button
G                   Next graphic
L                   Next list
;                   Next landmark

Forms Mode:
Enter               Enter forms mode
Numpad +            Exit forms mode
F5                  List form fields

Lists:
Insert + F7         Link list
Insert + F6         Heading list
Insert + F5         Form field list

Tables:
Ctrl + Alt + Arrows Table cell navigation
```

---

## TalkBack (Android)

**Setup:**
```
Enable: Settings → Accessibility → TalkBack
Toggle: Hold both volume buttons 3 seconds
```

**Gestures:**
```
Explore:            Drag finger across screen
Next:               Swipe right
Previous:           Swipe left
Activate:           Double tap
Scroll:             Two finger swipe

Reading Controls (swipe up then right to cycle):
- Headings
- Links
- Controls
- Characters / Words / Lines / Paragraphs
```
