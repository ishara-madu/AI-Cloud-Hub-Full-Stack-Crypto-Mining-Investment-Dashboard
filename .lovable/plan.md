
## Root Cause

The notification detail popup in `Notifications.tsx` uses:
```css
position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)
```

This **should** work for true viewport centering, but the issue is that `AppLayout.tsx` wraps all page content in:
```tsx
<main className="flex-1 pb-20 overflow-y-auto">
```

The page scroll happens **inside `<main>`**, not at the `window` level. When a `position: fixed` element is inside a scroll container that has `overflow-y: auto`, the fixed positioning works relative to the scroll container's visual bounds — meaning `top: 50%` can appear offset when the user has scrolled down.

Additionally, the modal `<div>` in `Notifications.tsx` is rendered **inside** the scrollable `<div className="animate-fade-in">` wrapper, which is a child of `<main>`. This means the fixed overlay backdrop (`position: fixed; inset: 0`) covers the viewport correctly, but the modal card position gets affected by the scroll offset.

## Fix Strategy

Two changes needed:

### 1. `src/pages/Notifications.tsx` — Move modal outside scroll flow using a portal-like approach

Move the modal so it uses `position: fixed` with `50vh` (viewport height units) instead of `50%`. Using `50vh` always refers to half the real visible screen height, unaffected by any scroll container. Also switch the backdrop and modal to render at the very end of the component, **outside** any container divs that participate in the layout flow.

**Change:**
```tsx
// Before
style={{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  ...
}}

// After — use 50vh instead of 50%
style={{
  position: 'fixed',
  top: '50vh',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  ...
}}
```

Also wrap the entire modal (backdrop + card) in a React Fragment and place it **after** the main scrollable content div, ensuring it sits at the root level of the component return, not nested inside the content container.

### 2. `src/components/AppLayout.tsx` — Ensure fixed elements target real viewport

The `<main>` tag currently has `overflow-y-auto`. This creates a new scroll context. To ensure `position: fixed` children always anchor to the true viewport, the scroll should remain at the `window` level rather than inside a container.

Change `<main>` from `overflow-y-auto` to let the body/window scroll naturally. This means removing `overflow-y-auto` from `<main>` and ensuring the outer wrapper doesn't clip.

**Change:**
```tsx
// Before
<main className="flex-1 pb-20 overflow-y-auto">

// After
<main className="flex-1 pb-20">
```

This ensures that all `position: fixed` elements (modal overlays, bottom nav, headers) anchor correctly to the visible screen — not to a scroll container.

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/Notifications.tsx` | Use `top: 50vh` in modal style + restructure modal to be outside content div |
| `src/components/AppLayout.tsx` | Remove `overflow-y-auto` from `<main>` |

## Impact Assessment

- Removing `overflow-y-auto` from `<main>` makes the page scroll at the window level — this is the standard web behavior and will not break any other pages. All other sticky/fixed elements (top header, bottom nav) already use `position: sticky` and `position: fixed` which work correctly with window-level scrolling.
- Using `50vh` for the modal top position guarantees it's always centered on the visible screen regardless of how far the user has scrolled.
- No database changes needed.
- Admin section is unaffected.
