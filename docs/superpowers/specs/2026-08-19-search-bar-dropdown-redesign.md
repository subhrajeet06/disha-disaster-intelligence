# Search Bar Dropdown Redesign & Selection Animation

**Date:** 2026-08-19
**Status:** Approved for implementation

---

## Overview

Redesign the search bar dropdown with a "soft & minimal" visual direction and add a "background flash + fade" selection animation (~800ms total).

---

## 1. Dropdown Visual Styling — Soft & Minimal

### Container
- **Shadow:** `shadow-md` with `shadow-black/10` (was `shadow-2xl shadow-black/15`)
- **Border radius:** `rounded-2xl` (was `rounded-3xl`)
- **Border:** `border border-edge/50` (was `border border-edge`)
- **Background:** `bg-panel/95 backdrop-blur-sm` (was `bg-panel`)

### Category Headers
- **Font weight:** `font-bold` (was `font-extrabold`)
- **Color:** `text-ink-faint/80` (was `text-ink-faint`)
- **Gap:** `gap-1` (was `gap-1.5`)
- **Padding:** `px-3 pt-2 pb-1` (unchanged)

### Items
- **Padding:** `px-4 py-2.5` (was `px-3 py-2`)
- **Border radius:** `rounded-xl` (was `rounded-[18px]`)
- **Hover:** `hover:bg-panel-tint/50` (was `hover:bg-panel-soft`)
- **Active (keyboard):** `bg-panel-tint/50` (was `bg-panel-tint`)

### Icon Containers
- **Size:** `w-8 h-8` (was `w-9 h-9`)
- **Border radius:** `rounded-lg` (was `rounded-[13px]`)
- **Background opacity:** `opacity-90` added

### Score Badge
- **Background:** `bg-panel-tint/60` (was `bg-panel-soft`)
- **Padding:** `px-1.5 py-0.5` (was `px-2 py-1`)
- **Border radius:** `rounded-full` (unchanged)

### Empty State
- **Icon container:** `w-8 h-8 rounded-xl` (was `w-10 h-10 rounded-2xl`)
- **Spacing:** `gap-1.5` (was `gap-2`)

---

## 2. Selection Animation — Background Flash + Fade

### Timing
- **Flash phase:** 300ms
- **Fade phase:** 500ms
- **Total:** ~800ms

### Animation Sequence
1. User clicks item → `select()` called
2. Set `selectedEntryId` state to clicked entry's ID
3. **Flash (300ms):** Dropdown background animates `bg-primary/15` via CSS keyframes
4. **Fade (500ms):** Selected item animates `opacity-0 scale-95` via CSS keyframes
5. On animation end: Execute existing selection logic (focus location, clear query, close dropdown)
6. Clear `selectedEntryId`

### CSS Keyframes
```css
@keyframes dropdown-flash {
  0% { background-color: var(--color-panel); }
  50% { background-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-panel)); }
  100% { background-color: var(--color-panel); }
}

@keyframes item-fade-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}
```

### Applied Classes
- **Dropdown during flash:** `animate-dropdown-flash` (300ms ease-out)
- **Selected item during fade:** `animate-item-fade-out` (500ms ease-in)

---

## 3. Implementation Notes

### State Additions
- `selectedEntryId: string | null` — tracks which item is animating out

### Modified Functions
- `select(e)` — sets `selectedEntryId`, starts animation, defers actual navigation
- New `useEffect` watching `selectedEntryId` to trigger post-animation logic

### Files to Modify
- `src/components/layout/SearchBar.tsx` — main implementation
- `src/index.css` — add animation keyframes

---

## 4. Accessibility
- Animation respects `prefers-reduced-motion` — skip flash/fade, execute immediately
- Focus management preserved (dropdown closes, input blurs)
- Screen readers: no change to ARIA attributes

---

## 5. Testing Checklist
- [ ] Dropdown opens/closes correctly
- [ ] Keyboard navigation (ArrowUp/Down, Enter, Escape) works
- [ ] Click selection triggers flash + fade animation
- [ ] Animation completes and navigates to location
- [ ] `prefers-reduced-motion` disables animation
- [ ] Dark mode renders correctly
- [ ] Mobile overlay works identically
- [ ] No layout shift during animation