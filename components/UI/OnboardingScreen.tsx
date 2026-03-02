
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight } from 'lucide-react';

// ─── Mini 3D Previews — exact geometry from LevelManager ─────────────────────

/** Slowly rotates children around Y axis */
const AutoRotate: React.FC<{ children: React.ReactNode; speed?: number }> = ({ children, speed = 0.7 }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * speed; });
  return <group ref={ref}>{children}</group>;
};

/** Exact copy of game's parking spot (COIN) */
const ParkingSpotModel: React.FC = () => {
  const pumbaIconTexture = useLoader(THREE.TextureLoader, '/pumba_icon.png');
  const iconRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (iconRef.current) {
      iconRef.current.rotation.y += delta * 2.5;
      iconRef.current.position.y = 1.8 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }
  });
  return (
    <group position={[0, 0.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 3.5]} />
        <meshBasicMaterial color="#42C8BE" transparent opacity={0.25} />
      </mesh>
      <group ref={iconRef} position={[0, 1.8, 0]}>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[1.6, 1.6]} />
          <meshBasicMaterial map={pumbaIconTexture} transparent alphaTest={0.1} side={THREE.FrontSide} />
        </mesh>
        <mesh position={[0, 0, -0.05]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.6, 1.6]} />
          <meshBasicMaterial map={pumbaIconTexture} transparent alphaTest={0.1} side={THREE.FrontSide} />
        </mesh>
      </group>
    </group>
  );
};

/** Exact copy of game's double-parked car obstacle */
const DoubleParkedModel: React.FC = () => {
  const lightsRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (lightsRef.current) lightsRef.current.visible = Math.floor(state.clock.elapsedTime * 4) % 2 === 0;
  });
  return (
    <AutoRotate>
      {/* Body */}
      <mesh position={[0, 0.22, 0]} scale={[1.6, 0.55, 3.0]}>
        <boxGeometry />
        <meshStandardMaterial color="#b0b8c1" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.68, -0.15]} scale={[1.35, 0.48, 1.6]}>
        <boxGeometry />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.05} />
      </mesh>
      {/* Front bumper */}
      <mesh position={[0, 0.12, -1.52]} scale={[1.5, 0.2, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#999999" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Rear bumper */}
      <mesh position={[0, 0.12, 1.52]} scale={[1.5, 0.2, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#999999" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Wheels */}
      {([[0.82, 1.1], [-0.82, 1.1], [0.82, -1.1], [-0.82, -1.1]] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
      ))}
      {/* Hazard lights */}
      <group ref={lightsRef}>
        {([[0.72, 1.52], [-0.72, 1.52], [0.72, -1.52], [-0.72, -1.52]] as [number,number][]).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.28, z]} scale={[0.22, 0.12, 0.06]}>
            <boxGeometry />
            <meshBasicMaterial color="#ffaa00" />
          </mesh>
        ))}
      </group>
    </AutoRotate>
  );
};

/** Exact copy of game's no-entry sign obstacle */
const NoEntryModel: React.FC = () => (
  <AutoRotate>
    {/* Concrete base */}
    <mesh position={[0, 0.08, 0]}>
      <boxGeometry args={[0.3, 0.16, 0.3]} />
      <meshBasicMaterial color="#6e6e6e" />
    </mesh>
    {/* Steel pole */}
    <mesh position={[0, 1.15, 0]}>
      <cylinderGeometry args={[0.045, 0.055, 2.1, 10]} />
      <meshBasicMaterial color="#8a8a8a" />
    </mesh>
    {/* Pole cap */}
    <mesh position={[0, 2.22, 0]}>
      <cylinderGeometry args={[0.065, 0.045, 0.07, 10]} />
      <meshBasicMaterial color="#707070" />
    </mesh>
    {/* Sign group */}
    <group position={[0, 1.75, 0.32]}>
      {/* Back face dark disc */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.06]}>
        <cylinderGeometry args={[0.53, 0.53, 0.04, 28]} />
        <meshBasicMaterial color="#444444" />
      </mesh>
      {/* White border ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>
        <cylinderGeometry args={[0.53, 0.53, 0.04, 28]} />
        <meshBasicMaterial color="#dddddd" />
      </mesh>
      {/* Red face disc */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
        <cylinderGeometry args={[0.46, 0.46, 0.05, 28]} />
        <meshBasicMaterial color="#b50000" />
      </mesh>
      {/* White no-entry bar */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.70, 0.19, 0.04]} />
        <meshBasicMaterial color="#dddddd" />
      </mesh>
      {/* Bracket */}
      <mesh position={[0, 0, -0.09]}>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 6]} />
        <meshBasicMaterial color="#777777" />
      </mesh>
    </group>
  </AutoRotate>
);

