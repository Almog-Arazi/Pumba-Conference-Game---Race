/**
 * Photo capture pipeline:
 * 1. captureAndSegmentPhoto  – grabs a video frame, removes background via MediaPipe
 * 2. composeShareCard        – composites player + bg + text/logo onto a canvas
 * 3. uploadToImgBB           – uploads the card and returns a public URL
 */

import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

const IMGBB_API_KEY = '59967a804d172cb8ec0345c3be57f73f';
const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
const SELFIE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

// ─── Utilities ────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw text with automatic word-wrap, returns final y after last line */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

// ─── Step 1: Capture + segment ────────────────────────────────────────────────

/**
 * Captures the current video frame (mirrored to match on-screen view),
 * removes the background using MediaPipe Selfie Segmentation,
 * and returns a PNG data URL with transparent background.
 */
export async function captureAndSegmentPhoto(
  video: HTMLVideoElement,
): Promise<string | null> {
  try {
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (!W || !H) return null;

    // --- Capture mirrored frame (matches what the user sees) ---
    const raw = document.createElement('canvas');
    raw.width  = W;
    raw.height = H;
    const rawCtx = raw.getContext('2d')!;
    rawCtx.translate(W, 0);
    rawCtx.scale(-1, 1);
    rawCtx.drawImage(video, 0, 0);
    rawCtx.setTransform(1, 0, 0, 1, 0, 0);

    // --- MediaPipe Selfie Segmentation ---
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    const segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: SELFIE_MODEL,
        delegate: 'GPU',
      },
      outputConfidenceMasks: true,
      outputCategoryMask:    false,
      runningMode: 'IMAGE',
    });

    const result = segmenter.segment(raw);
    const mask   = result.confidenceMasks![0].getAsFloat32Array();

    // Apply alpha from mask (1 = person, 0 = background)
    const imageData = rawCtx.getImageData(0, 0, W, H);
    const pixels    = imageData.data;
    for (let i = 0; i < mask.length; i++) {
      // Sharpen the mask slightly: values below 0.4 → 0, above 0.6 → full
      const alpha = Math.min(1, Math.max(0, (mask[i] - 0.35) / 0.3));
      pixels[i * 4 + 3] = Math.round(alpha * 255);
    }
    rawCtx.putImageData(imageData, 0, 0);

    segmenter.close();
    return raw.toDataURL('image/png');
  } catch (err) {
    console.error('[photoCapture] segmentation failed:', err);
    return null;
  }
}

// ─── Step 2: Compose share card ───────────────────────────────────────────────

/**
 * Player photo placement within the 1200×630 card.
 * Tune these via the /calibrate page and update here.
 */
// Tune via /calibrate: drag player/car, then Copy Code and paste values here
export const PLAYER_DEFAULTS = {
  xPct:    0.293,
  yPct:    0.403,
  scalePct: 0.500,
};

export const CAR_DEFAULTS = {
  xPct:    -0.003,
  yPct:    1.117,
  scalePct: 1.375,
};

interface ComposeOptions {
  playerPhotoUrl: string | null;
  name:           string;
  company:        string;
  parkingCount:   number;
  // Optional overrides from calibration
  playerXPct?:    number;
  playerYPct?:    number;
  playerScalePct?: number;
  carXPct?:       number;
  carYPct?:       number;
  carScalePct?:   number;
}

/** Remove near-white pixels from an image (for the car overlay). */
function removeWhiteBackground(img: HTMLImageElement, threshold = 230): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      d.data[i + 3] = 0; // fully transparent
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/**
 * Renders a 1200×630 share card with 3 layers:
 *   1. Street background (street-bg.jpeg)
 *   2. Player photo (segmented, no background) — positioned via calibration values
 *   3. Car overlay (car-overlay.jpg, white removed)
 * Plus a right-side info panel.
 */
