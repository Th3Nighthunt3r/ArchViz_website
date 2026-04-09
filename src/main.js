/**
 * ArchViz — Scroll-driven video scrubber
 *
 * How it works:
 *   1. 7 <video> elements decode frames silently (opacity:0, 1×1 px)
 *   2. Two <canvas> elements display frames (back = current, front = incoming)
 *   3. Seeking: video.currentTime → 'seeked' event → canvas.drawImage(video)
 *      A "seek queue" per video prevents concurrent seeks and ensures the
 *      canvas always catches up to the latest scroll position.
 *   4. Transitions: CSS clip-path on #front-clip animates from
 *      inset(100% 0 0 0) → inset(0% 0 0 0) as you scroll — wipe from bottom.
 *   5. Text panels: GSAP fade-in / fade-out triggered by scroll progress.
 *   6. Vite serves the page over HTTP with proper Range-Request support,
 *      which is required for video seeking to work in Chrome.
 */

import gsap from 'gsap';

// ─── Scroll geometry ─────────────────────────────────────────
const SECTION_VH = 300;                     // viewport heights of scroll per section
const TRANS_VH   = 32;                      // last N vh → wipe transition
const PLAY_VH    = SECTION_VH - TRANS_VH;  // 268 vh → normal playback

// ─── Section data ─────────────────────────────────────────────
const SECTIONS = [
  {
    videoId: 'v0',
    texts: [
      { start: 0.06, end: 0.40, label: 'Approach Path',      title: 'A Choreographed Arrival',    body: "The forecourt narrows deliberately as it reaches the threshold — a compression of space that heightens anticipation and slows the visitor's pace before they enter." },
      { start: 0.52, end: 0.86, label: 'Roof Plane',         title: 'The Sheltering Canopy',      body: 'A shallow-pitched overhang extends beyond the facade, casting a measured band of shade that migrates across the stone paving with each passing season.' },
    ],
  },
  {
    videoId: 'v1',
    texts: [
      { start: 0.06, end: 0.40, label: 'Facade Composition', title: 'Rhythm in Stone and Shadow', body: 'Vertical fins of hand-selected limestone filter direct sun while casting an ever-changing pattern of shadow across the elevation — a facade that moves with the light.' },
      { start: 0.52, end: 0.86, label: 'Glazing System',     title: 'The Transparent Wall',       body: 'Full-height sliding panels of low-iron glass dissolve the perceived boundary between the interior and the terrace beyond — the building breathes with the outdoors.' },
    ],
  },
  {
    videoId: 'v2',
    texts: [
      { start: 0.06, end: 0.40, label: 'The Threshold',      title: 'An Architectural Pause',     body: 'A double-height entry void creates a moment of stillness before the main volumes unfold. The compressed ceiling of the approach releases dramatically into open space above.' },
      { start: 0.52, end: 0.86, label: 'Material Palette',   title: 'Honesty of Material',        body: 'Board-formed concrete retains every grain of the timber formwork — raw, direct, unhidden. Against it, warm-toned timber joinery introduces domestic scale without decoration.' },
    ],
  },
  {
    videoId: 'v3',
    texts: [
      { start: 0.06, end: 0.40, label: 'Structural Grid',    title: 'Columns as Space-Makers',    body: 'Exposed concrete columns define zones without enclosing them. The plan flows freely between each upright — furniture clusters around the structure, making it part of daily life.' },
      { start: 0.52, end: 0.86, label: 'Overhead Light',     title: 'A Blade of Sky',             body: 'A continuous north-facing rooflight draws daylight as a directed shaft. It traces a slow arc across the polished floor from east to west — a sundial built into the building.' },
    ],
  },
  {
    videoId: 'v4',
    texts: [
      { start: 0.06, end: 0.40, label: 'The Hearth',         title: 'A Quiet Anchor',             body: 'A linear fireplace is recessed flush into the wall — no mantle, no surround, just a slot of warmth. Its stone face is indistinguishable from the wall until the flame reveals it.' },
      { start: 0.52, end: 0.86, label: 'Textile and Texture', title: 'Warmth Through Material',   body: 'Undyed linen, hand-woven wool, and unpolished stone introduce tactile variation against the precision of the surrounding geometry — surfaces meant to be touched, not only seen.' },
    ],
  },
  {
    videoId: 'v5',
    texts: [
      { start: 0.06, end: 0.40, label: 'Joinery Detail',     title: 'The Art of the Gap',         body: 'A 3 mm shadow reveal separates every cabinetry panel. There are no handles, no hardware — just light catching the edge of each plane, allowing the hand to find its way by touch.' },
      { start: 0.52, end: 0.86, label: 'Stone Surface',      title: 'Geology as Ornament',        body: 'Honed marble is bookmatched across the island bench — each slab a mirror of the other, their veining a unique geological record laid down hundreds of millions of years ago.' },
    ],
  },
  {
    videoId: 'v6',
    texts: [
      { start: 0.06, end: 0.40, label: 'Site Relationship',  title: 'Building with the Land',     body: 'The footprint follows the existing contour line, terracing rather than cutting. No ground was removed that was not restored in landscape — the building settles into the site, not onto it.' },
      { start: 0.52, end: 0.86, label: 'Landscape Edge',     title: 'Where Architecture Ends',    body: "Native grasses and indigenous stone drift against the building's base. There is no hard line between the built and the grown — the boundary dissolves, and architecture becomes land." },
    ],
  },
];

