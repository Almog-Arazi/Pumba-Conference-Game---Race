/**
 * Road Calibration Overlay (F-Mode)
 *
 * The user drags 4 handles that mark the visible road trapezoid:
 *   TL — top-left  road corner  (far end)
 *   TR — top-right road corner  (far end)
 *   BL — bottom-left  road corner (near camera)
 *   BR — bottom-right road corner (near camera)
 *
 * The vanishing point is computed as the intersection of the
 * left (BL→TL) and right (BR→TR) edge lines — it may lie
 * outside the visible frame, which is fine.
 *
 * From the VP Y position + road bottom width the component solves
 * for the Three.js camera params (camY, fov).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CameraCalibration {
  camY: number;
  camZ: number;
  fov: number;
  lookZ: number;
  lookY: number; // vertical shift of the entire scene (negative = shift scene up)
}

interface Pt { x: number; y: number } // 0–1 normalized screen coords

interface Handles {
  tl: Pt; // top-left  (far road corner)
  tr: Pt; // top-right (far road corner)
  bl: Pt; // bottom-left  (near road corner)
  br: Pt; // bottom-right (near road corner)
}

interface Props {
  initialCalibration: CameraCalibration;
  onApply:  (cal: CameraCalibration) => void;
  onChange: (cal: CameraCalibration) => void; // real-time, no save
  onClose:  () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROAD_WIDTH_3D = 6.6;  // 3 lanes × 2.2 units
const CAM_Z  = 8;
const LOOK_Z = -30;
const DIST   = CAM_Z - LOOK_Z; // 38

const HANDLE_R = 20; // px, half-size of hit zone

const HANDLES_KEY = 'pumba_cal_handles';

/** Sensible default trapezoid for a typical forward-looking street */
const DEFAULT_HANDLES: Handles = {
  tl: { x: 0.40, y: 0.44 },
  tr: { x: 0.60, y: 0.44 },
  bl: { x: 0.22, y: 0.88 },
  br: { x: 0.78, y: 0.88 },
};

