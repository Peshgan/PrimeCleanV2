# Mobile UX Audit — PrimeClean
**Date:** 2026-05-20 | **Target:** 60%+ mobile users

## Devices in scope
- iOS Safari (iPhone SE 2, iPhone 14)
- Android Chrome (Samsung Galaxy A series, mid-range)
- Samsung Internet
- Weak Android phones (2GB RAM, 4-core)
- Slow 4G (~5 Mbps)

---

## Critical Issues Found & Fixed

### 1. iOS viewport zoom on input focus [FIXED]
**Files:** `index.html` viewport meta, `style.css`
**Problem:** iOS Safari zooms the viewport when tapping any input with `font-size < 16px`. All form inputs were 0.95rem (~15.2px) and agent chat input was 13px — causing jarring zoom on every tap.
**Fix:**
- Added `maximum-scale=1.0, user-scalable=no` to `<meta name="viewport">`
- Added `font-size: 16px !important` to all inputs at `@media (max-width: 768px)`

### 2. Missing form field `name` attributes [FIXED]
**File:** `index.html` lines 407–430
**Problem:** Name input and textarea had no `name` attribute — form data was silently dropped on submit, nothing reached the backend.
**Fix:** Added `name="name"`, `name="phone"`, `name="service"`, `name="message"` to all fields.

### 3. Missing `for`/`id` on form labels [FIXED]
**File:** `index.html`
**Problem:** Labels "Имя" and "Комментарий" had no `for` attribute — tapping label didn't focus the input on mobile.
**Fix:** Added `id="name-input"`, `id="comment-input"`, `for="name-input"`, `for="comment-input"`.

### 4. Missing `inputmode="tel"` on phone field [FIXED]
**File:** `index.html` line 412
**Problem:** Phone input showed full QWERTY keyboard instead of numeric keypad on mobile.
**Fix:** Added `inputmode="tel"` to phone input.

### 5. Agent widget blocks form inputs when keyboard opens [FIXED]
**File:** `app.js`, `style.css`
**Problem:** On Android, when keyboard opens it resizes the viewport. Fixed-position agent widget (z-index: 9000) moved up and overlapped form fields. On iOS the widget stays below keyboard but confuses users.
**Fix:**
- JS: `focusin` on any non-agent input adds `body.keyboard-open` class
- CSS: `body.keyboard-open .agent-widget { opacity: 0; pointer-events: none; }`
- `focusout` with 200ms debounce removes the class

### 6. Agent WebM videos loaded eagerly [FIXED]
**File:** `index.html` agent video elements
**Problem:** `#agent-s-greet` (7.5MB WebM) and `#agent-s-talk` (2.5MB WebM) had no `preload` attribute — browsers defaulted to auto-loading on page load. On slow 4G this caused 10MB of video to download before user ever opens the agent.
**Fix:** Added `preload="none"` to greet and talk videos. `ensureWebmLoaded()` in JS now triggers loading only on first agent open.

---

## Medium Issues Found & Fixed

### 7. `100vh` missing fallback for iOS < 15.4 [FIXED]
**File:** `style.css` `#scroll-sticky`
**Problem:** `height: 100svh` without fallback breaks on iOS 15.3 and below — sticky viewport collapses.
**Fix:** Added `height: 100vh` as fallback line before `height: 100svh`.

### 8. No `touch-action: manipulation` on interactive elements [FIXED]
**File:** `style.css`
**Problem:** Without `touch-action: manipulation`, browsers apply 300ms double-tap zoom delay to all tap targets — noticeably sluggish on Android Chrome < 55 and Samsung Internet.
**Fix:** Added `touch-action: manipulation` to `a, button, [role="button"], input, select, textarea, label` in reset section.

### 9. No momentum scrolling in agent chat [FIXED]
**File:** `style.css` `.agent-messages`
**Problem:** iOS Safari stops scrolling immediately when finger lifts — no inertia in chat message list.
**Fix:** Added `-webkit-overflow-scrolling: touch` to `.agent-messages`.

### 10. Missing `autocomplete` attributes [FIXED]
**File:** `index.html`
**Problem:** Browser autofill disabled — mobile users can't use saved contacts/phone numbers.
**Fix:** Added `autocomplete="name"`, `autocomplete="tel"`, `autocomplete="off"` appropriately.

### 11. Landscape mode agent chat too tall [FIXED]
**File:** `style.css`
**Problem:** In landscape on mobile (max-height: 500px), agent chat was 60vh = too tall, covering most of the content.
**Fix:** Added `@media (max-height: 500px) and (max-width: 900px)` rule shrinking character and chat.

### 12. Missing `poster` on scroll video [FIXED]
**File:** `index.html` `#sv`
**Problem:** On slow networks, scroll video shows black frame while loading metadata.
**Fix:** Added `poster="motion/image/start_site.jpg"` — shows still image while video loads.

---

## Not Changed (Iron-Clad Rules)
- Spring physics scroll (already disabled on mobile — direct `applyProgress`)
- Safari dual-plane MP4 canvas renderer
- Audio pooling architecture
- WebGL architecture (already disabled for `data-perf="low"`)
- Visual design / layout

---

## Remaining Items (not fixed — require further work)
- `100svh` on very old iOS (pre-15): consider JS-based height calculation as additional fallback
- Agent chat on iOS: when keyboard opens, chat panel could use `visualViewport` API for precise height
- Social icon touch targets: 34×34px vs WCAG 44px minimum