// ─── DOM refs ─────────────────────────────────────────────────
const videos      = SECTIONS.map(s => document.getElementById(s.videoId));
const canvasBack  = document.getElementById('canvas-back');
const canvasFront = document.getElementById('canvas-front');
const frontClip   = document.getElementById('front-clip');
const ctxBack     = canvasBack.getContext('2d');
const ctxFront    = canvasFront.getContext('2d');
const loaderEl    = document.getElementById('loader');
const loaderFill  = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const progFill    = document.getElementById('scroll-prog-fill');
const numEl       = document.getElementById('num-current');
const dotListEl   = document.getElementById('dot-list');
const textLayer   = document.getElementById('text-layer');
const hintEl      = document.getElementById('hint');

// ─── Canvas resize ────────────────────────────────────────────
function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  [canvasBack, canvasFront].forEach(c => {
    c.width  = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width  = w + 'px';
    c.style.height = h + 'px';
  });
}
window.addEventListener('resize', () => { resizeCanvases(); scheduleDraw(); });

// ─── Cover-draw a video onto a canvas context ─────────────────
function coverDraw(ctx, video) {
  if (!video.videoWidth) return;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

// ─── Seek queue ───────────────────────────────────────────────
// Ensures only one seek is in flight per video. If scroll outpaces
// seek speed, the latest target is queued and executed immediately
// after the current seek completes.
const seekQueue = videos.map(() => ({ isSeeking: false, pending: null }));

function seekTo(idx, time) {
  const video = videos[idx];
  const dur   = video.duration;
  if (!dur || !isFinite(dur) || dur <= 0) return;

  const t   = Math.max(0, Math.min(time, dur - 0.001));
  const q   = seekQueue[idx];

  q.pending = t;

  if (!q.isSeeking) {
    q.isSeeking = true;
    q.pending   = null;
    video.currentTime = t;
  }
}

// Called when a seek completes (see 'seeked' listeners below)
function onSeeked(idx, ctx) {
  const video = videos[idx];
  const q     = seekQueue[idx];

  // Draw the newly decoded frame
  coverDraw(ctx, video);

  q.isSeeking = false;

  // If more scrubbing arrived while we were seeking, catch up now
  if (q.pending !== null) {
    const next = q.pending;
    q.pending   = null;
    q.isSeeking = true;
    video.currentTime = next;
  }
}

// ─── Transition (clip-path wipe from bottom) ──────────────────
let lastFrontIdx = -1;

function setFrontClip(progress) {
  // progress: 0 = front hidden (top clipped 100%), 1 = front fully visible
  const topPct = (1 - progress) * 100;
  frontClip.style.clipPath = `inset(${topPct.toFixed(3)}% 0 0 0)`;
}

function hideFront() {
  frontClip.style.clipPath = 'inset(100% 0 0 0)';
}

// ─── Text panels ──────────────────────────────────────────────
const panels = [];

function buildTextPanels() {
  SECTIONS.forEach((sec, si) => {
    sec.texts.forEach(cfg => {
      const el = document.createElement('div');
      el.className = 'text-panel';
      el.innerHTML = `
        <div class="t-label">${cfg.label}</div>
        <h2 class="t-title">${cfg.title}</h2>
        <p class="t-body">${cfg.body}</p>
      `;
      textLayer.appendChild(el);
      panels.push({ el, si, cfg });
    });
  });
}

function updateText(si, progress) {
  panels.forEach(p => {
    const show = p.si === si && progress >= p.cfg.start && progress <= p.cfg.end;
    p.el.classList.toggle('visible', show);
  });
}

// ─── Nav dots ─────────────────────────────────────────────────
const dots = [];

function buildDots() {
  SECTIONS.forEach((_, i) => {
    const li  = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'dot' + (i === 0 ? ' on' : '');
    btn.setAttribute('aria-label', `Section ${i + 1}`);
    btn.addEventListener('click', () => {
      window.scrollTo({ top: i * SECTION_VH * window.innerHeight + 2, behavior: 'smooth' });
    });
    li.appendChild(btn);
    dotListEl.appendChild(li);
    dots.push(btn);
  });
}

let lastSi = -1;
function updateDots(si) {
  if (si === lastSi) return;
  dots.forEach((d, i) => d.classList.toggle('on', i === si));
  numEl.textContent = String(si + 1).padStart(2, '0');
  lastSi = si;
}

// ─── Main render (runs inside rAF) ────────────────────────────
function draw() {
  const scrollY = window.scrollY;
  const vh      = window.innerHeight;
  const sectPx  = SECTION_VH * vh;
  const playPx  = PLAY_VH    * vh;
  const transPx = TRANS_VH   * vh;

  const si     = Math.min(Math.floor(scrollY / sectPx), SECTIONS.length - 1);
  const within = scrollY - si * sectPx;

  const inTrans = within >= playPx && si < SECTIONS.length - 1;

  if (inTrans) {
    const tp = Math.max(0, Math.min((within - playPx) / transPx, 1));

    // Back: hold current section's last frame
    seekTo(si, videos[si].duration || 9999);

    // Front: next section's first frame, wipe up from bottom
    if (lastFrontIdx !== si + 1) {
      // Re-wire seeked handler when front video changes
      lastFrontIdx = si + 1;
    }
    seekTo(si + 1, 0);
    setFrontClip(tp);

    updateText(si, 0.9);

  } else {
    const progress = Math.max(0, Math.min(within / playPx, 1));
    seekTo(si, progress * (videos[si].duration || 0));
    hideFront();
    updateText(si, progress);
  }

  updateDots(si);

  // Scroll progress bar
  const maxScroll = document.documentElement.scrollHeight - vh;
  progFill.style.width = (maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0).toFixed(2) + '%';

  // Hint
  if (scrollY > 40 && !hintEl.classList.contains('gone')) {
    hintEl.classList.add('gone');
  }
}

// ─── Schedule rAF (deduplicated) ──────────────────────────────
let rafId = 0;
function scheduleDraw() {
  if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; draw(); });
}

