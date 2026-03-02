
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { useStore } from '../../store';
import { GameStatus } from '../../types';
import { captureAndSegmentPhoto } from './photoCapture';

export const GestureController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { handControlsEnabled, status, setPlayerPhoto } = useStore();
  
  const statusRef = useRef(status);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Camera display mode: 'center' = large centered (onboarding step-0), 'corner' = small bottom-right
  const [cameraMode, setCameraMode] = useState<'center' | 'corner'>(
    status === GameStatus.INTRO ? 'center' : 'corner'
  );
  
  const lastZoneRef = useRef<'LEFT' | 'CENTER' | 'RIGHT'>('CENTER');
  
  // Logic for Double Fist / Menu Navigation
  const wasFistRef = useRef(false);
  const lastFistTimeRef = useRef(0);
  const fistCountRef = useRef(0);

  useEffect(() => {
    statusRef.current = status;
    // When leaving INTRO, always revert to corner mode
    if (status !== GameStatus.INTRO) setCameraMode('corner');
    // When entering INTRO fresh, go center
    if (status === GameStatus.INTRO) setCameraMode('center');
  }, [status]);

  const onboardingStepRef = useRef(0);
  const centerFistCountRef = useRef(0);
  const centerFistTimeRef = useRef(0);
  // Cooldown: prevent the same gesture from firing again immediately after a step advance
  const lastAdvanceTimeRef = useRef(0);
  const ADVANCE_COOLDOWN_MS = 1500;

  // Listen for onboarding step changes to move camera to corner on steps 1+
  useEffect(() => {
    const handler = (e: Event) => {
      const step = (e as CustomEvent<{ step: number }>).detail.step;
      onboardingStepRef.current = step;
      centerFistCountRef.current = 0;
      lastAdvanceTimeRef.current = Date.now(); // start cooldown on every step change
      setCameraMode(step === 0 ? 'center' : 'corner');
    };
    window.addEventListener('onboarding-step', handler);
    return () => window.removeEventListener('onboarding-step', handler);
  }, []);

  // Auto-start camera when in center (onboarding) mode — no button tap needed
  useEffect(() => {
    if (cameraMode === 'center' && isLoaded && !permissionRequested) {
      setPermissionRequested(true);
    }
  }, [cameraMode, isLoaded, permissionRequested]);

  // Load MediaPipe Model
  useEffect(() => {
    const loadMediaPipe = async () => {
      if (!handControlsEnabled) return;

      try {
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          
          gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
          
          setIsLoaded(true);
      } catch (e) {
          console.error("Failed to load MediaPipe:", e);
      }
    };

    if (handControlsEnabled && !gestureRecognizerRef.current) {
      loadMediaPipe();
    }
  }, [handControlsEnabled]);

  // Handle Camera and Prediction Loop
  useEffect(() => {
    if (!handControlsEnabled || !isLoaded || !permissionRequested) return;

    let isActive = true;

    const setupCamera = async () => {
        if (!videoRef.current) return;
        
        try {
            let stream: MediaStream;
            try {
                 stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: "user", 
                        width: { ideal: 320 }, 
                        height: { ideal: 240 } 
                    } 
                });
            } catch (err) {
                console.warn("Ideal camera failed, fallback to generic video", err);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            
            if (isActive && videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                
                try {
                    await videoRef.current.play();
                } catch (e) {
                    console.error("Video play failed", e);
                }

                // Start the prediction loop
                predictWebcam();
            }
            setCameraError(null);
        } catch (err: any) {
            console.error("Camera error:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCameraError("Permission denied");
            } else {
                setCameraError("CAMERA ERROR");
            }
        }
    };

    const predictWebcam = () => {
        if (!isActive) return;

        if (videoRef.current && gestureRecognizerRef.current && videoRef.current.readyState === 4) {
            const nowInMs = performance.now();
            const results = gestureRecognizerRef.current.recognizeForVideo(videoRef.current, nowInMs);

            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    const w = canvas.width;
                    const h = canvas.height;

                    ctx.clearRect(0, 0, w, h);

                    // Equal thirds: each zone is exactly 1/3 of the frame width
                    const T1 = 1 / 3; // ~0.333
                    const T2 = 2 / 3; // ~0.667

                    // Zone dividing lines
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(w * T1, 0); ctx.lineTo(w * T1, h);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(w * T2, 0); ctx.lineTo(w * T2, h);
                    ctx.stroke();

                    if (results.landmarks && results.landmarks.length > 0) {
                        const landmarks = results.landmarks[0];
                        const x = landmarks[9].x; 

                        let currentZone: 'LEFT' | 'CENTER' | 'RIGHT' = 'CENTER';
                        if (x < T1) {
                            currentZone = 'RIGHT';
                            ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                            ctx.fillRect(0, 0, w * T1, h);
                        } else if (x > T2) {
                            currentZone = 'LEFT';
                            ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                            ctx.fillRect(w * T2, 0, w * T1, h);
                        } else {
                            currentZone = 'CENTER';
                            ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
                            ctx.fillRect(w * T1, 0, w * T1, h);
                        }

                        // Drawing hand
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
                        drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", radius: 3 });

                        // --- GESTURE LOGIC ---
                        const gesture = results.gestures?.[0]?.[0];
                        const isFist     = gesture && (gesture.categoryName === 'Closed_Fist' || gesture.categoryName === 'Fist') && gesture.score > 0.5;
                        const isOpenPalm = gesture && gesture.categoryName === 'Open_Palm' && gesture.score > 0.6;

                        // 1. MENU MODE CONTROLS
                        if (statusRef.current === GameStatus.MENU) {
                            // Detect Fist Onset (rising edge)
                            if (isFist && !wasFistRef.current) {
                                const now = Date.now();
                                
                                // Reset count if too much time passed
                                if (now - lastFistTimeRef.current > 800) {
                                    fistCountRef.current = 0;
                                }

                                if (currentZone === 'RIGHT') {
                                    // Right + Fist = Next
                                    window.dispatchEvent(new CustomEvent('menu-next'));
                                    showFeedback("NEXT >");
                                } else if (currentZone === 'LEFT') {
                                    // Left + Fist = Prev
                                    window.dispatchEvent(new CustomEvent('menu-prev'));
                                    showFeedback("< PREV");
                                } else if (currentZone === 'CENTER') {
                                    // Center + Double Fist = Start
                                    fistCountRef.current += 1;
                                    lastFistTimeRef.current = now;
                                    
                                    if (fistCountRef.current === 1) {
                                        showFeedback("ONE MORE!");
                                    } else if (fistCountRef.current >= 2) {
                                        window.dispatchEvent(new CustomEvent('menu-start'));
                                        showFeedback("STARTING!");
                                        fistCountRef.current = 0;
                                    }
                                }
                            }
                        }
                        
                        // 2. PLAYING MODE CONTROLS
                        else if (statusRef.current === GameStatus.PLAYING) {
                            // Movement based on Zone Crossing (Continuous)
                            if (currentZone !== lastZoneRef.current) {
                                const prev = lastZoneRef.current;
                                const curr = currentZone;
                                if (curr === 'LEFT') window.dispatchEvent(new CustomEvent('gesture-left'));
                                else if (curr === 'RIGHT') window.dispatchEvent(new CustomEvent('gesture-right'));
                                else if (curr === 'CENTER') {
                                    if (prev === 'LEFT') window.dispatchEvent(new CustomEvent('gesture-right'));
                                    else if (prev === 'RIGHT') window.dispatchEvent(new CustomEvent('gesture-left'));
                                }
                            }
                            // Jump on Fist (Simple trigger)
                            if (isFist && !wasFistRef.current) {
                                window.dispatchEvent(new CustomEvent('gesture-jump'));
                                showFeedback("JUMP!");
                            }
                        }

                        // 3. INTRO / ONBOARDING — right+fist = advance, left+fist = back
                        //    Last step (3): center + double fist = start game
                        else if (statusRef.current === GameStatus.INTRO) {
                            const isLastStep = onboardingStepRef.current === 3;

                            // Zone crossing → fire gesture event for checklist feedback
                            if (currentZone !== lastZoneRef.current) {
                                if (currentZone === 'RIGHT') {
                                    window.dispatchEvent(new CustomEvent('gesture-right'));
                                    showFeedback("RIGHT ➡️");
                                } else if (currentZone === 'LEFT') {
                                    showFeedback("⬅️ LEFT");
                                }
                            }

                            if (isFist && !wasFistRef.current) {
                                const now = Date.now();
                                const cooledDown = now - lastAdvanceTimeRef.current > ADVANCE_COOLDOWN_MS;

                                if (isLastStep && currentZone === 'CENTER') {
                                    // Double fist in center → start game (no cooldown needed here,
                                    // user must do two deliberate fists)
                                    const gap = now - centerFistTimeRef.current;
                                    centerFistTimeRef.current = now;
                                    if (gap < 2000) {
                                        centerFistCountRef.current += 1;
                                    } else {
                                        centerFistCountRef.current = 1;
                                    }
                                    if (centerFistCountRef.current >= 2) {
                                        centerFistCountRef.current = 0;
                                        lastAdvanceTimeRef.current = now;
                                        window.dispatchEvent(new CustomEvent('onboarding-advance'));
                                        showFeedback("🚀 START!");
                                    } else {
                                        showFeedback("✊ One more!");
                                    }
                                } else if (!isLastStep && currentZone === 'RIGHT' && cooledDown) {
                                    lastAdvanceTimeRef.current = now;
                                    window.dispatchEvent(new CustomEvent('onboarding-advance'));
                                    showFeedback("NEXT ✅");
                                } else if (currentZone === 'LEFT' && cooledDown) {
                                    lastAdvanceTimeRef.current = now;
                                    window.dispatchEvent(new CustomEvent('onboarding-back'));
                                    showFeedback("← BACK");
                                } else if (isLastStep && currentZone !== 'CENTER') {
                                    showFeedback("👈 Move to CENTER");
                                }
                            }
                        }

                        // Open palm on step 0 → capture player photo
                        if (
                          statusRef.current === GameStatus.INTRO &&
                          onboardingStepRef.current === 0 &&
                          isOpenPalm &&
                          !wasFistRef.current &&
                          videoRef.current
                        ) {
                          showFeedback("📸 Captured!");
                          const vid = videoRef.current;
                          captureAndSegmentPhoto(vid).then(photo => {
                            if (photo) setPlayerPhoto(photo);
                          }).catch(console.error);
                        }

                        // Update Refs
                        wasFistRef.current = !!isFist;
                        lastZoneRef.current = currentZone;
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const showFeedback = (text: string) => {
        setFeedbackText(text);
        setTimeout(() => setFeedbackText(null), 600);
    };

    setupCamera();

    return () => {
        isActive = false;
        if (videoRef.current && videoRef.current.srcObject) {
             const stream = videoRef.current.srcObject as MediaStream;
             stream.getTracks().forEach(track => track.stop());
        }
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
    };
  }, [handControlsEnabled, isLoaded, permissionRequested]);

  if (!handControlsEnabled) return null;
  if (status === GameStatus.GAME_OVER) return null;

  const containerClass = cameraMode === 'center'
    ? 'absolute top-[10.5rem] left-1/2 -translate-x-1/2 z-[250] bg-black/70 border-2 border-[#42C8BE]/70 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(66,200,190,0.5)] transition-all duration-500'
    : 'absolute bottom-4 right-4 z-[300] w-32 h-24 md:w-80 md:h-60 bg-black/50 border-2 border-cyan-500/50 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all duration-500';

  // Camera width — exported as CSS value for the spacer in OnboardingScreen
  const CAMERA_CSS_W = 'min(99vw, 72rem)';

  return (
    <div
      className={containerClass}
      style={cameraMode === 'center' ? { width: CAMERA_CSS_W } : undefined}
    >
        {/* 16:9 wrapper — only in center mode; corner mode keeps fixed w/h from containerClass */}
        <div className={cameraMode === 'center' ? 'relative w-full aspect-video transform -scale-x-100' : 'relative w-full h-full transform -scale-x-100'}>
            <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover opacity-60" 
                autoPlay 
                playsInline
                muted
            />
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover"
            />
        </div>

        <div className="absolute inset-0 pointer-events-none">
             {!isLoaded && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className={`text-cyan-400 font-cyber animate-pulse ${cameraMode === 'center' ? 'text-base' : 'text-[8px] md:text-xs'}`}>
                        INIT MODEL...
                    </div>
                </div>
            )}
            
            {!permissionRequested && isLoaded && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
                    <button 
                        onClick={() => setPermissionRequested(true)}
                        className={`bg-cyan-500 text-white font-bold rounded hover:bg-cyan-600 transition-colors
                            ${cameraMode === 'center' ? 'py-3 px-8 text-base' : 'py-1 px-3 text-[10px] md:text-sm'}`}
                    >
                        START CAMERA
                    </button>
                </div>
            )}

            {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 pointer-events-auto">
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-white font-cyber text-[8px] md:text-xs font-bold px-2 text-center">{cameraError}</div>
                        {cameraError === "Permission denied" && (
                             <button 
                                onClick={() => {
                                    setCameraError(null);
                                    setPermissionRequested(true);
                                }}
                                className="bg-white/20 text-white font-bold py-1 px-2 rounded text-[8px] md:text-xs hover:bg-white/30 transition-colors"
                            >
                                RETRY
                            </button>
                        )}
                    </div>
                </div>
            )}

            {feedbackText && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`bg-red-500/90 text-white font-black font-cyber px-3 py-1.5 rounded-lg animate-bounce
                        ${cameraMode === 'center' ? 'text-2xl' : 'text-[10px] md:text-xl'}`}>
                        {feedbackText}
                    </div>
                </div>
            )}
            
            {statusRef.current === GameStatus.MENU && (
                <div className="absolute bottom-1 left-0 w-full flex justify-between px-2 md:px-4 text-[8px] md:text-[10px] font-bold text-white/80 font-cyber">
                    <span className="text-cyan-400">NEXT</span>
                    <span className="text-yellow-400">START (x2)</span>
                    <span className="text-cyan-400">PREV</span>
                </div>
            )}

             {(statusRef.current === GameStatus.PLAYING || statusRef.current === GameStatus.INTRO) && (
                // Labels are NOT inside the mirrored div, so LEFT/RIGHT are swapped to match visual
                <div className={`absolute bottom-1 left-0 w-full flex justify-between font-bold text-white/80 font-cyber
                    ${cameraMode === 'center'
                        ? 'px-4 py-2 text-sm md:text-base'
                        : 'px-2 md:px-4 text-[8px] md:text-[10px]'}`}>
                    <span className={cameraMode === 'center' ? 'text-[#42C8BE]' : ''}>LEFT</span>
                    <span className={cameraMode === 'center' ? 'text-white/60' : ''}>MOVE</span>
                    <span className={cameraMode === 'center' ? 'text-[#42C8BE]' : ''}>RIGHT</span>
                </div>
            )}
            
            <div className={`absolute left-2 ${cameraMode === 'center' ? 'top-2' : 'top-1'}`}>
                <div className="flex items-center space-x-1">
                    <div className={`rounded-full ${cameraError ? 'bg-red-900' : 'bg-red-500 animate-pulse'}
                        ${cameraMode === 'center' ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5 md:w-2 md:h-2'}`} />
                    <span className={`text-red-400 font-mono ${cameraMode === 'center' ? 'text-xs' : 'text-[6px] md:text-[8px]'}`}>LIVE</span>
                </div>
            </div>
        </div>
    </div>
  );
};
