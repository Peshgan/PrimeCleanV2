/* ═══════════════════════════════════════════════════
   PRIMECLEAN — APP
   IRON-CLAD RULE: HTML-in-Canvas is the core tech.
   Scroll drives video. drawElementImage + WebGL shaders
   render HTML chapters with effects.
═══════════════════════════════════════════════════ */
'use strict';

// ─── Minimal error logging (stores last 20 errors in sessionStorage) ─────────
window.addEventListener('error', e => {
  const entry = `[${new Date().toISOString()}] ${e.message} @ ${e.filename}:${e.lineno}`;
  try {
    const log = JSON.parse(sessionStorage.getItem('pc_errors') || '[]');
    log.push(entry);
    sessionStorage.setItem('pc_errors', JSON.stringify(log.slice(-20)));
  } catch {}
  console.warn('[PrimeClean Error]', e.message);
});
window.addEventListener('unhandledrejection', e => {
  console.warn('[PrimeClean] Unhandled promise:', e.reason);
});

// ─── Backend API URL ──────────────────────────────────────────────────────────
// window.PC_API is set in index.html <script> tag.
// '' = same origin (Vercel co-host). Set to Railway URL for separate backend.
const API_URL = (window.PC_API || '').replace(/\/$/, '');

/* ═══════════════════════════════
   1. PRELOADER
═══════════════════════════════ */
(function Preloader() {
  const pl       = document.getElementById('preloader');
  const plVideo  = document.getElementById('pl-video');
  const plNum    = document.getElementById('pl-num');
  const plBar    = document.getElementById('pl-bar');
  const plSkip   = document.getElementById('pl-skip');
  const plSound  = document.getElementById('pl-sound');
  const site     = document.getElementById('site');

  let soundUnlocked = false;

  // Try autoplay
  plVideo.play().catch(() => {});

  // Unlock sound on first interaction
  function unlockSound() {
    if (soundUnlocked) return;
    soundUnlocked = true;
    plVideo.muted = false;
    plVideo.volume = 0.8;
    plSound.classList.add('hidden');
  }
  plSound.addEventListener('click', unlockSound);
  document.addEventListener('click', unlockSound, { once: true });
  document.addEventListener('keydown', unlockSound, { once: true });

  // Drive counter + bar from video time
  plVideo.addEventListener('timeupdate', () => {
    if (!plVideo.duration) return;
    const p = plVideo.currentTime / plVideo.duration;
    plNum.textContent = Math.round(p * 100);
    plBar.style.width = (p * 100) + '%';
  });

  function exitPreloader() {
    pl.classList.add('exit');
    pl.addEventListener('animationend', () => { pl.style.display = 'none'; }, { once: true });
    site.classList.remove('off');
    site.classList.add('on');
    initSite();
  }

  plVideo.addEventListener('ended', exitPreloader);
  plSkip.addEventListener('click', exitPreloader);

  // Safety timeout 8s
  setTimeout(() => {
    if (!site.classList.contains('on')) exitPreloader();
  }, 8000);
})();


/* ═══════════════════════════════
   2. PERFORMANCE DETECTION
═══════════════════════════════ */
function detectPerf() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
  const conn = navigator.connection;
  if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) return 'low';

  const mem = navigator.deviceMemory;
  if (mem !== undefined) {
    if (mem <= 1) return 'low';
    if (mem <= 2) return 'medium';
  }
  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined) {
    if (cores <= 2) return 'low';
    if (cores <= 4) return 'medium';
  }
  if (conn && conn.effectiveType === '3g') return 'medium';
  // Small phones: treat as medium even if hardware is ok
  if (window.innerWidth < 480 && window.devicePixelRatio >= 2) return 'medium';
  return 'high';
}

/* ═══════════════════════════════
   3. SITE INIT
═══════════════════════════════ */
function initSite() {
  const PERF = detectPerf();
  document.body.dataset.perf = PERF;

  initScrollExp(PERF);
  initNav();
  initForm(PERF);
  initCardTilt();
  initServicesReveal();
  if (PERF !== 'low') initButterflies(PERF);
  initSoundFX();
  initAgent();
}


