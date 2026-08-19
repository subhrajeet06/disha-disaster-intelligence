# Search Bar Dropdown Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the search bar dropdown with soft/minimal styling and add a background flash + fade selection animation (~800ms total).

**Architecture:** Modify the existing SearchBar.tsx component to add selection animation state, update dropdown/item styling to soft/minimal design, add CSS keyframes for flash/fade animations in index.css. The animation sequence: click → set selectedEntryId → flash dropdown background (300ms) → fade selected item (500ms) → execute navigation → clear state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Lucide React icons

## Global Constraints

- Animation timing: Flash 300ms ease-out, Fade 500ms ease-in, Total ~800ms
- Respect `prefers-reduced-motion` — skip animations, execute immediately
- Dark mode must render correctly with existing color tokens
- Mobile overlay must behave identically to desktop
- No layout shift during animation
- Preserve existing keyboard navigation (ArrowUp/Down, Enter, Escape)
- Preserve existing ARIA attributes and accessibility

---

### Task 1: Add CSS Animation Keyframes

**Files:**
- Modify: `src/index.css:109-120` (insert after existing @keyframes)

**Interfaces:**
- Produces: CSS keyframes `dropdown-flash` and `item-fade-out` available globally

- [ ] **Step 1: Add keyframes to index.css**

```css
@keyframes dropdown-flash {
  0% {
    background-color: var(--color-panel);
  }
  50% {
    background-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-panel));
  }
  100% {
    background-color: var(--color-panel);
  }
}

@keyframes item-fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-dropdown-flash,
  .animate-item-fade-out {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Add utility classes for animations**

```css
.animate-dropdown-flash {
  animation: dropdown-flash 300ms ease-out forwards;
}

.animate-item-fade-out {
  animation: item-fade-out 500ms ease-in forwards;
}
```

- [ ] **Step 3: Verify CSS compiles**

Run: `npm run build` (or equivalent build command)
Expected: No CSS errors

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: add dropdown flash and item fade-out animations"
```

---

### Task 2: Add Selection Animation State to SearchBar

**Files:**
- Modify: `src/components/layout/SearchBar.tsx:96-170` (add state and modify select function)

**Interfaces:**
- Consumes: `select` function from existing code
- Produces: `selectedEntryId` state, modified `select` function that triggers animation

- [ ] **Step 1: Add selectedEntryId state**

```tsx
const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
```

Place after line 103 (after `activeIndex` state)

- [ ] **Step 2: Modify select function to trigger animation**

```tsx
const select = (e: SearchEntry) => {
  setSelectedEntryId(e.id)
  // Actual navigation deferred to useEffect
}
```

Replace existing `select` function (lines 163-170)

- [ ] **Step 3: Add useEffect to handle post-animation navigation**

```tsx
useEffect(() => {
  if (!selectedEntryId) return
  const entry = flat.find((e) => e.id === selectedEntryId)
  if (!entry) {
    setSelectedEntryId(null)
    return
  }
  // Wait for fade animation (500ms) + small buffer
  const t = setTimeout(() => {
    focusLocation(entry.id, entry.lat, entry.lng)
    setQuery('')
    setOpen(false)
    setMobileOpen(false)
    desktopRef.current?.blur()
    mobileRef.current?.blur()
    setSelectedEntryId(null)
  }, 550)
  return () => clearTimeout(t)
}, [selectedEntryId, flat, focusLocation])
```

Add after the existing useEffect hooks (around line 161)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "feat: add selection animation state and deferred navigation"
```

---

### Task 3: Apply Soft/Minimal Dropdown Container Styling

**Files:**
- Modify: `src/components/layout/SearchBar.tsx:235-239` (dropdown container classes)

**Interfaces:**
- Consumes: None
- Produces: Updated dropdown container with soft/minimal styling

- [ ] **Step 1: Update dropdown container classes**

```tsx
const dropdown = open ? (
  <div
    id="search-results"
    className={`max-h-[min(58vh,420px)] overflow-y-auto scroll-thin rounded-2xl border border-edge/50 bg-panel/95 backdrop-blur-sm shadow-md shadow-black/10 p-1.5 ${
      selectedEntryId ? 'animate-dropdown-flash' : ''
    }`}
  >
```

Replace lines 235-239

- [ ] **Step 2: Verify dropdown renders correctly**

Run dev server, open search, verify styling
Expected: Softer shadow, rounded-2xl, semi-transparent bg with blur

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "feat: apply soft/minimal dropdown container styling"
```

---

### Task 4: Update Category Header Styling

**Files:**
- Modify: `src/components/layout/SearchBar.tsx:254-261` (category header rendering)

**Interfaces:**
- Consumes: None
- Produces: Updated category headers with softer styling

- [ ] **Step 1: Update category header classes**

```tsx
<div className="px-3 pt-2 pb-1 flex items-center gap-1">
  <cat.icon className={`w-3.5 h-3.5 ${cat.iconText}/80`} />
  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint/80">
    {cat.label}
  </span>
  <span className="text-[9px] font-bold text-ink-faint/60">· {g.entries.length}</span>
</div>
```

Replace lines 254-261

- [ ] **Step 2: Verify category headers**

Run dev server, search for something with multiple categories
Expected: Lighter weight text, softer colors, tighter gap

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "feat: update category header styling to soft/minimal"
```

---

### Task 5: Update Search Result Item Styling

**Files:**
- Modify: `src/components/layout/SearchBar.tsx:262-289` (item rendering loop)

**Interfaces:**
- Consumes: `selectedEntryId` state, `activeIndex` state
- Produces: Updated item buttons with soft/minimal styling and fade animation

- [ ] **Step 1: Update item button classes**

```tsx
<button
  key={`${g.key}-${e.id}`}
  onMouseEnter={() => setActiveIndex(idx)}
  onClick={() => select(e)}
  className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors duration-150 ${
    idx === activeIndex
      ? 'bg-panel-tint/50'
      : 'hover:bg-panel-tint/50'
  } ${selectedEntryId === e.id ? 'animate-item-fade-out pointer-events-none' : ''}`}
  disabled={selectedEntryId === e.id}
>
```

Replace lines 265-271

- [ ] **Step 2: Update icon container styling**

```tsx
<span
  className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 opacity-90 ${cat.iconBg} ${cat.iconText}`}