/** Exact copy of game's garbage truck obstacle */
const GarbageTruckModel: React.FC = () => (
  <AutoRotate>
    <group position={[0, 0.4, 0]}>
      {/* Cabin */}
      <mesh position={[0, 0.45, 1.6]} scale={[1.9, 1.4, 1.3]}>
        <boxGeometry />
        <meshStandardMaterial color="#c0c0c0" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Windshield strip */}
      <mesh position={[0, 0.72, 2.27]} scale={[1.6, 0.5, 0.05]}>
        <boxGeometry />
        <meshStandardMaterial color="#1a2a3a" metalness={0.8} roughness={0.1} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.55, -0.5]} scale={[2.1, 1.7, 3.2]}>
        <boxGeometry />
        <meshStandardMaterial color="#2d7a3a" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Compactor ridge */}
      <mesh position={[0, 1.42, -0.5]} scale={[1.8, 0.18, 2.8]}>
        <boxGeometry />
        <meshStandardMaterial color="#1f5a28" roughness={0.6} />
      </mesh>
      {/* Rear loading panel */}
      <mesh position={[0, 0.55, 1.11]} scale={[2.1, 1.7, 0.1]}>
        <boxGeometry />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </mesh>
      {/* Warning stripe */}
      <mesh position={[0, 0.1, -0.5]} scale={[2.12, 0.18, 3.22]}>
        <boxGeometry />
        <meshBasicMaterial color="#f5c518" />
      </mesh>
      {/* Wheels */}
      {([[1.1, 1.4], [-1.1, 1.4], [1.1, -1.2], [-1.1, -1.2]] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, -0.35, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 0.22, 10]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      ))}
      {/* Orange warning light */}
      <mesh position={[0, 1.2, 1.6]}>
        <boxGeometry args={[0.3, 0.18, 0.3]} />
        <meshBasicMaterial color="#ff8800" />
      </mesh>
    </group>
  </AutoRotate>
);

/** Exact copy of game's white bonus pickup (×2 score) */
const WhiteBonusModel: React.FC = () => {
  const sensorTexture = useLoader(THREE.TextureLoader, '/sensor.jpg');
  const iconRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (iconRef.current) {
      iconRef.current.rotation.y += delta * 3.0;
      iconRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.2;
    }
  });
  return (
    <>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.9, 1.15, 24]} />
        <meshBasicMaterial color="#42C8BE" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color="#42C8BE" transparent opacity={0.18} />
      </mesh>
      {/* Spinning sensor icon */}
      <group ref={iconRef}>
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[1.4, 1.4]} />
          <meshBasicMaterial map={sensorTexture} transparent alphaTest={0.05} side={THREE.FrontSide} />
        </mesh>
        <mesh position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.4, 1.4]} />
          <meshBasicMaterial map={sensorTexture} transparent alphaTest={0.05} side={THREE.FrontSide} />
        </mesh>
      </group>
    </>
  );
};

/** Exact copy of game's gold bonus pickup (×4 score) */
const GoldBonusModel: React.FC = () => {
  const sensorTexture = useLoader(THREE.TextureLoader, '/sensor.jpg');
  const iconRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (iconRef.current) {
      iconRef.current.rotation.y += delta * 3.0;
      iconRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.2;
    }
  });
  return (
    <>
      {/* Gold ground rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.9, 1.25, 24]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.3, 1.45, 24]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Gold backing disc */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[0.82, 20]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* Gold-tinted spinning sensor icon */}
      <group ref={iconRef}>
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[1.4, 1.4]} />
          <meshBasicMaterial map={sensorTexture} transparent alphaTest={0.05} side={THREE.FrontSide} color="#ffd700" />
        </mesh>
        <mesh position={[0, 0, -0.08]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.4, 1.4]} />
          <meshBasicMaterial map={sensorTexture} transparent alphaTest={0.05} side={THREE.FrontSide} color="#ffd700" />
        </mesh>
      </group>
    </>
  );
};

