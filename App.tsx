
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './components/World/Environment';
import { Player } from './components/World/Player';
import { LevelManager } from './components/World/LevelManager';
import { Effects } from './components/World/Effects';
import { HUD } from './components/UI/HUD';
import { CalibrationOverlay, CameraCalibration } from './components/UI/CalibrationOverlay';
import { useStore } from './store';
import { GameStatus } from './types';
import { GestureController } from './components/System/GestureController';

// Augment JSX namespace to include Three.js elements for R3F
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      boxGeometry: any;
      circleGeometry: any;
      directionalLight: any;
      fog: any;
      group: any;
      instancedMesh: any;
      mesh: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      octahedronGeometry: any;
      planeGeometry: any;
      pointLight: any;
      shapeGeometry: any;
      sphereGeometry: any;
    }
  }
}

const CALIBRATION_KEY = 'pumba_cam_calibration';

const DEFAULT_CALIBRATION: CameraCalibration = {
  camY:  3.02,
  camZ:  8,
  fov:   110.0,
  lookZ: -30,
  lookY: 7.1,
};

function loadCalibration(): CameraCalibration {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CALIBRATION;
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

function saveCalibration(cal: CameraCalibration) {
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(cal));
}

// ─── Camera Controller ────────────────────────────────────────────────────────

interface CameraControllerProps {
  calibration: CameraCalibration;
}

// Reusable vectors — allocated once, never recreated inside useFrame
const _camTarget = new THREE.Vector3();
const _lookAt    = new THREE.Vector3();

const CameraController: React.FC<CameraControllerProps> = ({ calibration }) => {
  const { camera, size } = useThree();
  const { laneCount } = useStore();

  useFrame((_, delta) => {
    const aspect     = size.width / size.height;
    const isMobile   = aspect < 1.2;

    const heightFactor = isMobile ? 2.0 : 0.5;
    const distFactor   = isMobile ? 4.5 : 1.0;
    const extraLanes   = Math.max(0, laneCount - 3);

    const targetY     = calibration.camY  + extraLanes * heightFactor;
    const targetZ     = calibration.camZ  + extraLanes * distFactor;
    const targetFov   = calibration.fov;
    const targetLookZ = calibration.lookZ;
    const targetLookY = calibration.lookY ?? 0;

    _camTarget.set(0, targetY, targetZ);
    camera.position.lerp(_camTarget, delta * 2.0);

    _lookAt.set(0, targetLookY, targetLookZ);
    camera.lookAt(_lookAt);

    // Only update projection matrix when FOV actually changes
    const perspCam = camera as THREE.PerspectiveCamera;
    if (perspCam.fov !== undefined) {
      const newFov = perspCam.fov + (targetFov - perspCam.fov) * Math.min(1, delta * 3);
      if (Math.abs(newFov - perspCam.fov) > 0.01) {
        perspCam.fov = newFov;
        perspCam.updateProjectionMatrix();
      }
    }
  });

  return null;
};

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      <Environment />
      <group>
        <group userData={{ isPlayer: true }} name="PlayerGroup">
          <Player />
        </group>
        <LevelManager />
      </group>
      <Effects />
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

// Two-video instant-cut sequence: bg-video.mp4 → bg-video-2.mp4 → bg-video.mp4 → …
const BG_VIDEOS = ['/bg-video.mp4', '/bg-video-2.mp4'] as const;
const PRELOAD_SEC = 3;

// ─── Fullscreen helper ────────────────────────────────────────────────────────
export function requestFullscreen() {
  const el = document.documentElement as any;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req) req.call(el).catch(() => {});
}

export function exitFullscreen() {
  const doc = document as any;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
  if (exit) exit.call(doc).catch(() => {});
}

export function isFullscreen(): boolean {
  const doc = document as any;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
}