>
  <cat.icon className="w-4 h-4" />
</span>
```

Replace lines 273-277

- [ ] **Step 3: Update score badge styling**

```tsx
<span className="shrink-0 text-[10px] font-extrabold tabular-nums rounded-full bg-panel-tint/60 text-primary px-1.5 py-0.5">
  {e.score}
</span>
```

Replace lines 284-286

- [ ] **Step 4: Verify item styling**

Run dev server, search, hover/keyboard navigate items
Expected: Rounded-xl, softer hover, smaller icon containers, softer score badge

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "feat: update search result item styling to soft/minimal"
```

---

### Task 6: Update Empty State Styling

**Files:**
- Modify: `src/components/layout/SearchBar.tsx:240-248` (empty state rendering)

**Interfaces:**
- Consumes: None
- Produces: Updated empty state with softer styling

- [ ] **Step 1: Update empty state classes**

```tsx
<div className="px-4 py-7 flex flex-col items-center gap-1.5 text-center">
  <span className="w-8 h-8 rounded-xl bg-panel-soft flex items-center justify-center">
    <Search className="w-5 h-5 text-ink-faint" />
  </span>
  <p className="text-sm font-bold text-ink">No matches</p>
  <p className="text-xs text-ink-faint/80">Try "roads", "critical" or a place name.</p>
</div>
```

Replace lines 240-248

- [ ] **Step 2: Verify empty state**

Run dev server, search for non-matching query
Expected: Smaller icon container, tighter spacing, softer text

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "feat: update empty state styling to soft/minimal"
```

---

### Task 7: Test Animation Sequence & Reduced Motion

**Files:**
- Test: Manual verification in browser
- Modify: `src/components/layout/SearchBar.tsx` (if fixes needed)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working animation

- [ ] **Step 1: Test flash + fade animation**

Run dev server, search, click a result
Expected: Dropdown flashes primary/15%, selected item fades out, map navigates

- [ ] **Step 2: Test keyboard selection (Enter)**

Run dev server, search, arrow down to item, press Enter
Expected: Same animation as click

- [ ] **Step 3: Test prefers-reduced-motion**

In browser dev tools: Rendering → Emulate CSS prefers-reduced-motion: reduce
Search, click result
Expected: No flash/fade, immediate navigation

- [ ] **Step 4: Test dark mode**

Toggle dark mode, search, click result
Expected: Animation uses correct dark mode colors

- [ ] **Step 5: Test mobile overlay**

Mobile viewport, tap search icon, search, tap result
Expected: Same animation behavior as desktop

- [ ] **Step 6: Test no layout shift**

Observe dropdown during animation
Expected: No jumping, stable dimensions

- [ ] **Step 7: Commit any fixes**

```bash
git add src/components/layout/SearchBar.tsx
git commit -m "fix: animation timing/behavior adjustments"
```

---

### Task 8: Final Verification & Polish

**Files:**
- Verify: All modified files

**Interfaces:**
- Consumes: All previous tasks
- Produces: Complete feature

- [ ] **Step 1: Full regression test**

- Open/close dropdown (desktop + mobile)
- Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
- Click selection
- Clear button
- Global "/" shortcut
- Click outside to close
- Multiple rapid searches
- Empty state
- All categories represented

- [ ] **Step 2: TypeScript check**

Run: `npm run typecheck` (or `tsc --noEmit`)
Expected: No errors

- [ ] **Step 3: Lint check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete search bar dropdown redesign with selection animation"
```

---

## Spec Coverage Check

| Spec Section | Task(s) |
|--------------|---------|
| Dropdown container styling | Task 3 |
| Category headers | Task 4 |
| Items (padding, radius, hover, active, icons, score) | Task 5 |
| Empty state | Task 6 |
| Flash animation (300ms) | Task 1, 2, 3 |
| Fade animation (500ms) | Task 1, 2, 5 |
| prefers-reduced-motion | Task 1, 7 |
| Dark mode | Task 7 |
| Mobile overlay | Task 7 |
| Keyboard nav preserved | Task 7 |
| Accessibility preserved | Task 7 |
| No layout shift | Task 7 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-19-search-bar-dropdown-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**