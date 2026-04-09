'use strict';

// ── Config ────────────────────────────────────────────────────
const SECTION_VH = 300;              // viewport heights of scroll per section
const TRANS_VH   = 30;               // last N vh of each section = wipe transition
const PLAY_VH    = SECTION_VH - TRANS_VH;  // 270 vh = actual playback range

// ── Section definitions ───────────────────────────────────────
const SECTIONS = [
  {
    videoId: 'v0',
    texts: [
      { start: 0.06, end: 0.40, label: 'Approach Path',      title: 'A Choreographed Arrival',   body: 'The forecourt narrows deliberately as it reaches the threshold — a compression of space that heightens anticipation and slows the visitor\'s pace before they enter.' },
      { start: 0.52, end: 0.86, label: 'Roof Plane',         title: 'The Sheltering Canopy',     body: 'A shallow-pitched overhang extends beyond the facade, casting a measured band of shade that migrates across the stone paving with each passing season.' },
    ],
  },
  {
    videoId: 'v1',
    texts: [
      { start: 0.06, end: 0.40, label: 'Facade Composition', title: 'Rhythm in Stone and Shadow', body: 'Vertical fins of hand-selected limestone filter direct sun while casting an ever-changing pattern of shadow across the elevation — a facade that moves with the light.' },
      { start: 0.52, end: 0.86, label: 'Glazing System',     title: 'The Transparent Wall',      body: 'Full-height sliding panels of low-iron glass dissolve the perceived boundary between the interior living volume and the terrace beyond — the building breathes with the outdoors.' },
    ],
  },
  {
    videoId: 'v2',
    texts: [
      { start: 0.06, end: 0.40, label: 'The Threshold',      title: 'An Architectural Pause',    body: 'A double-height entry void creates a moment of stillness before the main volumes unfold. The compressed ceiling of the approach releases dramatically into open space above.' },
      { start: 0.52, end: 0.86, label: 'Material Palette',   title: 'Honesty of Material',       body: 'Board-formed concrete retains every grain of the timber formwork — raw, direct, unhidden. Against it, warm-toned timber joinery introduces domestic scale without decoration.' },
    ],
  },
  {
    videoId: 'v3',
    texts: [
      { start: 0.06, end: 0.40, label: 'Structural Grid',    title: 'Columns as Space-Makers',   body: 'Exposed concrete columns define zones without enclosing them. The plan flows freely between each upright — furniture clusters around the structure, making it part of daily life.' },
      { start: 0.52, end: 0.86, label: 'Overhead Light',     title: 'A Blade of Sky',            body: 'A continuous north-facing rooflight draws daylight in as a directed shaft. It traces a slow arc across the polished floor from east to west — a sundial built into the building.' },
    ],
  },
  {
    videoId: 'v4',
    texts: [
      { start: 0.06, end: 0.40, label: 'The Hearth',         title: 'A Quiet Anchor',            body: 'A linear fireplace is recessed flush into the wall — no mantle, no surround, just a slot of warmth. Its stone face is indistinguishable from the wall until the flame reveals it.' },
      { start: 0.52, end: 0.86, label: 'Textile and Texture', title: 'Warmth Through Material',  body: 'Undyed linen, hand-woven wool, and unpolished stone introduce tactile variation against the precision of the surrounding geometry — surfaces meant to be touched, not only seen.' },
    ],
  },
  {
    videoId: 'v5',
    texts: [
      { start: 0.06, end: 0.40, label: 'Joinery Detail',     title: 'The Art of the Gap',        body: 'A 3 mm shadow reveal separates every cabinetry panel. There are no handles, no hardware — just light catching the edge of each plane, allowing the hand to find its way by touch.' },
      { start: 0.52, end: 0.86, label: 'Stone Surface',      title: 'Geology as Ornament',       body: 'Honed marble is bookmatched across the island bench — each slab a mirror of the other, their veining a unique geological record laid down hundreds of millions of years ago.' },
    ],
  },
  {
    videoId: 'v6',
    texts: [
      { start: 0.06, end: 0.40, label: 'Site Relationship',  title: 'Building with the Land',    body: 'The footprint follows the existing contour line, terracing rather than cutting. No ground was removed that was not restored in landscape — the building settles into the site, not onto it.' },
      { start: 0.52, end: 0.86, label: 'Landscape Edge',     title: 'Where Architecture Ends',   body: 'Native grasses and indigenous stone drift against the building\'s base. There is no hard line between the built and the grown — the boundary dissolves, and architecture becomes land.' },
    ],
  },
];

// ── DOM ───────────────────────────────────────────────────────
const videos       = SECTIONS.map(s => document.getElementById(s.videoId));
const loaderEl     = document.getElementById('loader');
const loaderFill   = document.getElementById('loader-fill');
const loaderLabel  = document.getElementById('loader-label');
const progressFill = document.getElementById('progress-fill');
const counterNum   = document.getElementById('counter-num');
const dotList      = document.getElementById('dot-list');
const textLayer    = document.getElementById('text-layer');
const scrollHint   = document.getElementById('scroll-hint');

// ── File:// guard ─────────────────────────────────────────────
if (window.location.protocol === 'file:') {
  document.getElementById('file-warning').classList.add('show');
}

// ── Helpers ───────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function seekVideo(video, time) {
  const dur = video.duration;
  if (!dur || !isFinite(dur) || dur <= 0) return;
  try { video.currentTime = clamp(time, 0, dur - 0.01); } catch (_) {}
}

// ── Video visibility ──────────────────────────────────────────
// We use opacity instead of display:none so browser keeps video decoded.
let activeBack  = -1;
let activeFront = -1;

