/**
 * Re-encodes videos for smooth web scrubbing:
 *   - Adds faststart (moov atom at front — required for seeking before full download)
 *   - Sets keyframe every 15 frames (~0.5 s at 30 fps) for fast seek accuracy
 *   - Strips audio (not needed for scroll-driven visuals)
 *   - Outputs to public/ folder so Vite serves them
 *
 * Run once: npm run encode
 */
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

ffmpeg.setFfmpegPath(ffmpegPath);

const shots = [
  { input: 'Shot_1.mp4', output: 'public/Shot_1.mp4' },
  { input: 'Shot_2.mp4', output: 'public/Shot_2.mp4' },
  { input: 'Shot_3.mp4', output: 'public/Shot_3.mp4' },
  { input: 'Shot_4.mp4', output: 'public/Shot_4.mp4' },
  { input: 'Shot_5.mp4', output: 'public/Shot_5.mp4' },
  { input: 'Shot_6.mp4', output: 'public/Shot_6.mp4' },
  { input: 'Shot_7.mp4', output: 'public/Shot_7.mp4' },
];

if (!existsSync(resolve(root, 'public'))) {
  mkdirSync(resolve(root, 'public'));
}

function encodeShot({ input, output }, index) {
  return new Promise((res, rej) => {
    const src = resolve(root, input);
    const dst = resolve(root, output);

    console.log(`[${index + 1}/${shots.length}] Encoding ${input} …`);

    ffmpeg(src)
      .videoCodec('libx264')
      .outputOptions([
        '-crf 22',          // quality (18=lossless, 28=low; 22 is a good web balance)
        '-preset fast',
        '-g 15',            // keyframe every 15 frames → fast seeking
        '-keyint_min 15',
        '-sc_threshold 0',  // disable scene-cut keyframes (keeps interval strict)
        '-movflags +faststart',  // moov atom at front — enables seeking before full download
        '-pix_fmt yuv420p', // broad browser compatibility
        '-an',              // strip audio
      ])
      .on('progress', p => {
        process.stdout.write(`\r   ${Math.round(p.percent ?? 0)}%`);
      })
      .on('end', () => {
        console.log(`\r   Done → ${output}`);
        res();
      })
      .on('error', err => {
        console.error(`\n   Error encoding ${input}:`, err.message);
        rej(err);
      })
      .save(dst);
  });
}

(async () => {
  for (let i = 0; i < shots.length; i++) {
    await encodeShot(shots[i], i);
  }
  console.log('\n✓ All videos encoded. Run "npm run dev" to start.');
})();