/** Canvas wrapper with proper lighting for game-faithful materials */
const MiniScene: React.FC<{
  children: React.ReactNode;
  camPos?: [number, number, number];
  fov?: number;
}> = ({ children, camPos = [0, 1.5, 4], fov = 50 }) => (
  <Canvas
    className="w-full h-full"
    dpr={[1, 1.5]}
    gl={{ alpha: true, antialias: true }}
    camera={{ position: camPos, fov }}
  >
    <ambientLight intensity={2.2} />
    <directionalLight position={[3, 5, 3]} intensity={1.8} castShadow={false} />
    <directionalLight position={[-2, 3, -2]} intensity={0.6} />
    {children}
  </Canvas>
);

// ─── Step Card layout ────────────────────────────────────────────────────────

interface CardProps {
  emoji?: string;
  title: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
  children?: React.ReactNode; // 3D preview slot
}

const InfoCard: React.FC<CardProps> = ({ emoji, title, desc, badge, badgeColor = '#42C8BE', children }) => (
  <div className="bg-white/90 rounded-2xl p-4 flex items-center gap-4 shadow-md border border-white/60">
    {children && (
      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-black/10">
        {children}
      </div>
    )}
    {!children && emoji && (
      <div className="w-14 h-14 shrink-0 rounded-xl bg-black/10 flex items-center justify-center text-3xl">
        {emoji}
      </div>
    )}
    <div className="flex-1 text-left">
      {badge && (
        <span className="inline-block text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full mb-1"
          style={{ background: badgeColor, color: badgeColor === '#ffd700' ? '#000' : '#fff' }}>
          {badge}
        </span>
      )}
      <div className="font-black text-gray-800 text-base leading-tight">{title}</div>
      <div className="text-gray-500 text-sm mt-0.5 leading-snug">{desc}</div>
    </div>
  </div>
);

// ─── Individual Steps ─────────────────────────────────────────────────────────

/** Step 1 — Camera check
 * GestureController repositions itself (center, 16:9) when this step is active.
 * Advancement: hand in RIGHT zone + fist → GestureController fires 'onboarding-advance'.
 */
const StepCamera: React.FC = () => {
  const [swipeDone, setSwipeDone] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    // Only visual feedback here — actual step advance is handled by OnboardingScreen
    const onSwipe   = () => setSwipeDone(true);
    const onAdvance = () => setAdvancing(true);
    window.addEventListener('gesture-right',      onSwipe);
    window.addEventListener('onboarding-advance', onAdvance);
    return () => {
      window.removeEventListener('gesture-right',      onSwipe);
      window.removeEventListener('onboarding-advance', onAdvance);
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Spacer: mirrors camera size exactly.
          marginTop bridges the gap between where content starts (~152px) and camera top (10.5rem=168px) */}
      <div
        className="pointer-events-none flex-shrink-0"
        style={{
          width:     'min(99vw, 72rem)',
          height:    'calc(min(99vw, 72rem) * 9 / 16)',
          marginTop: '1rem',
        }}
      />

      {/* Gesture checklist — compact pills, pushed down so camera never overlaps */}
      <div className="w-full flex gap-2 mt-8">
        <div className={`flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1 border transition-all duration-300
            ${swipeDone ? 'bg-[#42C8BE]/20 border-[#42C8BE]' : 'bg-white/10 border-white/20'}`}>
          <span className="text-sm">{swipeDone ? '✅' : '➡️'}</span>
          <span className={`font-black text-[10px] ${swipeDone ? 'text-[#42C8BE]' : 'text-white/80'}`}>Move Right</span>
        </div>
        <div className={`flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1 border transition-all duration-300
            ${advancing ? 'bg-[#42C8BE]/20 border-[#42C8BE]' : swipeDone ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 opacity-40'}`}>
          <span className="text-sm">{advancing ? '✅' : '🖐️'}</span>
          <span className={`font-black text-[10px] ${advancing ? 'text-[#42C8BE]' : 'text-white/80'}`}>Open Hand → Photo</span>
        </div>
      </div>

      {advancing && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center text-[#42C8BE] font-black text-lg py-2"
        >
          ✅ Moving to next step…
        </motion.div>
      )}
    </div>
  );
};

