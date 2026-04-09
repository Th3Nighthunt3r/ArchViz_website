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
const SECTION_VH = 100;                     // CSS vh of scroll per section (100 = 1 screen)
const TRANS_VH   = 15;                      // last N vh → wipe transition
const PLAY_VH    = SECTION_VH - TRANS_VH;  // 85 vh → normal playback

// ─────────────────────────────────────────────────────────────────
//  EDIT TEXT HERE
//  Each section has one or two text overlays.
//  start / end = scroll progress (0–1) within that section when
//  the text is visible. 0.15–0.75 is a comfortable reading window.
// ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    videoId: 'v0',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Living Room',
        title: 'Layered Light & Texture',
        body:  'Warm timber slats draw the eye upward while natural light pools across the concrete floor — a space designed as much for atmosphere as for living.',
      },
    ],
  },
  {
    videoId: 'v1',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'The Kitchen',
        title: 'Bold Colour, Quiet Precision',
        body:  'Handcrafted terracotta tiles meet matte cabinetry and black steel — a palette that feels both grounded and alive under the soft glow of recessed lighting.',
      },
    ],
  },
  {
    videoId: 'v2',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Dining Area',
        title: 'Where Meals Become Moments',
        body:  'A generous stone table anchors the room without dominating it. Around it, seating in natural linen invites long evenings and unhurried conversation.',
      },
    ],
  },
  {
    videoId: 'v3',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Master Bedroom',
        title: 'Stillness, Considered',
        body:  'Soft neutrals, a low platform bed, and blackout drapes reduce the room to its essentials — a retreat stripped of noise, built entirely for rest.',
      },
    ],
  },
  {
    videoId: 'v4',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Study',
        title: 'Focus in Form',
        body:  'Floor-to-ceiling joinery conceals every necessity, leaving only a clear desk, a single pendant, and a window framing the sky — nothing competes for attention.',
      },
    ],
  },
  {
    videoId: 'v5',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Bathroom',
        title: 'The Ritual of Stone',
        body:  'Bookmatched marble runs uninterrupted from floor to ceiling. Brushed brass fittings catch the light at dawn — the room functions as a daily ritual, not just a room.',
      },
    ],
  },
  {
    videoId: 'v6',
    texts: [
      {
        start: 0.15, end: 0.75,
        label: 'Terrace',
        title: 'Inside, Dissolved',
        body:  'Full-height glazing slides away entirely, erasing the threshold between the living room and the terrace — indoor comfort extending without interruption into open air.',
      },
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
  frontClip.style.opacity = progress.toFixed(3);
}

function hideFront() {
  frontClip.style.opacity = '0';
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
      window.scrollTo({ top: i * SECTION_VH * (window.innerHeight / 100) + 2, behavior: 'smooth' });
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
  const vhPx    = vh / 100;               // 1 CSS vh in pixels
  const sectPx  = SECTION_VH * vhPx;
  const playPx  = PLAY_VH    * vhPx;
  const transPx = TRANS_VH   * vhPx;

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
    const si     = Math.min(Math.floor(window.scrollY / (SECTION_VH * (window.innerHeight / 100))), SECTIONS.length - 1);
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