export async function composeShareCard(opts: ComposeOptions): Promise<string> {
  const W = 1200, H = 630;
  const SPLIT = W * 0.52; // right info panel starts here

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Layer 1: Street background ──────────────────────────────────────────────
  try {
    const bg = await loadImage('/street-bg.jpeg');
    ctx.drawImage(bg, 0, 0, W, H);
  } catch {
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Layer 2: Player photo (same box as calibration: height = scalePct, aspect 3:4) ──
  if (opts.playerPhotoUrl) {
    try {
      const photo   = await loadImage(opts.playerPhotoUrl);
      const xPct    = opts.playerXPct    ?? PLAYER_DEFAULTS.xPct;
      const yPct    = opts.playerYPct    ?? PLAYER_DEFAULTS.yPct;
      const sPct    = opts.playerScalePct ?? PLAYER_DEFAULTS.scalePct;
      // Match calibration page: box height = scalePct of card, aspect 3:4 (portrait)
      const boxH    = H * sPct;
      const boxW    = boxH * (4 / 3);
      const boxLeft = W * xPct - boxW / 2;
      const boxTop  = H * yPct - boxH / 2;
      // Fit photo inside box (object-contain)
      const scale   = Math.min(boxW / photo.width, boxH / photo.height);
      const drawW   = photo.width * scale;
      const drawH   = photo.height * scale;
      const px      = boxLeft + (boxW - drawW) / 2;
      const py      = boxTop + (boxH - drawH) / 2;
      ctx.drawImage(photo, px, py, drawW, drawH);
    } catch { /* skip */ }
  }

  // ── Layer 3: Car overlay (white bg removed) ──────────────────────────────────
  try {
    const carImg = await loadImage('/car-overlay.jpg');
    const carCanvas = removeWhiteBackground(carImg);
    const carH = H * (opts.carScalePct ?? CAR_DEFAULTS.scalePct);
    const carW = (carCanvas.width / carCanvas.height) * carH;
    const carX = W * (opts.carXPct ?? CAR_DEFAULTS.xPct) - 30; // -30px left
    const carY = H * (opts.carYPct ?? CAR_DEFAULTS.yPct) - carH + 40; // +40px lower
    ctx.drawImage(carCanvas, carX, carY, carW, carH);
  } catch { /* skip */ }

  // ── Right info panel ─────────────────────────────────────────────────────────
  const RX = SPLIT + 20;
  const RW = W - RX - 30;
  const CX = SPLIT + (W - SPLIT) / 2;

  // Semi-transparent dark panel
  ctx.fillStyle = 'rgba(5, 10, 50, 0.80)';
  ctx.roundRect?.(SPLIT, 0, W - SPLIT, H, [0]);
  ctx.fill();

  // Logo
  try {
    const logo = await loadImage('/logo_2.svg');
    const lh = 44, lw = (714 / 226) * lh;
    ctx.drawImage(logo, CX - lw / 2, 28, lw, lh);
  } catch { /* skip */ }

  // Divider
  ctx.strokeStyle = 'rgba(66,200,190,0.4)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(RX, 88); ctx.lineTo(W - 30, 88); ctx.stroke();

  // Name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = `bold 48px "Arial Black", Impact, Arial, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  const nameEndY = wrapText(ctx, opts.name, CX, 158, RW, 54);

  // Company
  ctx.font = `400 22px Arial, sans-serif`;
  ctx.fillStyle  = 'rgba(66,200,190,0.9)';
  ctx.shadowBlur = 0;
  wrapText(ctx, opts.company, CX, nameEndY + 8, RW, 28);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.moveTo(RX, 330); ctx.lineTo(W - 30, 330); ctx.stroke();

  // Parking count
  ctx.shadowColor = 'rgba(66,200,190,0.7)'; ctx.shadowBlur = 22;
  ctx.fillStyle   = '#42C8BE';
  ctx.font        = `bold 128px "Arial Black", Impact, Arial, sans-serif`;
  ctx.fillText(String(opts.parkingCount), CX, 500);

  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(255,255,255,0.6)';
  ctx.font       = `bold 17px Arial, sans-serif`;
  (ctx as any).letterSpacing = '4px';
  ctx.fillText('SPOTS PARKED', CX, 536);
  (ctx as any).letterSpacing = '0px';

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font      = `13px Arial, sans-serif`;
  ctx.fillText('pumba.app · The Parking Game', CX, H - 18);

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ─── Step 3: Upload ───────────────────────────────────────────────────────────

/** Uploads a data URL to ImgBB and returns the direct image URL. */
export async function uploadToImgBB(dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Invalid data URL');

  const form = new FormData();
  form.append('key',   IMGBB_API_KEY);
  form.append('image', base64);
  form.append('name',  `pumba-${Date.now()}`);

  const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const data = await res.json();

  if (!data.success) throw new Error(`ImgBB error: ${data.error?.message ?? 'unknown'}`);
  // data.data.url        = viewer page
  // data.data.image.url  = direct image URL
  return data.data.image?.url ?? data.data.url;
}