/** Step 2 — Goal */
const StepGoal: React.FC = () => (
  <div className="flex flex-col gap-3 w-full">
    <div className="text-center mb-1">
      <h2 className="text-white font-black text-2xl md:text-3xl drop-shadow-lg">🅿️ The Goal</h2>
      <p className="text-white/60 text-sm mt-1">Park as many cars as you can — collect, dodge, survive</p>
    </div>
    <InfoCard title="Collect Parking Spots" desc="Grab every blue parking space — more = higher score." badge="GOAL">
      <MiniScene camPos={[0, 2.5, 6]} fov={55}>
        <ParkingSpotModel />
      </MiniScene>
    </InfoCard>

    <InfoCard emoji="❤️" title="5 Lives" desc="Each crash costs a life. Lose all → Game Over." badge="LIVES" badgeColor="#e53e3e" />

    <InfoCard emoji="✊" title="Hand Controls" desc="Move hand L/R to change lanes. Close fist to JUMP." badge="CONTROLS" badgeColor="#2C37B2" />
  </div>
);

/** Step 3 — Obstacles */
const StepObstacles: React.FC = () => (
  <div className="flex flex-col gap-3 w-full">
    <div className="text-center mb-1">
      <h2 className="text-white font-black text-2xl md:text-3xl drop-shadow-lg">🚧 Watch Out!</h2>
      <p className="text-white/60 text-sm mt-1">These block the road — dodge sideways or jump over them</p>
    </div>
    <InfoCard title="Double-Parked Car" desc="Switch lanes or jump over it.">
      <MiniScene camPos={[0, 1.0, 5.8]} fov={55}>
        <DoubleParkedModel />
      </MiniScene>
    </InfoCard>
    <InfoCard title="Garbage Truck" desc="Wide and slow — dodge early.">
      <MiniScene camPos={[1.8, 2.0, 6.5]} fov={50}>
        <GarbageTruckModel />
      </MiniScene>
    </InfoCard>
    <InfoCard title="No Entry Sign" desc="Pole only — dodge left or right.">
      <MiniScene camPos={[0, 1.1, 5.5]} fov={55}>
        <NoEntryModel />
      </MiniScene>
    </InfoCard>
  </div>
);

/** Step 4 — Bonuses */
const StepBonuses: React.FC = () => (
  <div className="flex flex-col gap-3 w-full">
    <div className="text-center mb-1">
      <h2 className="text-white font-black text-2xl md:text-3xl drop-shadow-lg">⭐ Grab These!</h2>
      <p className="text-white/60 text-sm mt-1">Collect sensor bonuses for massive score boosts</p>
    </div>
    <InfoCard title="×2 Score" desc="White sensor — doubles points for 5s." badge="WHITE" badgeColor="#42C8BE">
      <img src="/pumba-sensor.jpg" alt="Sensor" className="w-full h-full object-cover" />
    </InfoCard>
    <InfoCard title="×4 Score" desc="Gold sensor — rare! Quadruples points for 10s." badge="GOLD" badgeColor="#ffd700">
      <img src="/pumba-sensor.jpg" alt="Sensor" className="w-full h-full object-cover" style={{ filter: 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)' }} />
    </InfoCard>

    {/* Ready-to-play instruction — large & unmissable */}
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 220 }}
      className="mt-3 rounded-3xl border-2 border-[#42C8BE] bg-gradient-to-br from-[#42C8BE]/25 to-[#2C37B2]/25 px-5 py-6 text-center shadow-[0_0_30px_rgba(66,200,190,0.35)]"
    >
      <div className="text-5xl mb-3">✊</div>
      <p className="text-white font-black text-2xl md:text-3xl leading-snug">
        Place your hand in the<br />
        <span className="text-[#42C8BE]">CENTER zone</span>
      </p>
      <p className="text-white/80 font-bold text-base md:text-lg mt-2">
        and close your fist <span className="text-[#42C8BE]">twice</span> to start
      </p>
    </motion.div>
  </div>
);