function showBack(idx) {
  if (idx === activeBack) return;
  // Hide old back
  if (activeBack >= 0) {
    videos[activeBack].classList.remove('v-back');
  }
  videos[idx].classList.add('v-back');
  activeBack = idx;
}

function showFront(idx, topInsetPct) {
  // Hide old front if different
  if (activeFront >= 0 && activeFront !== idx) {
    videos[activeFront].classList.remove('v-front');
    videos[activeFront].style.clipPath = '';
  }
  videos[idx].classList.add('v-front');
  // clip-path: inset(top% 0 0 0)
  // topInsetPct=100 → fully hidden (top clips all), 0 → fully visible
  videos[idx].style.clipPath = `inset(${topInsetPct.toFixed(2)}% 0 0 0)`;
  activeFront = idx;
}

function hideFront() {
  if (activeFront >= 0) {
    videos[activeFront].classList.remove('v-front');
    videos[activeFront].style.clipPath = '';
    activeFront = -1;
  }
}

// ── Text panels ───────────────────────────────────────────────
let allPanels = [];

function buildTextPanels() {
  SECTIONS.forEach((sec, si) => {
    sec.texts.forEach(cfg => {
      const div = document.createElement('div');
      div.className = 'text-panel';
      div.innerHTML = `<div class="t-label">${cfg.label}</div><h2 class="t-title">${cfg.title}</h2><p class="t-body">${cfg.body}</p>`;
      textLayer.appendChild(div);
      allPanels.push({ el: div, si, cfg });
    });
  });
}

function updateText(si, progress) {
  allPanels.forEach(p => {
    const show = p.si === si && progress >= p.cfg.start && progress <= p.cfg.end;
    p.el.classList.toggle('show', show);
  });
}

// ── Nav dots ──────────────────────────────────────────────────
let dots = [];

function buildDots() {
  SECTIONS.forEach((_, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'nav-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `Shot ${i + 1}`);
    btn.addEventListener('click', () => {
      window.scrollTo({ top: i * SECTION_VH * window.innerHeight + 1, behavior: 'smooth' });
    });
    li.appendChild(btn);
    dotList.appendChild(li);
    dots.push(btn);
  });
}

function updateDots(si) {
  dots.forEach((d, i) => d.classList.toggle('active', i === si));
  counterNum.textContent = String(si + 1).padStart(2, '0');
}

// ── Main render ───────────────────────────────────────────────
let rafId = null;
let lastSi = -1;

function render() {
  rafId = null;

  const scrollY = window.scrollY;
  const vh      = window.innerHeight;

  // Pixels per section and sub-ranges
  const sectPx  = SECTION_VH * vh;
  const playPx  = PLAY_VH    * vh;
  const transPx = TRANS_VH   * vh;

  // Current section index (clamped)
  const si     = Math.min(Math.floor(scrollY / sectPx), SECTIONS.length - 1);
  const within = scrollY - si * sectPx;

  const inTransition = within >= playPx && si < SECTIONS.length - 1;

  if (inTransition) {
    // ─ Wipe from bottom ──────────────────────────────────────
    // tp: 0 (just entered transition) → 1 (transition complete)
    const tp      = clamp((within - playPx) / transPx, 0, 1);
    // topInsetPct: 100 (new video hidden above) → 0 (fully revealed)
    const insetPct = (1 - tp) * 100;

    showBack(si);
    seekVideo(videos[si], videos[si].duration || 999);   // freeze at last frame

    showFront(si + 1, insetPct);
    seekVideo(videos[si + 1], 0);                        // front starts at frame 0

    updateText(si, 0.9);  // keep last text visible during wipe

  } else {
    // ─ Normal playback ────────────────────────────────────────
    const progress = clamp(within / playPx, 0, 1);

    showBack(si);
    hideFront();
    seekVideo(videos[si], progress * (videos[si].duration || 0));
    updateText(si, progress);
  }

  // ─ UI updates ─────────────────────────────────────────────
  if (si !== lastSi) { updateDots(si); lastSi = si; }

  const maxScroll = document.documentElement.scrollHeight - vh;
  progressFill.style.width = (maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0).toFixed(2) + '%';

  if (scrollY > 20 && !scrollHint.classList.contains('out')) {
    scrollHint.classList.add('out');
  }
}

function onScroll() {
  if (!rafId) rafId = requestAnimationFrame(render);
}

// ── Preload & Init ────────────────────────────────────────────
function init() {
  buildDots();
  buildTextPanels();

  let metaReady = 0;
  let launched  = false;

  function tryLaunch() {
    if (launched) return;
    const dur = videos[0].duration;
    if (!dur || !isFinite(dur)) return;   // wait until video[0] duration is known
    launched = true;

    loaderLabel.textContent = 'Ready';
    setTimeout(() => {
      loaderEl.classList.add('out');
      // Show first video
      showBack(0);
      seekVideo(videos[0], 0);
      render();
      // Attach scroll AFTER launching so first render runs clean
      window.addEventListener('scroll', onScroll, { passive: true });
    }, 400);
  }

  videos.forEach((v, i) => {
    // loadedmetadata = duration is now available
    const onMeta = () => {
      metaReady++;
      loaderFill.style.width = ((metaReady / videos.length) * 100).toFixed(0) + '%';
      if (i === 0) tryLaunch();
    };

    if (v.readyState >= 1) {
      onMeta();
    } else {
      v.addEventListener('loadedmetadata', onMeta, { once: true });
    }

    // If duration was initially reported as Infinity (before full load),
    // it will update later via durationchange
    v.addEventListener('durationchange', () => {
      if (i === 0) tryLaunch();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
