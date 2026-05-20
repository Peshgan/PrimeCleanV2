# Performance Report — PrimeClean
**Date:** 2026-05-20 | **Baseline Lighthouse (post previous session):** Performance 83, LCP 4.2s

---

## Performance Tier System

`detectPerf()` returns `'low' | 'medium' | 'high'`:

| Condition | Tier |
|-----------|------|
| `prefers-reduced-motion` | low |
| `connection.saveData` or 2g/slow-2g | low |
| `deviceMemory ≤ 1GB` | low |
| `hardwareConcurrency ≤ 2` | low |
| `deviceMemory ≤ 2GB` | medium |
| `hardwareConcurrency ≤ 4` | medium |
| Connection is 3g | medium |
| `innerWidth < 480 && devicePixelRatio ≥ 2` | medium |
| Everything else | high |

**Applied via:** `document.body.dataset.perf = PERF`

---

## Issues Fixed This Session

### 1. Canvas butterfly `ctx.filter = 'blur(8px)'` on all devices [FIXED]
**File:** `app.js` butterfly `drawB()` function
**Problem:** `ctx.filter = 'blur(8px)'` runs every animation frame for each butterfly when sprites are used. On mobile GPU this is extremely expensive — causes dropped frames and battery drain. Was running even for medium-tier devices.
**Fix:** Wrapped in `if (PERF === 'high')` — medium and low devices skip the blur halo entirely.

### 2. 130 particles on form success — kills iPhone SE [FIXED]
**File:** `app.js` `launchParticles()`
**Problem:** Always created 130 particles regardless of device capability. On iPhone SE (1st/2nd gen, 2GB RAM), this caused visible stuttering in the success overlay animation.
**Fix:** `PARTICLE_COUNT` is now PERF-adaptive:
- `low`: 40 particles
- `medium`: 60 particles
- `high`: 130 particles

### 3. Agent WebM videos pre-loaded eagerly [FIXED]
**File:** `index.html` + `app.js`
**Problem:** `#agent-s-greet` (7.5MB) and `#agent-s-talk` (2.5MB) had no `preload="none"`. Browser auto-downloaded ~10MB of animation video that most users never trigger.
**Fix:**
- HTML: `preload="none"` on both videos
- JS: `ensureWebmLoaded()` now checks `v.readyState === 0` and calls `v.load()` only on first agent open

### 4. Error logging added [NEW]
**File:** `app.js` top of file
**Scope:** `window.addEventListener('error')` + `unhandledrejection`
**Storage:** Last 20 errors in `sessionStorage['pc_errors']` — survives page refresh, readable in DevTools console: `JSON.parse(sessionStorage.getItem('pc_errors'))`

---

## Current Resource Budget

| Resource | Size | Notes |
|----------|------|-------|
| `start_site.mp4` | 1.0MB | Preloader — critical, preloaded |
| `Backgroundscrollanimation.mp4` | 5.5MB | Scroll video — `preload="metadata"` |
| `soon_animation_no_background.webm` | varies | Idle agent — `preload="metadata"` |
| `helo_animation_7second_no_background.webm` | 7.5MB | Greet — `preload="none"` ✓ |
| `ai_agent_povest_no_background.webm` | 2.5MB | Talk — `preload="none"` ✓ |
| All images | ~3MB total | WebP + responsive srcset |
| `app.js` | ~55KB | Single file, no split needed |
| `style.css` | ~65KB | Single file |

---

## Lighthouse Targets

| Metric | Before | After prev session | Target |
|--------|--------|-------------------|--------|
| Performance | 74 | 83 | 85+ |
| LCP | 11.7s | 4.2s | < 2.5s |
| Accessibility | 89 | 100 | 100 ✓ |
| SEO | 92 | 100 | 100 ✓ |
| TBT | 90ms | 100ms | < 200ms |

**Known LCP blocker:** `start_site.mp4` (1MB preloader) — to reach < 2.5s LCP this needs to be replaced with a poster image + short video or skeleton screen.

---

## What's NOT changed (by design)
- Single RAF per animation system (butterflies pause when off-screen via IntersectionObserver)
- GL loop pauses on `visibilitychange` (tab hidden)
- `passive: true` on scroll listener
- `IntersectionObserver` on all card reveals
