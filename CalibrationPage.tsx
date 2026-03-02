/**
 * /calibrate — interactive calibration tool.
 * - Live camera with gesture detection (Open Palm = capture + segment)
 * - Drag player photo AND car overlay independently
 * - Shows real-time coordinates to paste into photoCapture.ts
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import { captureAndSegmentPhoto, composeShareCard, PLAYER_DEFAULTS, CAR_DEFAULTS } from './components/System/photoCapture';

// ── White-bg removal ──────────────────────────────────────────────────────────
function removeWhiteBg(img: HTMLImageElement, threshold = 230): string {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i] >= threshold && d.data[i+1] >= threshold && d.data[i+2] >= threshold)
      d.data[i+3] = 0;
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────

type DragTarget = 'player' | 'car' | null;

const CalibrationPage: React.FC = () => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef        = useRef<number>(0);
  const dragTarget    = useRef<DragTarget>(null);
  const dragStart     = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Player
  const [playerXPct,    setPlayerXPct]    = useState(PLAYER_DEFAULTS.xPct);
  const [playerYPct,    setPlayerYPct]    = useState(PLAYER_DEFAULTS.yPct);
  const [playerScalePct, setPlayerScalePct] = useState(PLAYER_DEFAULTS.scalePct);
  const [playerSrc,     setPlayerSrc]     = useState<string | null>(null);

  // Car
  const [carXPct,    setCarXPct]    = useState(CAR_DEFAULTS.xPct);
  const [carYPct,    setCarYPct]    = useState(CAR_DEFAULTS.yPct);
  const [carScalePct, setCarScalePct] = useState(CAR_DEFAULTS.scalePct);
  const [carSrc,     setCarSrc]     = useState<string | null>(null);

  // Camera state
  const [camStarted,   setCamStarted]   = useState(false);
  const [camLoading,   setCamLoading]   = useState(false);
  const [gestureLabel, setGestureLabel] = useState('—');
  const [capturing,    setCapturing]    = useState(false);
  const capturedRef = useRef(false); // debounce one capture at a time

  // Load car on mount
  useEffect(() => {
    const img = new Image();
    img.onload = () => setCarSrc(removeWhiteBg(img));
    img.src = '/car-overlay.jpg';
  }, []);

  // ── Camera + gesture detection ──────────────────────────────────────────────
  const startCamera = async () => {
    setCamLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Load MediaPipe GestureRecognizer
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );
      recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      setCamStarted(true);
      setCamLoading(false);
      runDetection();
    } catch (e) {
      console.error(e);
      setCamLoading(false);
    }
  };

  const runDetection = () => {
    const video = videoRef.current;
    const rec   = recognizerRef.current;
    if (!video || !rec || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetection);
      return;
    }
    const results = rec.recognizeForVideo(video, performance.now());
    const gesture = results.gestures?.[0]?.[0];
    const name    = gesture?.categoryName ?? 'None';
    setGestureLabel(name);

    const isOpen = name === 'Open_Palm' && (gesture?.score ?? 0) > 0.6;
    if (isOpen && !capturedRef.current) {
      capturedRef.current = true;
      setCapturing(true);
      captureAndSegmentPhoto(video).then(photo => {
        if (photo) setPlayerSrc(photo);
        setCapturing(false);
        setTimeout(() => { capturedRef.current = false; }, 2000);
      });
    }
    if (!isOpen) capturedRef.current = false;

    rafRef.current = requestAnimationFrame(runDetection);
  };

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  // ── Dragging ─────────────────────────────────────────────────────────────────
  const startDrag = useCallback((target: DragTarget, e: { clientX: number; clientY: number }) => {
    dragTarget.current = target;
    dragStart.current = {
      mx: e.clientX, my: e.clientY,
      px: target === 'player' ? playerXPct : carXPct,
      py: target === 'player' ? playerYPct : carYPct,
    };
  }, [playerXPct, playerYPct, carXPct, carYPct]);

  const onMove = useCallback((cx: number, cy: number) => {
    if (!dragTarget.current || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const dx = (cx - dragStart.current.mx) / width;
    const dy = (cy - dragStart.current.my) / height;
    const nx = Math.max(-0.2, Math.min(1.2, dragStart.current.px + dx));
    const ny = Math.max(-0.2, Math.min(1.4, dragStart.current.py + dy));
    if (dragTarget.current === 'player') { setPlayerXPct(nx); setPlayerYPct(ny); }
    else                                  { setCarXPct(nx);    setCarYPct(ny);    }
  }, []);

  const stopDrag = useCallback(() => { dragTarget.current = null; }, []);

  useEffect(() => {
    const mm = (e: MouseEvent)  => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent)  => onMove(e.touches[0].clientX, e.touches[0].clientY);
    window.addEventListener('mousemove', mm);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('mouseup',   stopDrag);
    window.addEventListener('touchend',  stopDrag);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('mouseup',   stopDrag);
      window.removeEventListener('touchend',  stopDrag);
    };
  }, [onMove, stopDrag]);

  // ── Code snippet ──────────────────────────────────────────────────────────────
  const snippet =
`export const PLAYER_DEFAULTS = {
  xPct:     ${playerXPct.toFixed(3)},
  yPct:     ${playerYPct.toFixed(3)},
  scalePct: ${playerScalePct.toFixed(3)},
};

export const CAR_DEFAULTS = {
  xPct:     ${carXPct.toFixed(3)},
  yPct:     ${carYPct.toFixed(3)},
  scalePct: ${carScalePct.toFixed(3)},
};`;

  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Game preview (exact same as share card in game) ────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewClosedRef = useRef(false);
  const runPreview = async () => {
    previewClosedRef.current = false;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl(null);
    try {
      const dataUrl = await composeShareCard({
        playerPhotoUrl: playerSrc,
        name: 'Player',
        company: 'Company',
        parkingCount: 5,
        playerXPct, playerYPct, playerScalePct,
        carXPct, carYPct, carScalePct,
      });
      if (!previewClosedRef.current) setPreviewUrl(dataUrl);
    } catch (e) {
      if (!previewClosedRef.current) setPreviewError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      if (!previewClosedRef.current) setPreviewLoading(false);
    }
  };
  const closePreview = () => {
    previewClosedRef.current = true;
    setPreviewUrl(null);
    setPreviewError('');
    setPreviewLoading(false);
  };

  // ── Gesture badge color ───────────────────────────────────────────────────────
  const badgeColor = gestureLabel === 'Open_Palm'
    ? 'bg-green-500' : gestureLabel === 'None' ? 'bg-gray-700' : 'bg-yellow-600';

  return (
    <div className="h-screen overflow-hidden bg-gray-950 text-white font-sans flex flex-col select-none">
      {/* Header — compact */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <h1 className="text-base font-black">🎯 Calibration</h1>
        <a href="/" className="text-gray-500 hover:text-gray-300 text-xs">← Back</a>
      </header>

      <div className="flex flex-1 gap-0 min-h-0 overflow-hidden">

        {/* ── Canvas ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-2 bg-gray-900 min-h-0 min-w-0">
          <div
            ref={containerRef}
            className="relative w-full h-full max-w-full max-h-full overflow-hidden rounded-lg shadow-2xl border border-gray-700"
            style={{ aspectRatio: '1200/630' }}
          >
            {/* Layer 1: Background */}
            <img src="/street-bg.jpeg" alt="bg" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

            {/* Layer 2: Player (draggable) */}
            <div
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                height:      `${playerScalePct * 100}%`,
                aspectRatio: '3/4',
                left:  `${playerXPct * 100}%`,
                top:   `${playerYPct * 100}%`,
                transform:   'translate(-50%, -50%)',
                zIndex: 10,
              }}
              onMouseDown={e => { e.preventDefault(); startDrag('player', e); }}
              onTouchStart={e => startDrag('player', e.touches[0])}
            >
              {playerSrc ? (
                <img src={playerSrc} alt="player" className="w-full h-full object-contain" draggable={false} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center
                                bg-cyan-500/20 border-2 border-dashed border-cyan-400/70 rounded-lg">
                  <span className="text-3xl">🧍</span>
                  <span className="text-cyan-300 text-[10px] font-bold mt-1 text-center px-1">Open hand on camera</span>
                </div>
              )}
              <div className="absolute -top-1 -right-1 bg-cyan-500 rounded-full w-3 h-3 shadow pointer-events-none" />
            </div>

            {/* Layer 3: Car (draggable) */}
            {carSrc && (
              <div
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                  height:      `${carScalePct * 100}%`,
                  aspectRatio: `${1020 / 635}`,   // approximate car image ratio
                  left:  `${carXPct * 100}%`,
                  bottom: `${(1 - carYPct) * 100}%`,
                  zIndex: 20,
                }}
                onMouseDown={e => { e.preventDefault(); startDrag('car', e); }}
                onTouchStart={e => startDrag('car', e.touches[0])}
              >
                <img src={carSrc} alt="car" className="w-full h-full object-contain" draggable={false} />
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full w-3 h-3 shadow pointer-events-none" />
              </div>
            )}

            {/* Drag labels */}
            <div className="absolute top-2 left-2 flex gap-2 pointer-events-none" style={{ zIndex: 30 }}>
              <span className="bg-cyan-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🧍 drag player</span>
              <span className="bg-orange-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🚙 drag car</span>
            </div>

            {/* Capture flash */}
            {capturing && (
              <div className="absolute inset-0 bg-white/30 pointer-events-none" style={{ zIndex: 50 }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                bg-black/70 rounded-2xl px-6 py-3 text-white font-black text-lg">
                  📸 Capturing…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Controls panel (compact) ───────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-2 p-2 bg-gray-950 border-l border-gray-800 text-sm overflow-hidden">
          <div className="relative bg-black rounded-lg overflow-hidden border border-gray-800" style={{ aspectRatio: '16/9' }}>
            <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" muted playsInline />
            {!camStarted && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/90">
                <button
                  onClick={startCamera}
                  disabled={camLoading}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg"
                >
                  {camLoading ? '…' : '▶ Camera'}
                </button>
                <span className="text-gray-500 text-[9px]">Open palm → capture</span>
              </div>
            )}
            {camStarted && (
              <span className={`absolute bottom-0.5 left-0.5 ${badgeColor} text-white text-[9px] font-bold px-1.5 py-0.5 rounded`}>
                {gestureLabel}
              </span>
            )}
          </div>
          <div className="flex gap-2 min-h-0 flex-1">
            <div className="flex-1 bg-gray-900 rounded-lg p-2 border border-cyan-900/50">
              <p className="text-[10px] font-bold text-cyan-400 mb-1">🧍</p>
              <Slider label="X" value={playerXPct} min={-0.2} max={1.2} step={0.001} color="cyan" onChange={setPlayerXPct} />
              <Slider label="Y" value={playerYPct} min={-0.2} max={1.4} step={0.001} color="cyan" onChange={setPlayerYPct} />
              <Slider label="S" value={playerScalePct} min={0.1} max={1.5} step={0.005} color="cyan" onChange={setPlayerScalePct} />
            </div>
            <div className="flex-1 bg-gray-900 rounded-lg p-2 border border-orange-900/50">
              <p className="text-[10px] font-bold text-orange-400 mb-1">🚙</p>
              <Slider label="X" value={carXPct} min={-0.3} max={1.2} step={0.001} color="orange" onChange={setCarXPct} />
              <Slider label="Y" value={carYPct} min={0.3} max={1.4} step={0.001} color="orange" onChange={setCarYPct} />
              <Slider label="S" value={carScalePct} min={0.2} max={1.5} step={0.005} color="orange" onChange={setCarScalePct} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed bottom bar: code + Preview + Copy ───────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-gray-900 border-t border-gray-700">
        <span className="text-gray-500 text-xs font-bold whitespace-nowrap">Code → photoCapture.ts</span>
        <pre
          className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-green-400 font-mono text-[11px] leading-tight overflow-x-auto whitespace-pre select-all"
          title="Select and copy"
        >
          {snippet}
        </pre>
        <button
          onClick={runPreview}
          disabled={previewLoading}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 select-none"
        >
          {previewLoading ? '…' : '🎮 Preview'}
        </button>
        <button
          onClick={copy}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors select-none ${copied ? 'bg-green-600' : 'bg-cyan-600 hover:bg-cyan-500'}`}
        >
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>

      {/* ── Game preview modal (exact share card as in game) ───────────────────── */}
      {(previewUrl !== null || previewLoading || previewError) && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4"
          onClick={() => !previewLoading && closePreview()}
        >
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            {previewLoading && (
              <div className="text-white font-bold text-lg">Generating game card…</div>
            )}
            {previewError && (
              <div className="text-red-400 font-bold text-sm bg-gray-900 px-4 py-3 rounded-xl">{previewError}</div>
            )}
            {previewUrl && (
              <>
                <p className="text-center text-cyan-400 text-xs font-bold mb-2">Exactly as in game (same offsets)</p>
                <img src={previewUrl} alt="Game card preview" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
              </>
            )}
            <button
              onClick={closePreview}
              className="absolute -top-10 right-0 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Slider helper ─────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
  cyan:   'accent-cyan-500',
  orange: 'accent-orange-500',
};

const Slider: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  color: string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step, color, onChange }) => (
  <div className="mb-2">
    <div className="flex justify-between text-[11px] text-gray-400 mb-0.5">
      <span>{label}</span>
      <span className="font-mono font-bold text-white">{value.toFixed(3)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)}
      className={`w-full h-1.5 ${colorMap[color] ?? 'accent-white'}`}
    />
  </div>
);

export default CalibrationPage;
