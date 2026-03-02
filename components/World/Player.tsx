
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; 

// Static Geometries
const TORSO_GEO = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const JETPACK_GEO = new THREE.BoxGeometry(0.3, 0.4, 0.15);
const GLOW_STRIP_GEO = new THREE.PlaneGeometry(0.05, 0.2);

const HEAD_GEO = new THREE.SphereGeometry(0.22, 10, 10);

const ARM_GEO = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_SPHERE_GEO = new THREE.SphereGeometry(0.07);
const HIPS_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 12);

// Character Colors Mapping (Matches HUD Roster)
const CHAR_COLORS: Record<string, string> = {
  'char_1': '#00bfff', // Cyan
  'char_2': '#ef4444', // Red
  'char_3': '#94a3b8', // Silver
  'char_4': '#22c55e', // Green
  'char_5': '#f43f5e', // Rose
  'char_6': '#f97316', // Orange
  'char_7': '#d946ef', // Fuchsia
  'char_8': '#3b82f6', // Blue
  'char_9': '#84cc16', // Lime
  'char_10': '#eab308' // Yellow
};

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, isImmortalityActive, selectedCharacterId, isPaused } = useStore();

  // Limb Refs for Animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  
  // Physics State
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0); 
  const spinRotation = useRef(0);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  // Memoized Materials - Dynamic based on selected character
  const { armorMaterial, jointMaterial, glowMaterial, shadowMaterial, headMaterial, windowMaterial, glowColor } = useMemo(() => {
      // Determine base color from selected ID, default to Cyan if not found
      const baseColor = CHAR_COLORS[selectedCharacterId] || '#42C8BE'; // Turquoise
      
      const armorColor = isImmortalityActive ? '#ffffff' : baseColor;
      const glowColor = isImmortalityActive ? '#ffff00' : baseColor;
      
      return {
          armorMaterial: new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.2, metalness: 0.9, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
          headMaterial: new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.1, metalness: 0.8 }),
          jointMaterial: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.8, metalness: 0.2 }),
          glowMaterial: new THREE.MeshBasicMaterial({ color: glowColor }),
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.4, transparent: true }),
          windowMaterial: new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8 }),
          glowColor
      };
  }, [isImmortalityActive, selectedCharacterId]);

  // Reset State
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumpsPerformed.current = 0;
          velocityY.current = 0;
          spinRotation.current = 0;
          if (groupRef.current) groupRef.current.position.y = 0;
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
          setLane(0);
      }
  }, [status]);
  
  // Clamp lane
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  // Handle Hit Event
  useEffect(() => {
      const handleHit = () => {
          if (status === GameStatus.PLAYING && !isInvincible.current && !isImmortalityActive) {
             takeDamage();
             audio.playDamage();
             isInvincible.current = true;
             lastDamageTime.current = Date.now();
          }
      };
      window.addEventListener('player-hit', handleHit);
      return () => window.removeEventListener('player-hit', handleHit);
  }, [status, isImmortalityActive, takeDamage]);

  // Controls
  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;
    if (!isJumping.current) {
        audio.playJump(false);
        isJumping.current = true;
        jumpsPerformed.current = 1;
        velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
        audio.playJump(true);
        jumpsPerformed.current += 1;
        velocityY.current = JUMP_FORCE;
        spinRotation.current = 0;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
      else if (e.key === ' ' || e.key === 'Enter') activateImmortality();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
            triggerJump();
        } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            activateImmortality();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  // Gestures
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      const handleGestureLeft = () => status === GameStatus.PLAYING && setLane(l => Math.max(l - 1, -maxLane));
      const handleGestureRight = () => status === GameStatus.PLAYING && setLane(l => Math.min(l + 1, maxLane));
      const handleGestureJump = () => status === GameStatus.PLAYING && triggerJump();

      window.addEventListener('gesture-left', handleGestureLeft);
      window.addEventListener('gesture-right', handleGestureRight);
      window.addEventListener('gesture-jump', handleGestureJump);

      return () => {
          window.removeEventListener('gesture-left', handleGestureLeft);
          window.removeEventListener('gesture-right', handleGestureRight);
          window.removeEventListener('gesture-jump', handleGestureJump);
      };
  }, [status, laneCount]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;
    if (isPaused) return;

    // Position Interpolation
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        delta * 15 
    );

    // Jump Physics
    if (isJumping.current) {
        groupRef.current.position.y += velocityY.current * delta;
        velocityY.current -= GRAVITY * delta;

        if (groupRef.current.position.y <= 0) {
            groupRef.current.position.y = 0;
            isJumping.current = false;
            jumpsPerformed.current = 0;
            velocityY.current = 0;
            if (bodyRef.current) bodyRef.current.rotation.x = 0;
        }

        if (jumpsPerformed.current === 2 && bodyRef.current) {
             spinRotation.current -= delta * 15;
             if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
             bodyRef.current.rotation.x = spinRotation.current;
        }
    }

    // Banking
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2; 
    groupRef.current.rotation.x = isJumping.current ? 0.1 : 0.05; 

    // Animation
    const time = state.clock.elapsedTime * 25; 
    
    // Animate wheels
    if (bodyRef.current) {
        // Find all meshes that are wheels (we'll name them 'wheel')
        bodyRef.current.children.forEach(child => {
            if (child.name === 'wheel') {
                child.rotation.x -= delta * 20; // Rotate wheels based on speed
            }
        });
        
        // Small suspension bob
        if (!isJumping.current) {
            bodyRef.current.position.y = 0.4 + Math.abs(Math.sin(time * 0.5)) * 0.05;
        }
    }

    // Invincibility Blink
    if (isInvincible.current) {
        if (Date.now() - lastDamageTime.current > 1500) {
            isInvincible.current = false;
            if (groupRef.current) groupRef.current.visible = true;
        } else {
            if (groupRef.current) {
                groupRef.current.visible = Math.floor(Date.now() / 100) % 2 === 0;
            }
        }
    } else {
        if (groupRef.current) groupRef.current.visible = true;
    }
  });

  return (
    <group ref={groupRef}>
            {/* Shadow */}
            <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={shadowMaterial}>
                <circleGeometry args={[1.5, 32]} />
            </mesh>

        {/* Main Car Rig */}
        <group ref={bodyRef} position={[0, 0.4, 0]}>
            {/* Car Body Base */}
            <mesh position={[0, 0.1, 0]} material={armorMaterial}>
                <boxGeometry args={[1.4, 0.3, 2.8]} />
            </mesh>
            
            {/* Car Body Top/Middle */}
            <mesh position={[0, 0.3, -0.1]} material={armorMaterial}>
                <boxGeometry args={[1.3, 0.2, 2.6]} />
            </mesh>
            
            {/* Front Bumper */}
            <mesh position={[0, 0.1, -1.45]} material={jointMaterial}>
                <boxGeometry args={[1.45, 0.15, 0.1]} />
            </mesh>
            <mesh position={[0, 0.05, -1.5]} material={new THREE.MeshStandardMaterial({ color: '#222222' })}>
                <boxGeometry args={[1.3, 0.05, 0.05]} />
            </mesh>
            
            {/* Rear Bumper */}
            <mesh position={[0, 0.1, 1.45]} material={jointMaterial}>
                <boxGeometry args={[1.45, 0.15, 0.1]} />
            </mesh>
            
            {/* Exhaust */}
            <mesh position={[0.4, 0.05, 1.5]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>
            <mesh position={[-0.4, 0.05, 1.5]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>

            {/* Car Cabin */}
            <mesh position={[0, 0.6, -0.3]} material={headMaterial}>
                <boxGeometry args={[1.1, 0.4, 1.2]} />
            </mesh>
            
            {/* Roof Rack */}
            <mesh position={[0.3, 0.82, -0.3]} material={jointMaterial}>
                <boxGeometry args={[0.05, 0.05, 1.0]} />
            </mesh>
            <mesh position={[-0.3, 0.82, -0.3]} material={jointMaterial}>
                <boxGeometry args={[0.05, 0.05, 1.0]} />
            </mesh>
            <mesh position={[0, 0.82, 0.15]} material={jointMaterial}>
                <boxGeometry args={[0.65, 0.05, 0.05]} />
            </mesh>
            <mesh position={[0, 0.82, -0.75]} material={jointMaterial}>
                <boxGeometry args={[0.65, 0.05, 0.05]} />
            </mesh>
            
            {/* Windshield */}
            <mesh position={[0, 0.6, -0.91]} material={windowMaterial}>
                <boxGeometry args={[1.0, 0.35, 0.05]} />
            </mesh>
            
            {/* Rear Window */}
            <mesh position={[0, 0.6, 0.31]} material={windowMaterial}>
                <boxGeometry args={[1.0, 0.35, 0.05]} />
            </mesh>
            
            {/* Side Windows */}
            <mesh position={[0.56, 0.6, -0.3]} material={windowMaterial}>
                <boxGeometry args={[0.05, 0.35, 1.1]} />
            </mesh>
            <mesh position={[-0.56, 0.6, -0.3]} material={windowMaterial}>
                <boxGeometry args={[0.05, 0.35, 1.1]} />
            </mesh>
            
            {/* Window Pillars (A-Pillar) */}
            <mesh position={[0.48, 0.6, -0.9]} rotation={[0.5, 0, 0]} material={armorMaterial}>
                <boxGeometry args={[0.06, 0.4, 0.05]} />
            </mesh>
            <mesh position={[-0.48, 0.6, -0.9]} rotation={[0.5, 0, 0]} material={armorMaterial}>
                <boxGeometry args={[0.06, 0.4, 0.05]} />
            </mesh>
            
            {/* Window Pillars (C-Pillar) */}
            <mesh position={[0.48, 0.6, 0.3]} rotation={[-0.5, 0, 0]} material={armorMaterial}>
                <boxGeometry args={[0.06, 0.4, 0.05]} />
            </mesh>
            <mesh position={[-0.48, 0.6, 0.3]} rotation={[-0.5, 0, 0]} material={armorMaterial}>
                <boxGeometry args={[0.06, 0.4, 0.05]} />
            </mesh>
            
            {/* Side Mirrors */}
            <mesh position={[0.65, 0.5, -0.6]} material={armorMaterial}>
                <boxGeometry args={[0.15, 0.1, 0.1]} />
            </mesh>
            <mesh position={[-0.65, 0.5, -0.6]} material={armorMaterial}>
                <boxGeometry args={[0.15, 0.1, 0.1]} />
            </mesh>

            {/* Spoiler */}
            <mesh position={[0, 0.5, 1.2]} material={jointMaterial}>
                <boxGeometry args={[1.2, 0.05, 0.3]} />
            </mesh>
            <mesh position={[0.4, 0.4, 1.2]} material={jointMaterial}>
                <boxGeometry args={[0.05, 0.2, 0.2]} />
            </mesh>
            <mesh position={[-0.4, 0.4, 1.2]} material={jointMaterial}>
                <boxGeometry args={[0.05, 0.2, 0.2]} />
            </mesh>

            {/* Grill */}
            <mesh position={[0, 0.15, -1.41]} material={jointMaterial}>
                <boxGeometry args={[0.7, 0.2, 0.05]} />
            </mesh>
            <mesh position={[0, 0.1, -1.42]} material={armorMaterial}>
                <boxGeometry args={[0.6, 0.05, 0.05]} />
            </mesh>
            <mesh position={[0, 0.2, -1.42]} material={armorMaterial}>
                <boxGeometry args={[0.6, 0.05, 0.05]} />
            </mesh>

            {/* Taillights — bright red */}
            <mesh position={[0.5, 0.22, 1.41]}>
                <boxGeometry args={[0.38, 0.18, 0.06]} />
                <meshBasicMaterial color="#ff2200" />
            </mesh>
            <mesh position={[-0.5, 0.22, 1.41]}>
                <boxGeometry args={[0.38, 0.18, 0.06]} />
                <meshBasicMaterial color="#ff2200" />
            </mesh>
            {/* Taillight glow halo */}
            <mesh position={[0.5, 0.22, 1.46]}>
                <boxGeometry args={[0.44, 0.26, 0.04]} />
                <meshBasicMaterial color="#ff2200" transparent opacity={0.25} />
            </mesh>
            <mesh position={[-0.5, 0.22, 1.46]}>
                <boxGeometry args={[0.44, 0.26, 0.04]} />
                <meshBasicMaterial color="#ff2200" transparent opacity={0.25} />
            </mesh>

            {/* Exhaust */}
            <mesh position={[0.4, 0.05, 1.45]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>
            <mesh position={[-0.4, 0.05, 1.45]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>
            
            {/* License Plate Frame */}
            <mesh position={[0, 0.15, 1.41]} material={jointMaterial}>
                <boxGeometry args={[0.45, 0.2, 0.02]} />
            </mesh>
            
            <mesh position={[0, 0.15, 1.42]}>
                <boxGeometry args={[0.4, 0.15, 0.01]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>

            {/* Exhaust */}
            <mesh position={[0.4, 0.05, 1.45]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>
            <mesh position={[-0.4, 0.05, 1.45]} rotation={[Math.PI/2, 0, 0]} material={jointMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
            </mesh>
            
            {/* License Plate Frame */}
            <mesh position={[0, 0.15, 1.41]} material={jointMaterial}>
                <boxGeometry args={[0.45, 0.2, 0.02]} />
            </mesh>

            {/* Wheels */}
            <mesh name="wheel" position={[0.8, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={jointMaterial}>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 32]} />
            </mesh>
            {/* Tire Tread */}
            <mesh position={[0.8, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 })}>
                <cylinderGeometry args={[0.36, 0.36, 0.15, 32]} />
            </mesh>
            {/* Hubcap */}
            <mesh position={[0.93, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.2 })}>
                <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
            </mesh>
            {/* Rims Details */}
            <mesh position={[0.94, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#111111' })}>
                <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
            </mesh>
            
            <mesh name="wheel" position={[-0.8, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={jointMaterial}>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 32]} />
            </mesh>
            {/* Tire Tread */}
            <mesh position={[-0.8, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 })}>
                <cylinderGeometry args={[0.36, 0.36, 0.15, 32]} />
            </mesh>
            {/* Hubcap */}
            <mesh position={[-0.93, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.2 })}>
                <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
            </mesh>
            {/* Rims Details */}
            <mesh position={[-0.94, 0, -0.9]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#111111' })}>
                <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
            </mesh>
            
            <mesh name="wheel" position={[0.8, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={jointMaterial}>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 32]} />
            </mesh>
            {/* Tire Tread */}
            <mesh position={[0.8, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 })}>
                <cylinderGeometry args={[0.36, 0.36, 0.15, 32]} />
            </mesh>
            {/* Hubcap */}
            <mesh position={[0.93, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.2 })}>
                <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
            </mesh>
            {/* Rims Details */}
            <mesh position={[0.94, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#111111' })}>
                <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
            </mesh>
            
            <mesh name="wheel" position={[-0.8, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={jointMaterial}>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 32]} />
            </mesh>
            {/* Tire Tread */}
            <mesh position={[-0.8, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.9 })}>
                <cylinderGeometry args={[0.36, 0.36, 0.15, 32]} />
            </mesh>
            {/* Hubcap */}
            <mesh position={[-0.93, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.2 })}>
                <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
            </mesh>
            {/* Rims Details */}
            <mesh position={[-0.94, 0, 1.0]} rotation={[0, 0, Math.PI/2]} material={new THREE.MeshStandardMaterial({ color: '#111111' })}>
                <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
            </mesh>
        </group>
    </group>
  );
};