// ─── Seeked listeners ─────────────────────────────────────────
// Each video needs to know which canvas to draw to.
// During normal playback: back canvas. During transition: front canvas.
videos.forEach((video, idx) => {
  video.addEventListener('seeked', () => {
    const si     = Math.min(Math.floor(window.scrollY / (SECTION_VH * window.innerHeight)), SECTIONS.length - 1);
    const ctx    = (idx === si) ? ctxBack : ctxFront;
    onSeeked(idx, ctx);
  });
});

// ─── Preload ──────────────────────────────────────────────────
function preload() {
  let metaDone = 0;
  let launched = false;

  function tryLaunch() {
    if (launched) return;
    const v0 = videos[0];
    if (!v0.duration || !isFinite(v0.duration)) return;
    launched = true;

    loaderLabel.textContent = 'Ready';
    setTimeout(() => {
      loaderEl.classList.add('done');

      // Seek v0 to 0 — 'seeked' will draw it to canvas-back
      videos[0].addEventListener('seeked', function onFirst() {
        videos[0].removeEventListener('seeked', onFirst);
        coverDraw(ctxBack, videos[0]);
      });
      videos[0].currentTime = 0;

      // Start responding to scroll
      window.addEventListener('scroll', scheduleDraw, { passive: true });
    }, 400);
  }

  videos.forEach((v, i) => {
    const onMeta = () => {
      metaDone++;
      loaderFill.style.width = Math.round((metaDone / videos.length) * 100) + '%';
      if (i === 0) tryLaunch();
    };

    if (v.readyState >= 1) {
      onMeta();
    } else {
      v.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    // durationchange fires if duration was initially Infinity
    v.addEventListener('durationchange', () => { if (i === 0) tryLaunch(); });
  });
}

// ─── Boot ─────────────────────────────────────────────────────
resizeCanvases();
buildDots();
buildTextPanels();
preload();