/* ═══════════════════════════════
   4. SCROLL EXPERIENCE
   – Video driven by scroll
   – HTML chapters visible by progress
   – HTML-in-Canvas: WebGL renders chapters with shaders
═══════════════════════════════ */
function initScrollExp(PERF) {
  const section  = document.getElementById('scroll-exp');
  const sticky   = document.getElementById('scroll-sticky');
  const sv       = document.getElementById('sv');
  const canvas   = document.getElementById('fx-canvas');
  const chapters = document.querySelectorAll('.chap');
  const dots     = document.querySelectorAll('.c-dot');
  const ringFill = document.getElementById('ring-fill');
  const progPct  = document.getElementById('prog-pct');
  const CIRCUMFERENCE = 2 * Math.PI * 20; // r=20

  // Parse chapter ranges from data attrs
  const chapDefs = Array.from(chapters).map(el => ({
    el,
    from: parseFloat(el.dataset.from),
    to:   parseFloat(el.dataset.to),
  }));

  // ── Check HTML-in-Canvas support ──
  const hasDrawElement =
    typeof CanvasRenderingContext2D !== 'undefined' &&
    typeof CanvasRenderingContext2D.prototype.drawElementImage === 'function';

  if (!hasDrawElement) {
    document.body.classList.add('no-canvas');
    console.info('[PrimeClean] HTML-in-Canvas not available — using fallback.');
  }

  // ── Setup WebGL (HTML-in-Canvas path, skip for low perf) ──
  let glState = null;
  if (hasDrawElement && PERF !== 'low') {
    glState = setupWebGL(canvas);
    if (!glState) document.body.classList.add('no-canvas');
  } else if (!hasDrawElement || PERF === 'low') {
    document.body.classList.add('no-canvas');
  }
  // Hook into global GL loop
  _glGlobalState = glState;
  new IntersectionObserver(entries => {
    _glSectionVisible = entries[0].isIntersecting;
    if (_glSectionVisible) startGLLoop(); else stopGLLoop();
  }, { threshold: 0 }).observe(section);

  // ── Scroll state ──
  let targetProg  = 0;
  let smoothProg  = 0;
  let velocity    = 0;
  const STIFFNESS = 0.018;
  const DAMPING   = 0.78;
  let isAnimating = false;
  const isMobile  = 'ontouchstart' in window;

  function getScrollProgress() {
    const rect      = section.getBoundingClientRect();
    const maxScroll = section.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -rect.top) / maxScroll);
  }

  function applyProgress(p) {
    if (sv.readyState >= 2 && sv.duration) {
      sv.currentTime = p * sv.duration;
    }
    let activeIdx = -1;
    chapDefs.forEach((c, i) => {
      const visible = p >= c.from && p < c.to;
      c.el.classList.toggle('visible', visible);
      if (visible) {
        activeIdx = i;
        if (!isMobile && PERF !== 'low') {
          const cp     = (p - c.from) / Math.max(0.001, c.to - c.from);
          const offset = (cp - 0.5) * 60;
          c.el.querySelectorAll('[data-parallax]').forEach(el => {
            el.style.transform = `translateY(${(parseFloat(el.dataset.parallax) || 0) * offset}px)`;
          });
          c.el.querySelectorAll('.chap-img-card').forEach(el => {
            el.style.setProperty('--py', `${offset * 0.2}px`);
          });
        }
      }
    });
    if (p >= chapDefs[chapDefs.length - 1].from) {
      chapDefs[chapDefs.length - 1].el.classList.add('visible');
      activeIdx = chapDefs.length - 1;
    }
    dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - p);
    progPct.textContent = Math.round(p * 100) + '%';
    if (glState && hasDrawElement) {
      renderToCanvas(glState, document.getElementById('chapters'), p);
    }
  }

  function tick() {
    const diff = targetProg - smoothProg;
    velocity  += diff * STIFFNESS;
    velocity  *= DAMPING;
    smoothProg += velocity;
    if (Math.abs(diff) < 0.00015 && Math.abs(velocity) < 0.00015) {
      smoothProg = targetProg; velocity = 0; isAnimating = false;
      applyProgress(smoothProg); return;
    }
    applyProgress(smoothProg);
    requestAnimationFrame(tick);
  }

  window.addEventListener('scroll', () => {
    targetProg = getScrollProgress();
    if (isMobile) {
      // На мобильных — прямое применение без spring-физики
      applyProgress(targetProg);
    } else if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(tick);
    }
  }, { passive: true });

  // Force video load on iOS (ignores preload="auto")
  sv.load();
  // iOS requires a play() call before seeking is possible
  const unlockScrollVideo = () => {
    sv.play().then(() => { sv.pause(); sv.currentTime = 0; }).catch(() => {});
  };
  document.addEventListener('touchstart', unlockScrollVideo, { once: true, passive: true });

  // Initial render
  targetProg = smoothProg = getScrollProgress();
  applyProgress(smoothProg);
}


