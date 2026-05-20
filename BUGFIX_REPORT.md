# Bug Fix Report — PrimeClean
**Date:** 2026-05-20 | Mobile UX + Cross-browser pass

---

## Fixes Applied

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **Critical** | `index.html` | All form inputs missing `name` attribute — data never reached backend | Added `name="name/phone/service/message"` |
| 2 | **Critical** | `index.html` + `style.css` | iOS Safari zooms viewport on input focus (font-size < 16px) | `maximum-scale=1.0, user-scalable=no` in viewport + `font-size: 16px` on inputs at ≤768px |
| 3 | **High** | `index.html` | Agent WebM (10MB) auto-downloaded on page load | Added `preload="none"` to `#agent-s-greet` and `#agent-s-talk` |
| 4 | **High** | `app.js` | Agent widget blocks form inputs when mobile keyboard opens | Added `focusin/focusout` listeners that toggle `body.keyboard-open` class |
| 5 | **High** | `style.css` | `height: 100svh` with no fallback — breaks `#scroll-sticky` on iOS < 15.4 | Added `height: 100vh` fallback line |
| 6 | **High** | `index.html` | Phone input shows QWERTY instead of numeric keypad | Added `inputmode="tel"` |
| 7 | **High** | `index.html` | Labels "Имя" and "Комментарий" had no `for` → tap label didn't focus input | Added `for="name-input"` and `for="comment-input"` |
| 8 | **Medium** | `app.js` | `ctx.filter='blur(8px)'` ran every RAF frame on all devices (expensive mobile GPU) | Wrapped in `if (PERF === 'high')` |
| 9 | **Medium** | `app.js` | 130 confetti particles on success overlay crashed iPhone SE | `PARTICLE_COUNT` now PERF-adaptive: 40/60/130 |
| 10 | **Medium** | `style.css` | No `touch-action: manipulation` — 300ms tap delay on Android Chrome | Added to reset section for all interactive elements |
| 11 | **Medium** | `style.css` | No `-webkit-overflow-scrolling: touch` on chat messages — no iOS momentum | Added to `.agent-messages` |
| 12 | **Medium** | `index.html` | Missing `autocomplete` on form fields — broken autofill on mobile | Added `autocomplete="name/tel/off"` |
| 13 | **Low** | `index.html` | Scroll video `#sv` showed black frame on slow network while loading | Added `poster="motion/image/start_site.jpg"` |
| 14 | **Low** | `app.js` | `ensureWebmLoaded()` used `!v.src` which is unreliable for `<source>` elements | Changed to `v.readyState === 0` check |
| 15 | **Low** | `style.css` | Agent chat + character too tall in landscape mobile | Added `@media (max-height: 500px)` shrink rules |
| 16 | **Low** | `app.js` | No error logging — silent JS failures impossible to debug | Added `window.onerror` + `unhandledrejection` → `sessionStorage['pc_errors']` |

---

## Known Issues Not Fixed (scope/risk)

| Issue | Reason not fixed |
|-------|-----------------|
| LCP > 2.5s (preloader video 1MB) | Requires preloader redesign — out of scope |
| Best Practices 79 (GA/YM third-party cookies) | Can't fix without removing analytics |
| Safari canvas `visibilitychange` pause | Low risk, complex refactor |
| Social icon touch targets < 44px (34px) | Would change visual design |
| `100svh` broken on iOS < 15.3 (pre-2021) | Very small audience, JS fix complex |

---

## Previously Fixed (prior session 2026-05-20)
- `<video id="sv">` missing `>` before `<source>` — scroll video broken in some browsers
- Accessibility 89 → 100 (color contrast, label, select, tap targets)
- SEO 92 → 100 (robots.txt, defer analytics)
- LCP 11.7s → 4.2s (WebP responsive images, async fonts, deferred analytics)
- Performance 74 → 83 (multiple optimizations)
