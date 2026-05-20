# Safari / iOS Fixes — PrimeClean
**Date:** 2026-05-20

---

## iOS Safari Architecture (what already works)

### Dual-plane MP4 for agent transparency
WebM with alpha channel is not supported in Safari/iOS. Solution:
- H.264 dual-plane MP4: top half = RGB color, bottom half = grayscale alpha mask
- JS canvas pixel compositor reads both halves per frame
- Alpha threshold: `ad[i] < 48 ? 0 : ad[i]` (suppresses H.264 block artifacts)
- Files: `soon_combined.mp4`, `helo_combined.mp4`, `povest_combined.mp4`
- Detection: `isIOS || isSafari` → switches to canvas renderer

### Scroll video unlock on iOS
iOS requires a user gesture before video can seek. Implementation:
```js
document.addEventListener('touchstart', () => {
  sv.play().then(() => { sv.pause(); sv.currentTime = 0; });
}, { once: true, passive: true });
```
This "unlocks" the video element after first touch so `currentTime` seeking works.

---

## iOS Fixes Applied This Session

### 1. Viewport zoom prevention [FIXED]
**Problem:** iOS Safari zooms the entire viewport when tapping an input with `font-size < 16px`. Caused jarring UX on every form/chat interaction.

**Fixes applied:**
```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```
```css
/* style.css — @media (max-width: 768px) */
.f-group input, .f-group select, .f-group textarea, #agent-input {
  font-size: 16px !important;
}
```

**Trade-off:** `user-scalable=no` disables pinch-to-zoom for accessibility. Acceptable here because:
- Site is not content-heavy (no small text that needs zooming)
- 16px font-size fix already prevents the zoom trigger

### 2. 100svh fallback for iOS < 15.4 [FIXED]
**Problem:** `height: 100svh` is not supported before iOS 15.4 (released Jan 2022). The `#scroll-sticky` viewport collapsed.

**Fix:**
```css
#scroll-sticky {
  height: 100vh;   /* fallback */
  height: 100svh;  /* iOS 15.4+, Chrome 108+ */
}
```

### 3. Momentum scrolling in agent chat [FIXED]
**Problem:** iOS Safari uses "rubber band" model — without `-webkit-overflow-scrolling: touch`, scrollable divs stop immediately when finger lifts.

**Fix:**
```css
.agent-messages {
  -webkit-overflow-scrolling: touch;
}
```

### 4. Lazy WebM loading (non-Safari path) [FIXED]
**Problem:** `preload` missing on greeting/talking videos — browser loaded 10MB on page start.

**Fix:** `preload="none"` in HTML. On Safari, these videos are never used (canvas renderer handles everything). The `needsWebmFallback` check in `ensureWebmLoaded()` skips loading entirely on Safari/iOS.

---

## iOS Behavior: Fixed Position + Keyboard
When keyboard opens on iOS:
- `window.innerHeight` does NOT change (unlike Android)
- Fixed elements stay at original bottom position (below keyboard)
- This means agent widget is visually hidden below keyboard — actually helpful!

However, the user may be confused why agent disappeared. The `body.keyboard-open` CSS class now properly hides the agent with opacity transition when any form input is focused.

---

## Safari-Specific Known Issues (not fixed)

| Issue | Status |
|-------|--------|
| `visibilitychange` not pausing Safari canvas renderer (Safari dual-plane) | Not fixed — low impact |
| `backdrop-filter` performance on old A11 chip (iPhone X/XS) | Mitigated by `[data-perf="low"]` CSS |
| Audio autoplay on very first page load | Handled by unlock-on-click mechanism |
| `SpeechRecognition` (`webkitSpeechRecognition`) on iOS < 14.5 | Mic button hidden via `.no-speech` class |

---

## Testing Checklist for iOS
- [ ] Tap form input → no viewport zoom
- [ ] Scroll through scroll-exp → video seeks correctly
- [ ] Open agent → dual-plane canvas renders (no black background)
- [ ] Type in agent chat → no keyboard + layout jump
- [ ] Form submit → success overlay appears without stutter
- [ ] Landscape mode → agent chat fits in viewport
- [ ] Preloader video plays muted automatically