/* ═══════════════════════════════
   4. WebGL + HTML-in-Canvas
═══════════════════════════════ */
function setupWebGL(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;

  // Resize canvas to fill sticky viewport
  function resize() {
    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  /* Vertex shader — full-screen quad */
  const VS = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  /* Fragment shader
     — Glass morphism + chromatic aberration + edge glow + scroll wave */
  const FS = `#version 300 es
    precision highp float;
    uniform sampler2D uTex;     // HTML rendered texture
    uniform float uTime;
    uniform float uProgress;    // scroll 0..1
    uniform vec2  uMouse;       // normalised mouse
    uniform vec2  uRes;
    in vec2 vUv;
    out vec4 fragColor;

    float luminance(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

    void main(){
      vec2 uv = vUv;

      // Subtle vertical wave driven by scroll
      float wave = sin(uv.x * 6.0 + uTime * 0.8) * 0.0018 * uProgress;
      uv.y += wave;

      // Mouse-driven soft ripple
      vec2 m = uMouse;
      float d = distance(uv, m);
      float ripple = sin(d * 25.0 - uTime * 2.5) * exp(-d * 7.0) * 0.008 * uProgress;
      vec2 dir = normalize(uv - m + 0.0001);
      uv += dir * ripple;

      // Chromatic aberration
      float ca = 0.0025 * uProgress;
      float r = texture(uTex, uv + vec2( ca, 0.0)).r;
      float g = texture(uTex, uv             ).g;
      float b = texture(uTex, uv - vec2( ca, 0.0)).b;
      float a = texture(uTex, uv).a;
      vec4 col = vec4(r, g, b, a);

      // Bloom / glow on bright pixels
      vec4 s0 = texture(uTex, uv + vec2( 0.003, 0.0));
      vec4 s1 = texture(uTex, uv - vec2( 0.003, 0.0));
      vec4 s2 = texture(uTex, uv + vec2( 0.0,  0.003));
      vec4 s3 = texture(uTex, uv - vec2( 0.0,  0.003));
      vec4 blur = (s0+s1+s2+s3) * 0.25;
      float lum = luminance(blur.rgb);
      col.rgb += blur.rgb * lum * 0.35 * uProgress;

      // Vignette
      float vig = 1.0 - smoothstep(0.45, 1.0, distance(vUv, vec2(0.5)));
      col.rgb *= mix(1.0, vig, 0.25);

      fragColor = col;
    }`;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  // Full-screen quad
  const quadVerts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Texture (will be updated each frame with HTML content)
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Uniforms
  const uTex      = gl.getUniformLocation(prog, 'uTex');
  const uTime     = gl.getUniformLocation(prog, 'uTime');
  const uProgress = gl.getUniformLocation(prog, 'uProgress');
  const uMouse    = gl.getUniformLocation(prog, 'uMouse');
  const uRes      = gl.getUniformLocation(prog, 'uRes');

  gl.uniform1i(uTex, 0);

  // Offscreen 2D canvas for drawElementImage
  const offscreen = document.createElement('canvas');
  const ctx2d     = offscreen.getContext('2d');

  // Mouse tracking
  let mouse = { x: 0.5, y: 0.5 };
  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  const startTime = performance.now();

  return { gl, prog, tex, ctx2d, offscreen, uTime, uProgress, uMouse, uRes, startTime, mouse };
}

function renderToCanvas(state, htmlEl, progress) {
  state._lastProgress = progress;
  const { gl, tex, ctx2d, offscreen, uTime, uProgress, uMouse, uRes, startTime, mouse } = state;
  const W = gl.canvas.width;
  const H = gl.canvas.height;

  // Resize offscreen to match
  if (offscreen.width !== W || offscreen.height !== H) {
    offscreen.width  = W;
    offscreen.height = H;
  }

  // Render HTML element to 2D canvas — THE HTML-IN-CANVAS MAGIC
  ctx2d.clearRect(0, 0, W, H);
  try {
    ctx2d.drawElementImage(htmlEl, 0, 0);
  } catch (e) {
    // drawElementImage not available — should not reach here
    return;
  }

  // Upload 2D canvas as WebGL texture
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);

  // Set uniforms
  const t = (performance.now() - startTime) / 1000;
  gl.uniform1f(uTime, t);
  gl.uniform1f(uProgress, progress);
  gl.uniform2f(uMouse, mouse.x, mouse.y);
  gl.uniform2f(uRes, W, H);

  // Draw full-screen quad
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Continuous time-based render loop — keeps WebGL wave animation alive between scrolls
// Runs only when: tab is visible + scroll-exp is in view + glState exists
let _glGlobalState = null;
let _glAnimRaf = null;
let _glSectionVisible = false;

function startGLLoop() {
  if (_glAnimRaf || !_glGlobalState || document.hidden || !_glSectionVisible) return;
  function loop() {
    _glAnimRaf = requestAnimationFrame(loop);
    const chapEl = document.getElementById('chapters');
    if (chapEl && _glGlobalState) renderToCanvas(_glGlobalState, chapEl, _glGlobalState._lastProgress || 0);
  }
  _glAnimRaf = requestAnimationFrame(loop);
}
function stopGLLoop() {
  if (_glAnimRaf) { cancelAnimationFrame(_glAnimRaf); _glAnimRaf = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopGLLoop(); else startGLLoop();
});

/* ═══════════════════════════════
   5. CUSTOM CURSOR
═══════════════════════════════ */
function initCursor() {
  const dot  = document.getElementById('cur-dot');
  const ring = document.getElementById('cur-ring');
  if (!dot || !ring) return;

  // Only on devices with fine pointer (mouse/trackpad)
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    dot.style.display = ring.style.display = 'none';
    return;
  }

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let ringRaf = null;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function animRing() {
    ringRaf = null;
    const dx = mx - rx, dy = my - ry;
    rx += dx * 0.11;
    ry += dy * 0.11;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    // keep running only while ring hasn't caught up
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      ringRaf = requestAnimationFrame(animRing);
    }
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
    if (!ringRaf) ringRaf = requestAnimationFrame(animRing);
  }, { passive: true });

  // Hover state: links, buttons
  const hoverEls = document.querySelectorAll('a, button, .chap-img-card, .hdr-cta, .c4-cta, #form-btn');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.classList.add('is-hovering');
      ring.classList.add('is-hovering');
    });
    el.addEventListener('mouseleave', () => {
      dot.classList.remove('is-hovering');
      ring.classList.remove('is-hovering');
    });
  });

  // Click state
  document.addEventListener('mousedown', () => {
    dot.classList.add('is-clicking');
    ring.classList.add('is-clicking');
  });
  document.addEventListener('mouseup', () => {
    dot.classList.remove('is-clicking');
    ring.classList.remove('is-clicking');
  });
}

// Init cursor immediately (before preloader exits)
initCursor();

/* ═══════════════════════════════
   6. 3D CARD TILT
═══════════════════════════════ */
function initCardTilt() {
  document.querySelectorAll('.chap-img-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.setProperty('--tx', `${-y * 14}deg`);
      card.style.setProperty('--ty', `${ x * 14}deg`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--tx', '0deg');
      card.style.setProperty('--ty', '0deg');
    });
  });
}

/* ═══════════════════════════════
   7. NAV
═══════════════════════════════ */
function initNav() {
  const hdr = document.getElementById('hdr');
  window.addEventListener('scroll', () => {
    hdr.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ═══════════════════════════════
   8. SERVICES REVEAL
═══════════════════════════════ */
function initServicesReveal() {
  const cards = document.querySelectorAll('.srv-card');
  if (!cards.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const idx = parseInt(card.dataset.srv || '1', 10);
        setTimeout(() => card.classList.add('srv-visible'), (idx - 1) * 90);
        io.unobserve(card);
      }
    });
  }, { threshold: 0.12 });

  cards.forEach(card => io.observe(card));
}