function App() {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibration, setCalibration]     = useState<CameraCalibration>(loadCalibration);

  // ─── Loading gate — preload all game assets ─────────────────────────────────
  const [isReady, setIsReady]     = useState(false);
  const [fadeOut, setFadeOut]     = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const readyFired = useRef(false);

  const markReady = useCallback(() => {
    if (readyFired.current) return;
    readyFired.current = true;
    setLoadProgress(100);
    setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setIsReady(true), 600);
    }, 200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const IMAGES = [
      '/logo_2.svg', '/logo_1.svg', '/logo.png', '/game-logo.png',
      '/pumba_icon.png', '/pumba-logo.png', '/pumba-brand.jpg',
      '/pumba-sensor.jpg', '/favicon.jpg', '/bonus.jpg',
      '/car-overlay.jpg', '/street-bg.jpeg', '/street-bg.png',
      '/bg-image.png', '/instructions-bg.jpeg', '/share-bg.jpg', '/sensor.jpg',
    ];
    const VIDEOS = ['/bg-video.mp4', '/bg-video-2.mp4', '/intro-1.mp4', '/intro-2.mp4'];
    const AUDIO  = ['/bg-music.mp3', '/traffic-ambience.mp3', '/game-over.mp3'];

    const total = IMAGES.length + VIDEOS.length + AUDIO.length;
    let loaded = 0;
    const tick = () => {
      loaded++;
      if (!cancelled) setLoadProgress(Math.round((loaded / total) * 100));
      if (loaded >= total && !cancelled) markReady();
    };

    // Preload images
    IMAGES.forEach(src => {
      const img = new Image();
      img.onload = img.onerror = tick;
      img.src = src;
    });

    // Preload videos (wait for enough data to play through)
    VIDEOS.forEach(src => {
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.muted = true;
      vid.playsInline = true;
      vid.oncanplaythrough = () => { vid.oncanplaythrough = null; tick(); };
      vid.onerror = tick;
      vid.src = src;
      vid.load();
    });

    // Preload audio
    AUDIO.forEach(src => {
      const a = new Audio();
      a.preload = 'auto';
      a.oncanplaythrough = () => { a.oncanplaythrough = null; tick(); };
      a.onerror = tick;
      a.src = src;
    });

    // Fallback: don't block forever (max 12s)
    const fallback = setTimeout(markReady, 12000);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [markReady]);

  // activeSlot drives which video is shown; the other buffers silently
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0); // 0 = videoA, 1 = videoB
  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRefs = [videoRef0, videoRef1] as const;
  const nextSrc   = useRef<string>(BG_VIDEOS[1]);
  const preloaded = useRef(false);

  // When 3 seconds remain in the active video, load the next clip into the inactive slot
  const handleTimeUpdate = useCallback((slotIdx: 0 | 1) => {
    if (slotIdx !== activeSlot) return; // only the active slot drives timing
    const vid = videoRefs[slotIdx].current;
    if (!vid || !vid.duration) return;
    const remaining = vid.duration - vid.currentTime;

    if (remaining <= PRELOAD_SEC && !preloaded.current) {
      preloaded.current = true;
      const inactiveSlot = slotIdx === 0 ? 1 : 0;
      const inactiveVid  = videoRefs[inactiveSlot].current;
      if (inactiveVid) {
        inactiveVid.src = nextSrc.current;
        inactiveVid.load();
      }
    }
  }, [activeSlot]);

  // When the active video ends, instantly cut to the pre-buffered one
  const handleEnded = useCallback((slotIdx: 0 | 1) => {
    if (slotIdx !== activeSlot) return;
    const inactiveSlot = slotIdx === 0 ? 1 : 0;
    const inactiveVid  = videoRefs[inactiveSlot].current;
    if (inactiveVid) {
      inactiveVid.currentTime = 0;
      inactiveVid.play().catch(() => {});
    }
    // Advance nextSrc for the cycle after this one
    const nextNextIdx = BG_VIDEOS.indexOf(nextSrc.current as typeof BG_VIDEOS[number]);
    nextSrc.current = BG_VIDEOS[(nextNextIdx + 1) % BG_VIDEOS.length];
    preloaded.current = false;
    setActiveSlot(inactiveSlot);
  }, [activeSlot]);

  // "D" key shortcut for road vanishing-point calibration — only during gameplay
  const gameStatus = useStore(s => s.status);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        // Block when user might be typing (registration / intro screens)
        if (gameStatus === GameStatus.REGISTER || gameStatus === GameStatus.INTRO) return;
        setIsCalibrating(v => {
          if (!v) calBeforeEdit.current = calibration; // snapshot on open
          return !v;
        });
      }
    };
    const hF = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (gameStatus === GameStatus.REGISTER || gameStatus === GameStatus.INTRO) return;
        window.location.href = '/calibrate';
      }
    };
    window.addEventListener('keydown', h);
    window.addEventListener('keydown', hF);
    return () => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('keydown', hF);
    };
  }, [calibration, gameStatus]);

  // Snapshot calibration at the moment F-mode opens, so Cancel can revert
  const calBeforeEdit = useRef<CameraCalibration>(calibration);
  const openCalibration = useCallback(() => {
    calBeforeEdit.current = calibration;
    setIsCalibrating(true);
  }, [calibration]);

  // Live update — no save yet
  const handleChange = useCallback((cal: CameraCalibration) => {
    setCalibration(cal);
  }, []);

  // Save + close
  const handleApply = useCallback((cal: CameraCalibration) => {
    setCalibration(cal);
    saveCalibration(cal);
    setIsCalibrating(false);
  }, []);

  // Revert to pre-edit calibration and close
  const handleClose = useCallback(() => {
    setCalibration(calBeforeEdit.current);
    setIsCalibrating(false);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-black">

      {/* City background — slot 0 starts active; slot 1 pre-buffers next clip */}
      {([0, 1] as const).map(slotIdx => (
        <video
          key={slotIdx}
          ref={videoRefs[slotIdx]}
          src={slotIdx === 0 ? BG_VIDEOS[0] : undefined}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: slotIdx === activeSlot ? 1 : 0 }}
          autoPlay={slotIdx === 0}
          muted
          playsInline
          onTimeUpdate={() => handleTimeUpdate(slotIdx)}
          onEnded={() => handleEnded(slotIdx)}
        />
      ))}

      {/* Loading overlay */}
      {!isReady && (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-500"
          style={{ opacity: fadeOut ? 0 : 1 }}
        >
          <img
            src="/logo_2.svg"
            alt="Pumba"
            className="w-52 md:w-64"
            style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
          />
          <div className="mt-10 w-48 h-[3px] rounded bg-white/10 overflow-hidden">
            <div
              className="h-full rounded transition-all duration-300 ease-out"
              style={{ background: '#00bfff', width: `${loadProgress}%` }}
            />
          </div>
          <span className="mt-3 text-xs text-white/40 font-mono">{loadProgress}%</span>
        </div>
      )}

      {/* Subtle dark gradient at the very bottom so the 3D road blends in */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent z-[1] pointer-events-none" />

      {/* Three.js canvas — transparent background, sits above video */}
      <Canvas
        className="absolute inset-0 z-[2]"
        dpr={[1, 1]}
        gl={{ alpha: true, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 5.5, 8], fov: 60 }}
      >
        <CameraController calibration={calibration} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* UI sits on top of everything */}
      <GestureController />
      <HUD />

      {/* Calibration overlay — shown only when isCalibrating */}
      {isCalibrating && (
        <CalibrationOverlay
          initialCalibration={calibration}
          onApply={handleApply}
          onChange={handleChange}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

export default App;