// ─── Main Onboarding Component ────────────────────────────────────────────────

const STEPS = [
  { id: 'camera',    label: 'Camera' },
  { id: 'goal',      label: 'Goal' },
  { id: 'obstacles', label: 'Obstacles' },
  { id: 'bonuses',   label: 'Bonuses' },
];

interface OnboardingScreenProps {
  onStart: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onStart }) => {
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;

  // Notify GestureController of step changes so it can reposition
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('onboarding-step', { detail: { step } }));
  }, [step]);

  // Cleanup: when unmounting, send step=-1 to reset camera to corner
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('onboarding-step', { detail: { step: -1 } }));
    };
  }, []);

  const goNext = useCallback(() => {
    if (isLast) { onStart(); } else { setStep(s => s + 1); }
  }, [isLast, onStart]);

  // Right zone + fist → advance; left zone + fist → go back
  useEffect(() => {
    const onNext = () => goNext();
    const onBack = () => setStep(s => Math.max(0, s - 1));
    window.addEventListener('onboarding-advance', onNext);
    window.addEventListener('onboarding-back',    onBack);
    return () => {
      window.removeEventListener('onboarding-advance', onNext);
      window.removeEventListener('onboarding-back',    onBack);
    };
  }, [goNext]);

  const goPrev = () => setStep(s => Math.max(0, s - 1));

  return (
    <div className="absolute inset-0 z-[200] flex flex-col items-center p-4 overflow-hidden pointer-events-auto select-none">
      {/* Blurred background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/instructions-bg.jpeg')", filter: 'blur(6px)', transform: 'scale(1.08)' }} />
      <div className="absolute inset-0 bg-black/60" />

      {/* Top row: Logo + Skip button */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-between mt-2 mb-3">
        <img src="/logo_2.svg" alt="Pumba" className="w-24 md:w-32 drop-shadow-lg" />
        <button
          onClick={onStart}
          className="text-white/60 text-sm font-bold hover:text-white/90 transition-colors
                     bg-white/10 border border-white/20 rounded-xl px-4 py-2 hover:bg-white/20"
        >
          Skip Tutorial →
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 w-full max-w-md mb-3">
        <div className="flex gap-1 mb-1.5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/20">
              <motion.div
                className="h-full rounded-full"
                style={{ background: '#42C8BE' }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.4 }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <span key={s.id} className={`text-[10px] font-bold transition-colors ${i === step ? 'text-[#42C8BE]' : i < step ? 'text-white/50' : 'text-white/25'}`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Instruction text for step 0 — sits between progress bar and camera (above camera z-250) */}
      {step === 0 && (
        <motion.p
          key="cam-hint"
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="relative z-[260] w-full max-w-md text-white font-black text-lg md:text-xl text-center drop-shadow-lg mb-2"
        >
          📷  Bring your hand close to the camera
        </motion.p>
      )}

      {/* Step content — scrollable */}
      <div className="relative z-10 w-full max-w-md flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && <StepCamera />}
            {step === 1 && <StepGoal />}
            {step === 2 && <StepObstacles />}
            {step === 3 && <StepBonuses />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons — fixed at bottom */}
      <div className="absolute bottom-4 left-0 right-0 px-4 z-10 flex gap-3 max-w-md mx-auto">
        {step > 0 && (
          <button
            onClick={goPrev}
            className="flex-none px-5 py-3 rounded-2xl font-black text-white/70 text-sm
                       bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            ← Back
          </button>
        )}
        {/* On step 0: Next button is always visible (gesture will auto-advance, or they can click) */}
        <button
          onClick={goNext}
          className="flex-1 py-3 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-2
                     bg-gradient-to-r from-[#42C8BE] to-[#2C37B2] shadow-lg cursor-pointer
                     hover:opacity-90 transition-opacity"
        >
          {isLast ? '🚗  Start Parking Hunt!' : (
            <>Next <ChevronRight className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
};