function loadHandles(): Handles {
  try {
    const raw = localStorage.getItem(HANDLES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HANDLES;
  } catch {
    return DEFAULT_HANDLES;
  }
}

function saveHandles(h: Handles) {
  localStorage.setItem(HANDLES_KEY, JSON.stringify(h));
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Intersection of line (p1→p2) and line (p3→p4) in normalised coords.
 *  Returns null if lines are parallel. */
function lineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/** Derive the vanishing point from the 4 road corners.
 *  Falls back to a point above the frame if lines are nearly parallel. */
function computeVP(h: Handles): Pt {
  const vp = lineIntersect(h.bl, h.tl, h.br, h.tr);
  return vp ?? { x: (h.tl.x + h.tr.x) / 2, y: -0.5 };
}

// ─── Camera solver ────────────────────────────────────────────────────────────

/**
 * Given horizonFrac (VP.y, may be < 0 = above frame) and roadWidthFrac,
 * sweep FOV to find the camera params that reproduce both constraints.
 */
function solveCamera(
  horizonFrac: number,
  roadWidthFrac: number,
  aspect: number,
): CameraCalibration {
  let bestFov = 60;
  let bestErr = Infinity;

  for (let fov = 25; fov <= 110; fov += 0.25) {
    const fov_r   = (fov * Math.PI) / 180;
    const alpha_r = (0.5 - horizonFrac) * fov_r;
    const camY    = Math.tan(alpha_r) * DIST;
    if (camY < 0.3) continue;

    const bottomAngle = alpha_r + fov_r / 2;
    if (Math.tan(bottomAngle) <= 0) continue;
    const d_z = camY / Math.tan(bottomAngle);
    if (d_z <= 0) continue;

    const fov_h     = 2 * Math.atan(Math.tan(fov_r / 2) * aspect);
    const predicted = ROAD_WIDTH_3D / (2 * d_z * Math.tan(fov_h / 2));

    const err = Math.abs(predicted - roadWidthFrac);
    if (err < bestErr) { bestErr = err; bestFov = fov; }
  }

  const fov_r   = (bestFov * Math.PI) / 180;
  const alpha_r = (0.5 - horizonFrac) * fov_r;
  const camY    = Math.max(0.3, Math.tan(alpha_r) * DIST);

  return { camY, camZ: CAM_Z, fov: bestFov, lookZ: LOOK_Z, lookY: 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CalibrationOverlay: React.FC<Props> = ({ initialCalibration, onApply, onChange, onClose }) => {
  const containerRef                = useRef<HTMLDivElement>(null);
  const dragging                    = useRef<keyof Handles | null>(null);
  // Restore last handle positions from localStorage
  const [handles, setHandles]       = useState<Handles>(loadHandles);
  // Restore lookY from the passed-in calibration
  const [lookY, setLookY]           = useState(initialCalibration.lookY ?? 0);
  const [preview, setPreview]       = useState<CameraCalibration | null>(null);

  // ── Keyboard: Escape = close ───────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Pointer handling ───────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (key: keyof Handles) => (e: React.PointerEvent) => {
      e.stopPropagation();
      dragging.current = key;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx   = Math.max(0, Math.min(1, (e.clientX - rect.left)  / rect.width));
    const ny   = Math.max(0, Math.min(1, (e.clientY - rect.top)   / rect.height));
    setHandles(prev => ({ ...prev, [dragging.current!]: { x: nx, y: ny } }));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  // ── Live preview + real-time camera update ─────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const rect      = containerRef.current.getBoundingClientRect();
    const aspect    = rect.width / rect.height;
    const vp        = computeVP(handles);
    const widthFrac = Math.abs(handles.br.x - handles.bl.x);
    const cal       = { ...solveCamera(vp.y, widthFrac, aspect), lookY };
    setPreview(cal);
    onChange(cal); // push to camera immediately — no button needed
  }, [handles, lookY]);

  const handleApply = () => {
    if (!preview) return;
    saveHandles(handles);   // persist trapezoid for next session
    onApply(preview);       // save calibration + close
  };

  // ── Derived VP for SVG display ─────────────────────────────────────────────
  const vp = computeVP(handles);
  // Clamp VP to visible area just for drawing (real math uses unclamped)
  const vpDisplay: Pt = {
    x: Math.max(-0.1, Math.min(1.1, vp.x)),
    y: Math.max(-0.1, Math.min(1.1, vp.y)),
  };

  const HANDLE_CFG = [
    { key: 'tl' as const, label: 'TL', color: '#42C8BE' },
    { key: 'tr' as const, label: 'TR', color: '#42C8BE' },
    { key: 'bl' as const, label: 'BL', color: '#ffffff'  },
    { key: 'br' as const, label: 'BR', color: '#ffffff'  },
  ] as const;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[500]"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Overlay dim */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* SVG — viewBox 0 0 1 1, preserveAspectRatio none */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        overflow="visible"
      >
        {/* Road fill */}
        <polygon
          points={`
            ${handles.bl.x},${handles.bl.y}
            ${handles.br.x},${handles.br.y}
            ${handles.tr.x},${handles.tr.y}
            ${handles.tl.x},${handles.tl.y}
          `}
          fill="#42C8BE"
          opacity="0.15"
        />

        {/* Road outline */}
        <polygon
          points={`
            ${handles.bl.x},${handles.bl.y}
            ${handles.br.x},${handles.br.y}
            ${handles.tr.x},${handles.tr.y}
            ${handles.tl.x},${handles.tl.y}
          `}
          fill="none"
          stroke="#42C8BE"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />

        {/* Extended edge lines toward VP */}
        <line
          x1={handles.bl.x} y1={handles.bl.y}
          x2={vpDisplay.x}  y2={vpDisplay.y}
          stroke="#42C8BE" strokeWidth="1"
          strokeDasharray="6,4"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={handles.br.x} y1={handles.br.y}
          x2={vpDisplay.x}  y2={vpDisplay.y}
          stroke="#42C8BE" strokeWidth="1"
          strokeDasharray="6,4"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />

        {/* Horizon line (only if VP is within/near frame) */}
        {vp.y > -0.3 && vp.y < 1.2 && (
          <line
            x1={0} y1={vp.y}
            x2={1} y2={vp.y}
            stroke="#42C8BE" strokeWidth="1"
            strokeDasharray="3,5"
            opacity="0.35"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* VP dot (if within/near frame) */}
        {vp.y > -0.15 && vp.y < 1.1 && (
          <>
            <circle
              cx={vp.x} cy={vp.y} r="0.012"
              fill="#42C8BE" opacity="0.8"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={vp.x} cy={vp.y} r="0.022"
              fill="none" stroke="#42C8BE" strokeWidth="1"
              opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* 4 draggable handles */}
      {HANDLE_CFG.map(({ key, label, color }) => (
        <div
          key={key}
          onPointerDown={onPointerDown(key)}
          style={{
            position: 'absolute',
            left:  `calc(${handles[key].x * 100}% - ${HANDLE_R}px)`,
            top:   `calc(${handles[key].y * 100}% - ${HANDLE_R}px)`,
            width:  HANDLE_R * 2,
            height: HANDLE_R * 2,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            zIndex: 10,
          }}
          className="flex items-center justify-center"
        >
          <div
            style={{
              width:  HANDLE_R * 2 - 4,
              height: HANDLE_R * 2 - 4,
              borderRadius: '50%',
              border:          `2.5px solid ${color}`,
              backgroundColor: `${color}25`,
              boxShadow:       `0 0 10px ${color}90, inset 0 0 5px ${color}20`,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:         9,
              fontWeight:       900,
              color:            color,
              letterSpacing:    '0.05em',
            }}
          >
            {label}
          </div>
        </div>
      ))}

      {/* Instructions panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
        <div className="bg-black/85 border border-[#42C8BE]/40 rounded-2xl px-6 py-5 text-center backdrop-blur-md">
          <div className="text-[#42C8BE] font-black text-sm tracking-[0.18em] uppercase mb-3">
            Road Calibration
          </div>

          {/* Handle legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300 mb-4 text-left">
            <span><span className="text-[#42C8BE] font-bold">TL/TR</span> — far road corners</span>
            <span><span className="text-white font-bold">BL/BR</span> — near road corners</span>
          </div>

          {/* Vertical shift slider */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#42C8BE] text-xs font-bold tracking-wide">Vertical Shift</span>
              <span className="font-mono text-[10px] text-gray-300">{lookY > 0 ? '+' : ''}{lookY.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={-8}
              max={8}
              step={0.1}
              value={lookY}
              onChange={e => setLookY(parseFloat(e.target.value))}
              className="w-full accent-[#42C8BE] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
              <span>scene up ↑</span>
              <span>↓ scene down</span>
            </div>
          </div>

          {/* Live computed params */}
          {preview && (
            <div className="bg-white/5 rounded-lg px-3 py-2 mb-4 font-mono text-[10px] text-gray-300 grid grid-cols-2 gap-x-3 text-left">
              <span className="text-[#42C8BE]">camY</span>
              <span>{preview.camY.toFixed(2)}</span>
              <span className="text-[#42C8BE]">FOV</span>
              <span>{preview.fov.toFixed(1)}°</span>
              <span className="text-[#42C8BE]">horizon</span>
              <span>{(computeVP(handles).y * 100).toFixed(0)}% from top</span>
              <span className="text-[#42C8BE]">lookY</span>
              <span>{lookY.toFixed(1)}</span>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleApply}
              className="flex items-center gap-2 bg-[#42C8BE] text-black font-black px-5 py-2 rounded-full text-sm hover:scale-105 transition-all shadow-lg"
            >
              <Check className="w-4 h-4" /> Apply
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-white/10 text-white font-bold px-5 py-2 rounded-full text-sm hover:bg-white/20 transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      </div>

      {/* F badge */}
      <div className="absolute top-4 right-36 bg-[#42C8BE] text-black font-black text-xs px-3 py-1.5 rounded-full shadow-lg tracking-widest">
        F MODE
      </div>
    </div>
  );
};
