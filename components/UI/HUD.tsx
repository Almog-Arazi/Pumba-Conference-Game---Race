
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Zap, Rocket, Hand, MoveHorizontal, Grab, Trophy, Trash2, ChevronLeft, ChevronRight, ChevronsUp, Pause, Play, Volume2, VolumeX, SkipForward, Maximize, Minimize } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, RUN_SPEED_BASE, LeaderboardEntry } from '../../types';
import { audio } from '../System/Audio';
import { motion, AnimatePresence } from 'motion/react';
import { OnboardingScreen } from './OnboardingScreen';
import { RegisterScreen } from './RegisterScreen';
import { HallOfFame } from './HallOfFame';
import { ShareCard } from './ShareCard';

// --- Leaderboard Component ---
const LeaderboardTable: React.FC<{ entries: LeaderboardEntry[], compact?: boolean, onReset?: () => void }> = ({ entries, compact, onReset }) => {
    return (
        <div className={`w-full bg-black/80 border border-[#42C8BE]/50 rounded-lg overflow-hidden backdrop-blur-md ${compact ? 'text-[10px] md:text-xs' : 'text-sm'}`}>
            <div className="flex justify-between items-center bg-[#2C37B2]/40 p-1.5 md:p-2 border-b border-[#42C8BE]/30">
                <div className="flex items-center gap-2">
                    <Trophy className="w-3 h-3 md:w-4 md:h-4 text-yellow-400" />
                    <span className="font-bold font-cyber text-white tracking-widest uppercase">HALL OF FAME</span>
                </div>
                {onReset && (
                    <button 
                        onClick={onReset}
                        className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400"
                        title="Reset Leaderboard"
                    >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                )}
            </div>
            
            <div className="overflow-y-auto max-h-[150px] md:max-h-[250px] scrollbar-thin scrollbar-thumb-[#42C8BE] scrollbar-track-transparent">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 font-bold sticky top-0">
                        <tr>
                            <th className="p-1 md:p-2">#</th>
                            <th className="p-1 md:p-2">Name</th>
                            <th className="p-1 md:p-2 text-center">Parked</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                             <tr>
                                <td colSpan={3} className="p-4 text-center text-gray-500 italic">
                                    No records yet...
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry, index) => {
                                const name = "PUMBA PRO";
                                const color = "#42C8BE";
                                
                                return (
                                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-gray-200 font-mono">
                                        <td className="p-1 md:p-2 font-bold text-[#42C8BE]">{index + 1}</td>
                                        <td className="p-1 md:p-2 truncate max-w-[80px]" style={{ color: color }}>{name}</td>
                                        <td className="p-1 md:p-2 text-center font-bold text-yellow-400">
                                            {entry.coins} 
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Circular countdown ring ──────────────────────────────────────────────────
const CountdownRing: React.FC<{ remaining: number; total: number; size: number; color?: string }> = ({ remaining, total, size, color = '#42C8BE' }) => {
    const r    = (size - 4) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * (remaining / total);
    const trackColor = color === '#ffd700' ? 'rgba(255,215,0,0.2)' : 'rgba(66,200,190,0.2)';
    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90">
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={3} />
            <circle
                cx={size/2} cy={size/2} r={r}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.2s linear' }}
            />
        </svg>
    );
};

// ─── Unified Dynamic Island ───────────────────────────────────────────────────
// States: idle | parking | bonus | parking+bonus
const DynamicIsland: React.FC = () => {
    const {
        upcomingParkingLane,
        isDoubleScoreActive, doubleScoreEndTime,
        isQuadScoreActive,   quadScoreEndTime,
    } = useStore();

    const [doubleRemaining, setDoubleRemaining] = useState(0);
    const [quadRemaining,   setQuadRemaining]   = useState(0);

    const hasParking   = upcomingParkingLane !== null;
    const hasBonus     = isDoubleScoreActive;
    const hasGoldBonus = isQuadScoreActive;
    const hasAnyBonus  = hasBonus || hasGoldBonus;

    // Countdown — white bonus (x2)
    useEffect(() => {
        if (!hasBonus) { setDoubleRemaining(0); return; }
        const tick = setInterval(() => {
            setDoubleRemaining(Math.max(0, Math.ceil((doubleScoreEndTime - Date.now()) / 1000)));
        }, 100);
        return () => clearInterval(tick);
    }, [hasBonus, doubleScoreEndTime]);

    // Countdown — gold bonus (x4)
    useEffect(() => {
        if (!hasGoldBonus) { setQuadRemaining(0); return; }
        const tick = setInterval(() => {
            setQuadRemaining(Math.max(0, Math.ceil((quadScoreEndTime - Date.now()) / 1000)));
        }, 100);
        return () => clearInterval(tick);
    }, [hasGoldBonus, quadScoreEndTime]);

    const dirLabel = upcomingParkingLane === null ? ''
        : upcomingParkingLane < 0 ? 'LEFT'
        : upcomingParkingLane > 0 ? 'RIGHT'
        : 'CENTER';

    const DirIcon = upcomingParkingLane === null ? null
        : upcomingParkingLane < 0 ? ChevronLeft
        : upcomingParkingLane > 0 ? ChevronRight
        : ChevronsUp;

    const isExpanded = hasParking || hasAnyBonus;
    const isBig      = hasParking && hasAnyBonus;

    const targetW = isBig ? 520 : isExpanded ? 380 : 72;
    const targetH = isBig ? 100 : isExpanded ? 90  : 72;
    const targetR = isExpanded ? 28 : 999;

    const bgColor = hasGoldBonus ? '#2a1e00' : hasBonus ? '#042e2a' : '#000';
    const shadow  = hasGoldBonus
        ? '0 0 0 1.5px #ffd700, 0 0 30px rgba(255,215,0,0.5)'
        : hasBonus
            ? '0 0 0 1.5px #42C8BE, 0 0 30px rgba(66,200,190,0.5)'
            : isExpanded
                ? '0 0 0 1.5px rgba(66,200,190,0.6), 0 0 20px rgba(66,200,190,0.25)'
                : '0 0 0 1px rgba(66,200,190,0.3)';

    // Which bonus to show when only bonus (no parking)
    const bonusSectionKey = hasGoldBonus ? 'gold' : 'white';

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
            <motion.div
                className="flex items-center justify-center overflow-hidden"
                animate={{ width: targetW, height: targetH, borderRadius: targetR, backgroundColor: bgColor }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                style={{ boxShadow: shadow }}
            >
                <AnimatePresence mode="wait">

                    {/* ── IDLE ─────────────────────────────────────────────── */}
                    {!isExpanded && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center justify-center w-full h-full"
                        >
                            <img
                                src="/pumba-brand.jpg"
                                alt="Pumba"
                                className="w-16 h-16 object-contain rounded-full"
                            />
                        </motion.div>
                    )}

                    {/* ── PARKING ONLY ─────────────────────────────────────── */}
                    {isExpanded && !isBig && hasParking && !hasAnyBonus && (
                        <motion.div
                            key="parking"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ delay: 0.07, duration: 0.2 }}
                            className="flex items-center gap-4 px-6 w-full"
                        >
                            <img src="/favicon.jpg" alt="Pumba"
                                className="w-12 h-12 rounded-full object-cover border-2 border-[#42C8BE]/60 shrink-0"
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="text-[#42C8BE] text-[10px] font-black tracking-[0.22em] uppercase">Parking Available</span>
                                <div className="flex items-center gap-0.5 mt-0.5">
                                    {DirIcon && <DirIcon className="w-6 h-6 text-white stroke-[3.5]" />}
                                    <span className="text-white font-black text-xl tracking-wide leading-none">{dirLabel}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── BONUS ONLY (white or gold) ────────────────────────── */}
                    {isExpanded && !isBig && hasAnyBonus && !hasParking && (
                        <motion.div
                            key={`bonus-only-${bonusSectionKey}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ delay: 0.07, duration: 0.2 }}
                            className="flex items-center gap-4 px-6 w-full"
                        >
                            {hasGoldBonus ? (
                                <>
                                    <div className="relative shrink-0">
                                        <CountdownRing remaining={quadRemaining} total={10} size={52} color="#ffd700" />
                                        <span className="absolute inset-0 flex items-center justify-center text-[#ffd700] font-black text-base">
                                            {quadRemaining}
                                        </span>
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[#ffd700] text-[10px] font-black tracking-[0.2em] uppercase">Gold Bonus!</span>
                                        <motion.span
                                            className="text-white font-black text-2xl leading-none"
                                            animate={{ scale: [1, 1.08, 1] }}
                                            transition={{ repeat: Infinity, duration: 0.9 }}
                                        >
                                            ×4 SCORE
                                        </motion.span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative shrink-0">
                                        <CountdownRing remaining={doubleRemaining} total={5} size={52} />
                                        <span className="absolute inset-0 flex items-center justify-center text-[#42C8BE] font-black text-base">
                                            {doubleRemaining}
                                        </span>
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-[#42C8BE] text-[10px] font-black tracking-[0.2em] uppercase">Bonus Active</span>
                                        <motion.span
                                            className="text-white font-black text-2xl leading-none"
                                            animate={{ scale: [1, 1.08, 1] }}
                                            transition={{ repeat: Infinity, duration: 0.9 }}
                                        >
                                            ×2 SCORE
                                        </motion.span>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ── BOTH (parking + any bonus) ────────────────────────── */}
                    {isBig && (
                        <motion.div
                            key={`both-${bonusSectionKey}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ delay: 0.07, duration: 0.2 }}
                            className="flex items-center w-full px-4 gap-3"
                        >
                            {/* Left: parking */}
                            <div className="flex items-center gap-2 flex-1">
                                <img src="/favicon.jpg" alt="Pumba"
                                    className="w-9 h-9 rounded-full object-cover border-2 border-[#42C8BE]/60 shrink-0"
                                />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[#42C8BE] text-[8px] font-black tracking-[0.2em] uppercase">Parking</span>
                                    <div className="flex items-center">
                                        {DirIcon && <DirIcon className="w-4 h-4 text-white stroke-[3.5]" />}
                                        <span className="text-white font-black text-base">{dirLabel}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-px h-8 bg-white/20" />

                            {/* Right: active bonus */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                {hasGoldBonus ? (
                                    <>
                                        <div className="flex flex-col leading-tight items-end">
                                            <span className="text-[#ffd700] text-[8px] font-black tracking-[0.2em] uppercase">Gold</span>
                                            <motion.span
                                                className="text-white font-black text-base"
                                                animate={{ scale: [1, 1.08, 1] }}
                                                transition={{ repeat: Infinity, duration: 0.9 }}
                                            >
                                                ×4
                                            </motion.span>
                                        </div>
                                        <div className="relative shrink-0">
                                            <CountdownRing remaining={quadRemaining} total={10} size={38} color="#ffd700" />
                                            <span className="absolute inset-0 flex items-center justify-center text-[#ffd700] font-black text-xs">
                                                {quadRemaining}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-col leading-tight items-end">
                                            <span className="text-[#42C8BE] text-[8px] font-black tracking-[0.2em] uppercase">Bonus</span>
                                            <motion.span
                                                className="text-white font-black text-base"
                                                animate={{ scale: [1, 1.08, 1] }}
                                                transition={{ repeat: Infinity, duration: 0.9 }}
                                            >
                                                ×2
                                            </motion.span>
                                        </div>
                                        <div className="relative shrink-0">
                                            <CountdownRing remaining={doubleRemaining} total={5} size={38} />
                                            <span className="absolute inset-0 flex items-center justify-center text-[#42C8BE] font-black text-xs">
                                                {doubleRemaining}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </motion.div>
        </div>
    );
};

// ─── Intro Video Player ───────────────────────────────────────────────────────
// Plays intro-1.mp4 → intro-2.mp4 in sequence, then calls onDone.
const INTRO_VIDEOS = ['/intro-1.mp4', '/intro-2.mp4'] as const;

const IntroVideoPlayer: React.FC<{ onDone: () => void }> = ({ onDone }) => {
    const [started, setStarted]       = useState(false); // waiting for first tap
    const [currentIdx, setCurrentIdx] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const toggleFullscreen = () => {
        const doc = document as any;
        const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
        if (isFs) {
            const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
            if (exit) exit.call(doc).catch(() => {});
            setFullscreen(false);
        } else {
            const el = document.documentElement as any;
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) req.call(el).then(() => setFullscreen(true)).catch(() => {});
        }
    };

    // User tapped "Tap to start" — this is the user gesture that unlocks audio
    const handleStartTap = () => {
        // Request fullscreen on first tap (most browsers allow it here)
        const el = document.documentElement as any;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) req.call(el).then(() => setFullscreen(true)).catch(() => {});
        setStarted(true);
    };

    const handleEnded = useCallback(() => {
        if (currentIdx < INTRO_VIDEOS.length - 1) {
            setCurrentIdx(i => i + 1);
        } else {
            onDone();
        }
    }, [currentIdx, onDone]);

    // Play (with audio) when clip index changes, but only after the user tapped
    useEffect(() => {
        if (!started) return;
        const vid = videoRef.current;
        if (!vid) return;
        vid.muted = false;
        vid.src = INTRO_VIDEOS[currentIdx];
        vid.load();
        const tryPlay = () => vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
        if (vid.readyState >= 1) {
            tryPlay();
        } else {
            vid.addEventListener('loadedmetadata', tryPlay, { once: true });
        }
    }, [currentIdx, started]);

    // ── "Tap to Start" splash ────────────────────────────────────────────────
    if (!started) {
        return (
            <div
                className="absolute inset-0 z-[500] bg-black flex flex-col items-center justify-center cursor-pointer select-none"
                onClick={handleStartTap}
            >
                <img src="/logo_2.svg" alt="pumba" className="w-48 md:w-64 mb-10 drop-shadow-lg" />
                <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    className="text-white/80 text-lg md:text-2xl font-bold tracking-widest uppercase"
                >
                    Tap to Start
                </motion.div>
            </div>
        );
    }

    // ── Video player ─────────────────────────────────────────────────────────
    return (
        <div className="absolute inset-0 z-[500] bg-black flex items-center justify-center">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                onEnded={handleEnded}
            />
            {/* Top-right controls */}
            <div className="absolute top-4 right-4 z-[510] flex items-center gap-2">
                <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                               bg-black/50 border border-white/30 text-white/70 text-xs font-semibold
                               hover:bg-black/70 hover:text-white transition-all backdrop-blur-sm"
                    title="Toggle fullscreen"
                >
                    {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                </button>
                <button
                    onClick={() => onDone()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                               bg-black/50 border border-white/30 text-white/70 text-xs font-semibold
                               hover:bg-black/70 hover:text-white transition-all backdrop-blur-sm"
                >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip
                </button>
            </div>
            {/* Clip indicator dots */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {INTRO_VIDEOS.map((_, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${i === currentIdx ? 'bg-white scale-125' : 'bg-white/30'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export const HUD: React.FC = () => {
  const { 
      score, lives, maxLives, status, 
      restartGame, startCountdown, speed, 
      handControlsEnabled, toggleHandControls, countdown,
      parkingCollected,
      selectCharacter, selectedCharacterId, setStatus,
      leaderboard, resetLeaderboard, upcomingParkingLane,
      isPaused, togglePause,
      playerName, playerCompany, setPlayer,
      playerPhoto,
  } = useStore();

  // Track the id of the current session's leaderboard entry to highlight it
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>();
  
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Capture the most-recently-added leaderboard entry when game ends
  useEffect(() => {
    if (status === GameStatus.GAME_OVER && leaderboard.length > 0) {
      // The latest entry was just added; find it by matching name + timestamp (newest first)
      const latest = [...leaderboard].sort((a, b) => b.timestamp - a.timestamp)[0];
      setCurrentEntryId(latest?.id);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = () => {
    const nowMuted = audio.toggleMute();
    setIsMuted(nowMuted);
  };
  
  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  useEffect(() => {
    const handleIntroGesture = () => {
        if (status === GameStatus.INTRO) {
            handleStart();
        }
    };
    window.addEventListener('gesture-jump', handleIntroGesture);
    return () => window.removeEventListener('gesture-jump', handleIntroGesture);
  }, [status, setStatus]);

  // Space bar = pause/resume during gameplay
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [status, togglePause]);

  const handleStart = () => {
      setIsTransitioning(true);
      audio.init();
      audio.startMusic();
      
      setTimeout(() => {
          startCountdown();
          setIsTransitioning(false);
      }, 800);
  };

  // LOGO COMPONENT
  // size="large" → instructions screen (logo_2.svg)
  // size="normal" → in-game top-right (game-logo.png)
  const Logo = ({ size = "normal" }: { size?: "normal" | "large", theme?: "light" | "dark" }) => (
      <div className={`pointer-events-auto z-[200] ${size === "large" ? "" : "absolute top-4 right-4"}`}>
           <img
             src={size === "large" ? "/logo_2.svg" : "/game-logo.png"}
             alt="Logo"
             className={`transition-all duration-300 drop-shadow-lg
                ${size === "large" ? "w-64 md:w-96 mb-6 hover:scale-105" : "w-16 md:w-20 object-contain"}
             `}
             onClick={() => {
                 setStatus(GameStatus.INTRO);
                 audio.stopMenuMusic();
             }}
           />
      </div>
  );


  // --- VIDEO INTRO ---
  if (status === GameStatus.VIDEO_INTRO) {
      return (
          <IntroVideoPlayer
              onDone={() => {
                  audio.init();
                  audio.startMenuMusic();
                  setStatus(GameStatus.REGISTER);
              }}
          />
      );
  }

  // --- PLAYER REGISTRATION ---
  if (status === GameStatus.REGISTER) {
      return (
          <RegisterScreen
              onSubmit={(name, company, contact) => {
                  setPlayer(name, company, contact);
                  setStatus(GameStatus.INTRO);
              }}
          />
      );
  }

  // --- INSTRUCTIONS / ONBOARDING SCREEN ---
  if (status === GameStatus.INTRO) {
      return <OnboardingScreen onStart={handleStart} />;
  }

  if (status === GameStatus.COUNTDOWN) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none">
              <div className="text-8xl md:text-[14rem] font-black text-black font-cyber animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                  {countdown === 0 ? "GO!" : countdown}
              </div>
          </div>
      );
  }

  if (status === GameStatus.GAME_OVER) {
      return (
          <div className="absolute inset-0 z-[100] pointer-events-auto overflow-hidden flex flex-col"
               style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>
              <Logo />

              {/* Two-column layout — fills screen exactly */}
              <div className="flex flex-1 min-h-0">

                {/* ── Left column: Hall of Fame ─────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="w-60 flex-shrink-0 flex flex-col justify-center px-4 py-4 border-r border-white/10 overflow-y-auto"
                >
                  <HallOfFame entries={leaderboard} highlightId={currentEntryId} maxRows={10} />
                </motion.div>

                {/* ── Right column: title + card + button ──────────────────── */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-3 min-h-0">

                  {/* Title */}
                  <motion.h1
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-black text-white font-cyber drop-shadow-lg text-center flex-shrink-0"
                  >
                    GAME OVER
                  </motion.h1>

                  {/* Player name + score row */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="flex items-center gap-4 bg-white/10 border border-[#42C8BE]/40
                               rounded-2xl px-5 py-2 flex-shrink-0"
                  >
                    {playerName && (
                      <span className="text-white font-black text-lg">{playerName}</span>
                    )}
                    <div className="flex items-center gap-2">
                      <img src="/pumba_icon.png" className="w-7 h-7 object-contain" alt="" />
                      <span className="text-[#42C8BE] font-black text-2xl tabular-nums leading-none">
                        {parkingCollected}
                      </span>
                      <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                        spots
                      </span>
                    </div>
                  </motion.div>

                  {/* Share Card — fills remaining vertical space */}
                  {playerPhoto && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="w-full min-h-0 flex-1 flex items-center"
                    >
                      <div className="w-full">
                        <ShareCard
                          playerPhoto={playerPhoto}
                          name={playerName || 'Player'}
                          company={playerCompany}
                          parkingCount={parkingCollected}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Play Again */}
                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => restartGame()}
                    className="w-full py-3 rounded-2xl font-black text-lg text-white flex-shrink-0
                               bg-gradient-to-r from-[#42C8BE] to-[#2C37B2]
                               shadow-[0_8px_24px_rgba(66,200,190,0.4)]
                               hover:shadow-[0_8px_32px_rgba(66,200,190,0.6)] transition-shadow"
                  >
                    Play Again 🚀
                  </motion.button>

                </div>
              </div>
          </div>
      );
  }

  return (
    <div className={containerClass}>
        <Logo />

        {/* Pause overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              key="pause-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex flex-col items-center justify-center pointer-events-auto"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="text-white font-black text-5xl tracking-widest font-cyber drop-shadow-lg">
                  PAUSED
                </div>
                <button
                  onClick={togglePause}
                  className="flex items-center gap-3 bg-[#42C8BE] text-black font-black text-xl px-10 py-4 rounded-full hover:scale-105 transition-all shadow-[0_0_30px_rgba(66,200,190,0.5)]"
                >
                  <Play className="w-6 h-6 fill-black" /> Resume
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unified Dynamic Island — handles idle, parking, bonus, both */}
        <DynamicIsland />

        {/* Top Bar — stat pill + hearts */}
        <div className="flex justify-between items-start w-full">
            {/* Single parking counter pill */}
            <div className="flex items-center gap-3 bg-black/55 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-2.5 shadow-lg">
              <img
                src="/pumba_icon.png"
                className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow"
                alt="Parked"
              />
              <div className="flex flex-col leading-none">
                <span className="text-white text-3xl md:text-5xl font-black font-cyber">{parkingCollected}</span>
                <span className="text-[#42C8BE] text-xs md:text-sm font-semibold tracking-widest uppercase mt-0.5">parked</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 mr-16 md:mr-20">
                {[...Array(maxLives)].map((_, i) => (
                    <Heart 
                        key={i} 
                        className={`w-6 h-6 md:w-8 md:h-8 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-300 fill-gray-300'} drop-shadow-sm`} 
                    />
                ))}

                {/* Pause button */}
                <button
                  onClick={togglePause}
                  className={`pointer-events-auto ml-2 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg
                    ${isPaused
                      ? 'bg-[#42C8BE] text-black scale-110'
                      : 'bg-black/50 text-white border border-white/30 hover:bg-black/70'
                    }`}
                  title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
                >
                  {isPaused
                    ? <Play  className="w-4 h-4 fill-black" />
                    : <Pause className="w-4 h-4" />
                  }
                </button>

                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`pointer-events-auto ml-1 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg
                    ${isMuted
                      ? 'bg-red-500/80 text-white border border-red-400/60'
                      : 'bg-black/50 text-white border border-white/30 hover:bg-black/70'
                    }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted
                    ? <VolumeX className="w-4 h-4" />
                    : <Volume2 className="w-4 h-4" />
                  }
                </button>
            </div>
        </div>

        {/* Bottom — speed only */}
        <div className="w-full flex justify-between items-end">
             <div className="flex items-center space-x-3 text-white drop-shadow-md">
                 <Zap className="w-6 h-6 md:w-8 md:h-8" />
                 <span className="font-mono text-2xl md:text-4xl font-black">SPEED {Math.round((speed / RUN_SPEED_BASE) * 100)}%</span>
             </div>

             {/* bonus indicator handled by DynamicIsland */}
        </div>
    </div>
  );
};