/* ═══════════════════════════════
   10. BUTTERFLIES
═══════════════════════════════ */
function initButterflies(PERF) {
  const section = document.getElementById('services');
  if (!section) return;

  // ── Two canvas layers for depth ──
  // back  = behind cards (z-index 1)
  // front = above  cards (z-index 8)
  function mkCanvas(z) {
    const c = document.createElement('canvas');
    c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z};`;
    section.appendChild(c);
    return c;
  }
  const cvBack  = mkCanvas(1);
  const cvFront = mkCanvas(8);
  const ctxB = cvBack.getContext('2d');
  const ctxF = cvFront.getContext('2d');

  // Cards sit at z-index 2 (set in CSS)
  let W = 0, H = 0;
  function resize() {
    W = cvBack.width = cvFront.width  = section.offsetWidth;
    H = cvBack.height= cvFront.height = section.offsetHeight;
  }
  resize();
  new ResizeObserver(resize).observe(section);

  // Mouse in section-local coordinates
  let mx = -9999, my = -9999;
  document.addEventListener('mousemove', e => {
    const r = section.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }, { passive: true });

  // ── Load Higgsfield butterfly sprites ──
  const SPRITE_SRCS = [
    'motion/image/bf1_blue.webp',
    'motion/image/bf2_cyan.webp',
    'motion/image/bf3_purple.webp',
    'motion/image/bf4_golden.webp',
  ];
  const sprites = [];
  let spritesReady = 0;
  SPRITE_SRCS.forEach((src, i) => {
    const img = new Image();
    img.onload  = () => { sprites[i] = img; spritesReady++; };
    img.onerror = () => { sprites[i] = null; spritesReady++; };
    img.src = src;
  });

  // ── Butterfly factory ──
  // All butterflies on back canvas (behind cards). No front layer.
  function mkB(idx) {
    const depth = .3 + Math.random() * .7;
    const cols  = Math.ceil(Math.sqrt(N));
    const rows  = Math.ceil(N / cols);
    const col   = idx % cols;
    const row   = Math.floor(idx / cols);
    const zoneW = (section.offsetWidth  || 800) / cols;
    const zoneH = (section.offsetHeight || 600) / rows;
    return {
      x:  (col + Math.random()) * zoneW,
      y:  (row + Math.random()) * zoneH,
      vx: (Math.random() - .5) * 1.4,
      vy: (Math.random() - .5) * 1.4,
      angle:   Math.random() * Math.PI * 2,
      phase:   Math.random() * Math.PI * 2,
      wSpeed:  .055 + Math.random() * .05,
      depth,
      size:    (18 + depth * 38),
      sprite:  Math.floor(Math.random() * SPRITE_SRCS.length),
      layer:   0,                          // always behind cards
      alpha:   .55 + depth * .35,
      tx: 0, ty: 0, tt: 0,
      wobble: 0, wobbleV: 0,
    };
  }
  const N = PERF === 'high' ? 18 : 9;
  const bs = Array.from({ length: N }, (_, i) => mkB(i));

  // Pick target well spread from other butterflies (best of 8 random candidates)
  function pickTarget(me) {
    let bestX = 0, bestY = 0, bestDist = -1;
    for (let k = 0; k < 8; k++) {
      const cx = 80 + Math.random() * (W - 160);
      const cy = 80 + Math.random() * (H - 160);
      let minD = Infinity;
      bs.forEach(b => { if (b !== me) minD = Math.min(minD, Math.hypot(b.tx - cx, b.ty - cy)); });
      if (minD > bestDist) { bestDist = minD; bestX = cx; bestY = cy; }
    }
    return { tx: bestX, ty: bestY };
  }

  /* ── Draw one butterfly on given context ── */
  function drawB(ctx, b) {
    const img    = sprites[b.sprite];
    const flapX  = Math.abs(Math.sin(b.phase));   // wing open: 0→1
    const s      = b.size;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle + Math.PI * .5);

    if (img && spritesReady >= SPRITE_SRCS.length) {
      // ── Sprite path: Higgsfield image with screen blend ──
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = b.alpha * (.6 + flapX * .4);

      // Flap by scaling X toward center
      ctx.scale(flapX, 1);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);

      // Subtle glow halo — skip on non-high devices (ctx.filter is expensive on mobile GPU)
      if (PERF === 'high') {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = b.alpha * .18 * flapX;
        ctx.filter = 'blur(8px)';
        ctx.drawImage(img, -s * .6, -s * .6, s * 1.2, s * 1.2);
        ctx.filter = 'none';
      }

    } else {
      // ── Fallback: procedural bezier wings ──
      ctx.globalAlpha = b.alpha * (.5 + flapX * .35);
      const COLS = ['0,180,255', '0,234,255', '160,80,255', '255,180,60'];
      const col  = COLS[b.sprite % COLS.length];

      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * flapX, 1);

        const g = ctx.createRadialGradient(s*.4, -s*.3, 0, s*.4, -s*.3, s*1.1);
        g.addColorStop(0,  `rgba(${col},.9)`);
        g.addColorStop(.6, `rgba(${col},.45)`);
        g.addColorStop(1,  `rgba(${col},0)`);

        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.bezierCurveTo(s*.25,-s*.9, s*1.3,-s*.7, s*.85, s*.05);
        ctx.bezierCurveTo(s*.5, s*.2,  s*.1,  s*.1,  0,     0);
        ctx.fillStyle = g; ctx.fill();

        const g2 = ctx.createRadialGradient(s*.3, s*.5, 0, s*.3, s*.5, s*.85);
        g2.addColorStop(0, `rgba(${col},.7)`);
        g2.addColorStop(1, `rgba(${col},0)`);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.bezierCurveTo(s*.4, s*.18, s*.88, s*.85, s*.5, s*.98);
        ctx.bezierCurveTo(s*.22,s*1.05, s*.04,s*.55, 0, 0);
        ctx.fillStyle = g2; ctx.fill();

        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ── Physics + render ── */
  let bfRaf = null;
  let bfSectionVisible = false;

  function tick() {
    bfRaf = null;
    if (document.hidden || !bfSectionVisible) return;

    ctxB.clearRect(0, 0, W, H);
    ctxF.clearRect(0, 0, W, H);

    bs.forEach(b => {
      b.phase   += b.wSpeed;
      b.wobble  += b.wobbleV;
      b.wobbleV += (Math.random() - .5) * .004;
      b.wobbleV *= .92;

      // Wander target — spread from others
      if (--b.tt <= 0) {
        const t = pickTarget(b);
        b.tx = t.tx; b.ty = t.ty;
        b.tt = 90 + Math.random() * 200;
      }
      const td = Math.hypot(b.tx - b.x, b.ty - b.y);
      if (td > 1) {
        b.vx += (b.tx - b.x) / td * .02;
        b.vy += (b.ty - b.y) / td * .02 + Math.sin(b.wobble) * .015;
      }

      // Cursor repulsion — quadratic falloff
      const cx = b.x - mx, cy = b.y - my;
      const cd = Math.hypot(cx, cy);
      const R  = 200;
      if (cd < R && cd > 0) {
        const f = ((R - cd) / R) ** 2 * 6;
        b.vx += cx / cd * f;
        b.vy += cy / cd * f;
        b.phase += f * .05;
      }

      // Friction + cap (depth-based — closer = faster max)
      b.vx *= .952;
      b.vy *= .952;
      const maxSpd = 3 + b.depth * 3.5;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > maxSpd) { b.vx = b.vx/spd*maxSpd; b.vy = b.vy/spd*maxSpd; }

      b.x += b.vx;
      b.y += b.vy;

      // Soft boundary
      const P = 60;
      if (b.x < P)     b.vx += .25;
      if (b.x > W - P) b.vx -= .25;
      if (b.y < P)     b.vy += .25;
      if (b.y > H - P) b.vy -= .25;

      // Rotate to face velocity
      if (spd > .1) {
        let da = Math.atan2(b.vy, b.vx) - b.angle;
        while (da >  Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        b.angle += da * .06;
      }

      drawB(ctxB, b);
    });

    bfRaf = requestAnimationFrame(tick);
  }

  function bfStart() {
    if (!bfRaf && bfSectionVisible && !document.hidden) {
      bfRaf = requestAnimationFrame(tick);
    }
  }

  // Pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bfStart();
  });

  // Pause when services section is off-screen
  new IntersectionObserver(entries => {
    bfSectionVisible = entries[0].isIntersecting;
    if (bfSectionVisible) bfStart();
  }, { threshold: 0 }).observe(section);
}

/* ═══════════════════════════════
   12. AI AGENT WIDGET
═══════════════════════════════ */
function initAgent() {
  const widget    = document.getElementById('ai-agent');
  const character = document.getElementById('agent-character');
  const chat      = document.getElementById('agent-chat');
  const closeBtn  = document.getElementById('agent-chat-close');
  const messages  = document.getElementById('agent-messages');
  const typing    = document.getElementById('agent-typing');
  const input     = document.getElementById('agent-input');
  const sendBtn   = document.getElementById('agent-send');
  const hint      = document.getElementById('agent-hint');
  const voice     = document.getElementById('agent-voice');
  const sIdle     = document.getElementById('agent-s-idle');
  const sGreet    = document.getElementById('agent-s-greet');
  const sTalk     = document.getElementById('agent-s-talk');

  if (!widget) return;

  // ── Safari/iOS: WebM alpha не поддерживается — canvas dual-plane рендерер ──
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const needsWebmFallback = isIOS || isSafari;

  let safariCtx = null, safariTmp = null, safariTmpCtx = null;
  let safariVideos = {}, safariActive = null, safariRaf = null, safariTs = 0;

  if (needsWebmFallback) {
    [sIdle, sGreet, sTalk].forEach(v => { if (v) v.style.display = 'none'; });

    // Canvas поверх .agent-videos
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    character.appendChild(cvs);
    safariCtx = cvs.getContext('2d');

    // Временный canvas для pixel compositing (willReadFrequently = быстрый readback)
    safariTmp = document.createElement('canvas');
    safariTmpCtx = safariTmp.getContext('2d', { willReadFrequently: true });

    const makeSV = (src, loop) => {
      const v = document.createElement('video');
      v.src = src; v.muted = true; v.loop = loop;
      v.playsInline = true; v.setAttribute('playsinline', '');
      v.preload = 'auto'; v.load();
      return v;
    };

    safariVideos = {
      idle:     makeSV('motion/ai_agent/soon_combined_ios.mp4',   true),
      greeting: makeSV('motion/ai_agent/helo_combined_ios.mp4',   false),
      talking:  makeSV('motion/ai_agent/povest_combined_ios.mp4', true),
    };

    // Разблокировка видео на iOS (требует жест пользователя)
    const unlockSafariVideos = () => {
      Object.values(safariVideos).forEach(v => v.play().then(() => v.pause()).catch(() => {}));
    };
    document.addEventListener('touchstart', unlockSafariVideos, { once: true, passive: true });

    function safariRender(ts) {
      safariRaf = requestAnimationFrame(safariRender);
      if (ts - safariTs < 33) return; // ~30fps cap
      safariTs = ts;

      const v = safariActive;
      if (!v || v.readyState < 2 || v.paused) return;

      const vw = v.videoWidth, vh = v.videoHeight;
      const fh = vh >> 1;
      const dispW = cvs.offsetWidth || 180;
      const dispH = cvs.offsetHeight || 270;

      if (cvs.width !== dispW || cvs.height !== dispH) {
        cvs.width = dispW; cvs.height = dispH;
      }
      if (safariTmp.width !== dispW || safariTmp.height !== dispH * 2) {
        safariTmp.width = dispW; safariTmp.height = dispH * 2;
      }

      // Рисуем весь dual-plane кадр масштабированно
      safariTmpCtx.drawImage(v, 0, 0, vw, vh, 0, 0, dispW, dispH * 2);

      const colorPx = safariTmpCtx.getImageData(0, 0,     dispW, dispH);
      const alphaPx = safariTmpCtx.getImageData(0, dispH, dispW, dispH);
      const cd = colorPx.data, ad = alphaPx.data;
      for (let i = 0; i < cd.length; i += 4) {
        const a = ad[i];
        cd[i + 3] = a < 48 ? 0 : a;
      }

      safariCtx.clearRect(0, 0, dispW, dispH);
      safariCtx.putImageData(colorPx, 0, 0);
    }
    safariRaf = requestAnimationFrame(safariRender);
  }

  // ── API: all AI requests go through backend (API key stays server-side) ──
  const CHAT_URL = API_URL + '/api/chat';

  let state           = 'idle';
  let greeted         = false;
  let history         = [];
  let hintTimer       = null;
  let idlePulseTimer  = null;
  // Greet bubble убран — текст вошёл в очередь хинтов как первый показ

  // ── Lazy-load greeting/talking WebM (preload="none" in HTML, triggered here) ──
  let webmLoaded = false;
  function ensureWebmLoaded() {
    if (webmLoaded || needsWebmFallback) return;
    webmLoaded = true;
    [sGreet, sTalk].forEach(v => {
      if (v && v.readyState === 0) v.load(); // HAVE_NOTHING → trigger fetch
    });
  }

  // ── State machine ──
  function setState(s) {
    state = s;
    character.dataset.state = s;

    if (needsWebmFallback) {
      // Safari/iOS: переключаем dual-plane canvas видео
      if (safariActive) safariActive.pause();
      if (s === 'idle' || s === 'listening') {
        safariActive = safariVideos.idle;
      } else if (s === 'greeting') {
        safariActive = safariVideos.greeting;
        safariActive.currentTime = 0;
      } else if (s === 'talking') {
        safariActive = safariVideos.talking;
        safariActive.currentTime = 0;
      }
      safariActive.play().catch(() => {});
      return;
    }

    // Chrome/Firefox: обычные WebM видео
    [sIdle, sGreet, sTalk].forEach(el => {
      el.classList.remove('is-active');
      el.pause?.();
    });

    if (s === 'idle' || s === 'listening') {
      sIdle.classList.add('is-active');
      sIdle.play().catch(() => {});
    } else if (s === 'greeting') {
      sGreet.classList.add('is-active');
      sGreet.currentTime = 0;
      sGreet.play().catch(() => {});
    } else if (s === 'talking') {
      sTalk.classList.add('is-active');
      sTalk.currentTime = 0;
      sTalk.play().catch(() => {});
    }
  }

  // ── Hide during scroll-exp ──
  const scrollExp = document.getElementById('scroll-exp');
  if (scrollExp) {
    const io = new IntersectionObserver(entries => {
      widget.classList.toggle('agent-hidden', entries[0].isIntersecting);
    }, { threshold: 0.15 });
    io.observe(scrollExp);
    const r = scrollExp.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) widget.classList.add('agent-hidden');
  }

  // ── Рандомные подсказки над персонажем ──
  const introRole = character.querySelector('.agent-intro-role');
  const HINTS = [
    'Помогу подобрать уборку и цену 👋',
    'Нужна помощь? 👋',
    'Рассчитаю цену за минуту 💬',
    'Уборка квартиры от 80 BYN',
    'Генеральная от 240 BYN 🧹',
    'Без предоплаты 👍',
    'Работаем Пн–Вс 🗓',
    'Гарантия качества 24ч ✅',
    'Рейтинг 4.9 ⭐',
    'Ответим за 15 минут ⚡',
    'Химчистка мебели 🛋',
    '30+ специалистов в команде',
    'Уборка после ремонта 🏗',
    'Экологичная химия 🌿',
  ];
  let lastHintIdx = -1;

  function getRandomHint() {
    let idx;
    do { idx = Math.floor(Math.random() * HINTS.length); } while (idx === lastHintIdx);
    lastHintIdx = idx;
    return HINTS[idx];
  }

  function cycleHint() {
    if (chat.classList.contains('is-open') || !introRole) return;
    introRole.style.opacity = '0';
    setTimeout(() => {
      introRole.textContent = getRandomHint();
      introRole.style.opacity = '1';
    }, 300);
  }

  // Первый хинт — приветствие через 4с, дальше рандомные каждые 60с
  if (introRole) {
    hintTimer = setTimeout(() => {
      introRole.style.opacity = '0';
      setTimeout(() => {
        introRole.textContent = HINTS[0]; // «Помогу подобрать уборку и цену 👋»
        introRole.style.opacity = '1';
        lastHintIdx = 0;
        const loop = setInterval(() => {
          if (chat.classList.contains('is-open')) { clearInterval(loop); return; }
          cycleHint();
        }, 60000);
        widget._hintLoop = loop;
      }, 300);
    }, 4000);
  }

  function scheduleHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      cycleHint();
      const loop = setInterval(() => {
        if (chat.classList.contains('is-open')) { clearInterval(loop); return; }
        cycleHint();
      }, 60000);
      widget._hintLoop = loop;
    }, 5000);
  }

  // ── Rare idle pulse every 20-35s ──
  function scheduleIdlePulse() {
    clearTimeout(idlePulseTimer);
    idlePulseTimer = setTimeout(() => {
      if (state === 'idle') {
        character.classList.add('idle-pulse');
        setTimeout(() => { character.classList.remove('idle-pulse'); scheduleIdlePulse(); }, 2000);
      } else {
        scheduleIdlePulse();
      }
    }, 20000 + Math.random() * 15000);
  }
  scheduleIdlePulse();

  // ── Open ──
  function revealChat() {
    chat.classList.add('is-open');
    widget.classList.add('chat-open');
    addMessage('agent', 'Привет! Я Алиса, ваш AI-ассистент PrimeClean. Расскажите, что нужно убрать — помогу подобрать услугу и цену 😊');
    setState('listening');
    input.focus();
  }

  function openChat() {
    hint.classList.remove('visible');
    clearTimeout(hintTimer);
    clearInterval(widget._hintLoop);
    ensureWebmLoaded();

    if (!greeted) {
      greeted = true;
      setState('greeting');
      voice.currentTime = 0;
      voice.play().catch(() => {});
      // Краткая анимация приветствия (1.5s), потом открываем чат
      setTimeout(revealChat, 1500);
    } else {
      chat.classList.add('is-open');
      widget.classList.add('chat-open');
      input.focus();
    }
  }

  // ── Close ──
  function closeChat() {
    chat.classList.remove('is-open');
    widget.classList.remove('chat-open');
    setState('idle');
    clearInterval(widget._hintLoop);
    if (introRole) {
      introRole.style.opacity = '0';
      setTimeout(() => {
        introRole.textContent = 'AI-ассистент PrimeClean';
        introRole.style.opacity = '1';
      }, 300);
    }
    scheduleHint();
  }

  // Preload greeting/talking WebM on hover so they're ready when needed
  character.addEventListener('mouseenter', ensureWebmLoaded, { once: true, passive: true });
  character.addEventListener('click', openChat);
  character.addEventListener('touchend', e => { e.preventDefault(); openChat(); }, { passive: false });
  character.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openChat(); });
  closeBtn.addEventListener('click', closeChat);

  // ── Hide agent when mobile keyboard opens (prevents blocking form inputs) ──
  if ('ontouchstart' in window) {
    document.addEventListener('focusin', e => {
      if (e.target !== input && e.target.matches('input, textarea, select')) {
        document.body.classList.add('keyboard-open');
      }
    });
    document.addEventListener('focusout', e => {
      if (e.target !== input && e.target.matches('input, textarea, select')) {
        setTimeout(() => {
          if (!document.activeElement?.matches('input, textarea, select')) {
            document.body.classList.remove('keyboard-open');
          }
        }, 200);
      }
    });
  }

  // ── Messages ──
  function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'agent-msg from-' + (role === 'agent' ? 'agent' : 'user');
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function typewriteMessage(text) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'agent-msg from-agent is-typing';
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;

      let i = 0;
      function tick() {
        if (i >= text.length) {
          el.classList.remove('is-typing');
          resolve();
          return;
        }
        el.textContent += text[i++];
        messages.scrollTop = messages.scrollHeight;
        const ch = text[i - 1];
        const delay = /[.!?…]/.test(ch) ? 90 + Math.random() * 70
                    : /[,;:]/.test(ch)  ? 45 + Math.random() * 25
                    :                     16 + Math.random() * 14;
        setTimeout(tick, delay);
      }
      tick();
    });
  }

  // ── Form prefill ──
  function extractFormMarker(text) {
    const match = text.match(/\[FORM:([^|]*)\|([^|]*)\|([^|]*)\|([^\]]*)\]/);
    if (!match) return null;
    return {
      name:    match[1].trim(),
      phone:   match[2].trim(),
      service: match[3].trim(),
      comment: match[4].trim(),
      clean:   text.replace(/\[FORM:[^\]]*\]/g, '').trim(),
    };
  }

  function prefillForm(data) {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;
    const nameInput    = contactForm.querySelector('input[type="text"]');
    const phoneInp     = document.getElementById('phone-input');
    const serviceSelect = contactForm.querySelector('select');
    if (nameInput  && data.name)    nameInput.value  = data.name;
    if (phoneInp   && data.phone)   phoneInp.value   = data.phone;
    if (serviceSelect && data.service) {
      const opt = Array.from(serviceSelect.options)
        .find(o => o.text.toLowerCase().includes(data.service.toLowerCase().slice(0, 8)));
      if (opt) serviceSelect.value = opt.value || opt.text;
    }
    const textarea = contactForm.querySelector('textarea');
    if (textarea && data.comment)  textarea.value = data.comment;
    // вспышка на форме
    const section = document.getElementById('contact-anchor');
    if (section) {
      section.classList.add('form-prefilled');
      setTimeout(() => section.classList.remove('form-prefilled'), 2000);
    }
  }

  function addFormReadyMessage() {
    const el = document.createElement('div');
    el.className = 'agent-msg from-agent agent-msg--form-ready';
    el.innerHTML = `<span>✅ Заполнила форму — осталось нажать «Отправить заявку»!</span>
      <button class="agent-goto-form">Перейти к форме →</button>`;
    el.querySelector('.agent-goto-form').addEventListener('click', () => {
      closeChat();
      setTimeout(() => {
        document.getElementById('contact-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    });
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Send ──
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || state === 'talking') return;
    input.value = '';
    input.style.height = 'auto';
    addMessage('user', text);
    history.push({ role: 'user', content: text });

    setState('talking');
    typing.classList.remove('hidden');
    messages.scrollTop = messages.scrollHeight;

    try {
      const res  = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data   = await res.json();
      const raw    = data.reply || 'Не смогла ответить — попробуйте ещё раз.';
      const parsed = extractFormMarker(raw);
      const reply  = parsed ? parsed.clean : raw;
      history.push({ role: 'assistant', content: reply });
      typing.classList.add('hidden');
      await typewriteMessage(reply);
      if (parsed) {
        prefillForm(parsed);
        addFormReadyMessage();
      }
    } catch {
      typing.classList.add('hidden');
      await typewriteMessage('Ошибка соединения. Попробуйте позже.');
    }

    setState('listening');
  }

  sendBtn.addEventListener('click', sendMessage);

  // Enter — отправить, Shift+Enter — новая строка
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Авторазмер textarea
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }
  input.addEventListener('input', autoResize);

  // Голосовой ввод
  const micBtn = document.getElementById('agent-mic');
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec && micBtn) {
    const rec = new SpeechRec();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    let isRecording = false;

    micBtn.addEventListener('click', () => {
      if (isRecording) { rec.stop(); return; }
      rec.start();
    });

    rec.onstart = () => {
      isRecording = true;
      micBtn.classList.add('is-recording');
      micBtn.title = 'Говорите… (нажмите чтобы остановить)';
    };

    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      input.value = transcript;
      autoResize();
    };

    rec.onend = () => {
      isRecording = false;
      micBtn.classList.remove('is-recording');
      micBtn.title = 'Говорите — я слушаю';
      // если что-то набрано — сразу отправляем
      if (input.value.trim()) sendMessage();
    };

    rec.onerror = () => {
      isRecording = false;
      micBtn.classList.remove('is-recording');
    };
  } else if (micBtn) {
    micBtn.classList.add('no-speech');
  }

  setState('idle');
}

/* ═══════════════════════════════
   11. SOUND FX
═══════════════════════════════ */
function initSoundFX() {
  const SRCS = [
    'motion/audio/click1.mp3',
    'motion/audio/click2.mp3',
    'motion/audio/click3.mp3',
    'motion/audio/click4.mp3',
  ];

  // 3 pooled instances per sound — handles rapid successive clicks without overlap pileup
  const POOL_SIZE = 3;
  const pools = SRCS.map(src =>
    Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio(src);
      a.volume = 0.35;
      return a;
    })
  );

  let lastPlayAt = 0;
  let lastSoundIdx = -1;

  function playClick() {
    const now = performance.now();
    if (now - lastPlayAt < 80) return; // anti-spam cooldown

    // Pick random sound, avoid same as last
    let idx;
    do { idx = Math.floor(Math.random() * SRCS.length); }
    while (SRCS.length > 1 && idx === lastSoundIdx);
    lastSoundIdx = idx;
    lastPlayAt   = now;

    // Find a pool slot that's free (ended or not started)
    const pool = pools[idx];
    const slot = pool.find(a => a.paused) ?? pool[0];
    slot.currentTime = 0;
    slot.play().catch(() => {});
  }

  // Interactive targets
  const SELECTOR = 'a, button, input, textarea, select, label, .srv-card, .chap-img-card, .c-dot, .hdr-cta, .c4-cta, #form-btn, .pl-skip';

  document.addEventListener('click', e => {
    if (e.target.closest(SELECTOR)) playClick();
  }, { passive: true });

  // Form focus interactions
  document.addEventListener('focusin', e => {
    if (e.target.matches('input, textarea, select')) playClick();
  }, { passive: true });
}

/* ═══════════════════════════════
   9. FORM
═══════════════════════════════ */
function initForm(PERF = 'high') {
  // ── Белорусская маска телефона: +375 (XX) XXX-XX-XX ──
  const phoneInput = document.getElementById('phone-input');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      let digits = phoneInput.value.replace(/\D/g, '');
      if (digits.startsWith('375')) digits = digits.slice(3);
      else if (digits.startsWith('80')) digits = digits.slice(1);
      digits = digits.slice(0, 9);
      let val = '+375';
      if (digits.length > 0) val += ' (' + digits.slice(0, 2);
      if (digits.length >= 2) val += ') ' + digits.slice(2, 5);
      if (digits.length >= 5) val += '-' + digits.slice(5, 7);
      if (digits.length >= 7) val += '-' + digits.slice(7, 9);
      phoneInput.value = val;
    });
    phoneInput.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && phoneInput.value === '+375') {
        e.preventDefault();
      }
    });
    phoneInput.addEventListener('focus', () => {
      if (!phoneInput.value) phoneInput.value = '+375 ';
    });
    phoneInput.addEventListener('blur', () => {
      if (phoneInput.value === '+375 ' || phoneInput.value === '+375') phoneInput.value = '';
    });
  }

  // ── Lid sounds ──
  const lidPool = [1,2,3,4].map(i => {
    const a = new Audio(`motion/audio/lid${i}.mp3`);
    a.volume = 0.65;
    return a;
  });
  function playLidSound() {
    const a = lidPool[Math.floor(Math.random() * lidPool.length)];
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  // ── Particle burst ──
  function launchParticles() {
    const canvas = document.getElementById('fs-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const cx  = canvas.width  / 2;
    const cy  = canvas.height / 2;
    const COLORS = ['#00eaff','#1a6cff','#ffffff','#7dd3fc','#60a5fa','#00eaff','#00eaff'];

    const PARTICLE_COUNT = PERF === 'low' ? 40 : PERF === 'medium' ? 60 : 130;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 11 + 4;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        r: Math.random() * 5 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        decay: Math.random() * 0.016 + 0.008,
        rect: Math.random() > 0.55,
        rot: Math.random() * Math.PI,
        rotV: (Math.random() - 0.5) * 0.18,
      };
    });

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.28; p.vx *= 0.99;
        p.alpha -= p.decay;
        p.rot += p.rotV;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.rect) { ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); }
        else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (alive) requestAnimationFrame(tick);
    }
    tick();
  }

  // ── Success overlay ──
  const fsOverlay = document.getElementById('form-success');
  const fsClose   = document.getElementById('fs-close');
  if (fsClose) {
    fsClose.addEventListener('click', () => {
      fsOverlay.hidden = true;
    });
  }
  fsOverlay?.addEventListener('click', e => {
    if (e.target === fsOverlay) fsOverlay.hidden = true;
  });

  function showSuccess() {
    if (!fsOverlay) return;
    // Аналитика: конверсия при отправке формы
    if (typeof gtag === 'function') gtag('event', 'conversion', { event_category: 'lead', event_label: 'form_submit' });
    if (typeof ym === 'function') ym(0, 'reachGoal', 'form_submit');
    // сбросить анимации переоткрывая оверлей
    fsOverlay.hidden = false;
    // перезапуск CSS-анимаций карточки
    const card = fsOverlay.querySelector('.fs-card');
    card.style.animation = 'none';
    card.offsetHeight; // reflow
    card.style.animation = '';
    fsOverlay.querySelectorAll('.fs-step').forEach(s => {
      s.style.animation = 'none'; s.offsetHeight; s.style.animation = '';
    });
    ['.fs-circle','.fs-tick'].forEach(sel => {
      const el = fsOverlay.querySelector(sel);
      if (el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
    });
    launchParticles();
  }

  // ── Form submit ──
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    playLidSound();
    const btn = document.getElementById('form-btn');
    btn.classList.add('sent');
    btn.querySelector('span').textContent = 'Отправляем…';
    btn.disabled = true;

    const name    = form.querySelector('input[type="text"]')?.value?.trim() || '';
    const phone   = document.getElementById('phone-input')?.value?.trim() || '';
    const service = form.querySelector('select')?.value || '';
    const message = form.querySelector('textarea')?.value?.trim() || '';

    try {
      const leadsUrl = API_URL + '/api/leads';
      const res = await fetch(leadsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, service, message, source: 'website-form' }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (err) {
      console.warn('[form] backend unavailable, showing success anyway:', err.message);
    }

    showSuccess();
    btn.classList.remove('sent');
    btn.querySelector('span').textContent = 'Отправить заявку';
    btn.disabled = false;
    form.reset();
  });
}
