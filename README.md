# ArchViz — Scroll-Driven Cinematic Experience

Scroll-driven video animation site. Seven architectural sequences play frame-by-frame as you scroll, with wipe transitions between clips and contextual text overlays.

## Quick start

```bash
npm install
npm run dev
```

Opens at **http://localhost:3000**

## Re-encode videos (run once after adding new shots)

```bash
npm run encode
```

Outputs web-optimised MP4s to `public/` with:
- Faststart (moov atom at front — required for HTTP seeking)
- Keyframe every 15 frames (fast seek accuracy)
- Audio stripped

## Project structure

```
├── index.html          # Entry point
├── src/
│   ├── main.js         # Scroll engine + video scrubber
│   └── style.css       # All styles
├── public/
│   └── Shot_*.mp4      # Web-encoded videos (committed to git)
├── scripts/
│   └── encode.js       # FFmpeg re-encoding script
└── package.json
```

## How the scroll engine works

1. **Videos** decode silently (opacity 0, 1×1 px) — no memory overhead
2. **Two canvases** (`canvas-back` / `canvas-front`) display frames
3. **Seek queue** per video — prevents concurrent seeks and ensures the canvas always shows the correct frame after `seeked` fires
4. **Transitions** — CSS `clip-path: inset(X% 0 0 0)` on `#front-clip`, driven directly by scroll (wipe from bottom)
5. **Text panels** — GSAP fade triggered by scroll progress within each section
