

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus } from '../../types';
import { audio } from '../System/Audio';

// --- Hurdle Geometries ---
const HURDLE_FRAME_GEO = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8); // Vertical posts
const HURDLE_BASE_GEO = new THREE.BoxGeometry(0.05, 0.05, 0.8); // Floor legs
const HURDLE_BOARD_GEO = new THREE.BoxGeometry(2.0, 0.35, 0.08); // The top board

// --- Coin Geometries ---
const COIN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16); // 16 segments is plenty for a small coin
const COIN_FACE_GEO = new THREE.PlaneGeometry(1.2, 1.2);

const SHADOW_COIN_GEO    = new THREE.CircleGeometry(0.6, 16);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

const PARTICLE_COUNT = 600;

// Reusable Vector3 — never allocate inside useFrame
const _playerPos = new THREE.Vector3();

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.7} />
        </instancedMesh>
    );
};

const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectCoin,
    collectParking,
    collectBonus,
    collectGoldBonus,
    goldBonusUsed,
    laneCount,
    setUpcomingParkingLane,
    isPaused
  } = useStore();
  
  const coinTexture = useLoader(THREE.TextureLoader, '/logo_2.svg');
  coinTexture.colorSpace = THREE.SRGBColorSpace;

  const pumbaIconTexture = useLoader(THREE.TextureLoader, '/pumba_icon.png');
  pumbaIconTexture.colorSpace = THREE.SRGBColorSpace;

  const sensorTexture = useLoader(THREE.TextureLoader, '/bonus.jpg');
  sensorTexture.colorSpace = THREE.SRGBColorSpace;

  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  // Track last reported parking lane to avoid redundant Zustand updates every frame
  const lastParkingLane = useRef<number | null>(undefined as unknown as null);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);

  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;

    if (isMenuReset || isRestart) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        setUpcomingParkingLane(null);
    }
    prevStatus.current = status;
  }, [status, setUpcomingParkingLane]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING || isPaused) return;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    distanceTraveled.current += dist;

    let hasChanges = false;
    _playerPos.set(0, 0, 0);
    if (playerObjRef.current) playerObjRef.current.getWorldPosition(_playerPos);
    const playerPos = _playerPos;

    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    
    let closestParkingLane: number | null = null;
    let closestParkingZ = -Infinity;

    for (const obj of currentObjects) {
        obj.position[2] += dist;
        let keep = true;
        const prevZ = obj.position[2] - dist;

        if (obj.active) {
            // Check for upcoming parking spots for the HUD
            if (obj.type === ObjectType.COIN && obj.position[2] < playerPos.z && obj.position[2] > playerPos.z - 80) {
                if (obj.position[2] > closestParkingZ) {
                    closestParkingZ = obj.position[2];
                    closestParkingLane = Math.round(obj.position[0] / LANE_WIDTH);
                }
            }

            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
                    if (inZZone) {
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) { 
                     if (obj.type === ObjectType.OBSTACLE) {
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8; 
                         if (playerBottom < 1.4 && playerTop > 0) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                         }
                     } else {
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         if (dy < 2.5) { 
                            if (obj.type === ObjectType.COIN) {
                                collectCoin();
                                collectParking();
                                audio.playCoinCollect();
                            } else if (obj.type === ObjectType.BONUS) {
                                collectBonus();
                                audio.playCoinCollect();
                                window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#42C8BE' } }));
                                window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: [obj.position[0], obj.position[1] + 1, obj.position[2]], color: '#ffffff' } }));
                            } else if (obj.type === ObjectType.GOLD_BONUS) {
                                collectGoldBonus();
                                audio.playCoinCollect();
                                window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ffd700' } }));
                                window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: [obj.position[0], obj.position[1] + 1, obj.position[2]], color: '#ffaa00' } }));
                            }
                            window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: obj.color || '#ffffff' } }));
                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }
        if (keep) keptObjects.push(obj);
    }
    
    // Only update Zustand when the value actually changes (avoids a React re-render every frame)
    if (closestParkingLane !== lastParkingLane.current) {
      lastParkingLane.current = closestParkingLane;
      setUpcomingParkingLane(closestParkingLane);
    }

    // Find furthest Z without spread/map allocation
    let furthestZ = -20;
    if (keptObjects.length > 0) {
      furthestZ = keptObjects[0].position[2];
      for (let i = 1; i < keptObjects.length; i++) {
        if (keptObjects[i].position[2] < furthestZ) furthestZ = keptObjects[i].position[2];
      }
    }

    if (furthestZ > -SPAWN_DISTANCE) {
            const minGap = 12 + (speed * 0.4); 
            const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
            
            const spawnType = Math.random();
            if (spawnType < 0.4) { // 40% chance for a parking spot
            const lane = getRandomLane(laneCount);
            keptObjects.push({
                id: uuidv4(),
                type: ObjectType.COIN,
                position: [lane * LANE_WIDTH, 0.1, spawnZ],
                active: true,
                color: '#42C8BE'
            });
            hasChanges = true;
            } else if (spawnType < 0.48) { // 8% chance for white bonus sensor
            const lane = getRandomLane(laneCount);
            keptObjects.push({
                id: uuidv4(),
                type: ObjectType.BONUS,
                position: [lane * LANE_WIDTH, 1.2, spawnZ],
                active: true,
                color: '#42C8BE'
            });
            hasChanges = true;
            } else if (spawnType < 0.51 && !goldBonusUsed) { // 3% chance for rare gold bonus (one per game)
            const lane = getRandomLane(laneCount);
            keptObjects.push({
                id: uuidv4(),
                type: ObjectType.GOLD_BONUS,
                position: [lane * LANE_WIDTH, 1.2, spawnZ],
                active: true,
                color: '#ffd700'
            });
            hasChanges = true;
            } else if (spawnType < 0.88) { // ~37% chance for obstacles
            const availableLanes = [];
            const maxLane = Math.floor(laneCount / 2);
            for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
            availableLanes.sort(() => Math.random() - 0.5);
            
            let countToSpawn = Math.random() > 0.85 ? 2 : 1;
            
            const subTypes = ['double_parked', 'garbage_truck', 'no_entry'];
            // 3 distinct car body colors — picked randomly at spawn time
            const carColors = ['#e2e5e8', '#7ab2d4', '#e88080'] as const;

            for (let i = 0; i < countToSpawn; i++) {
                const lane = availableLanes[i];
                const subType = subTypes[Math.floor(Math.random() * subTypes.length)];
                const color = subType === 'double_parked'
                    ? carColors[Math.floor(Math.random() * carColors.length)]
                    : '#ffffff';
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.OBSTACLE,
                    subType,
                    position: [lane * LANE_WIDTH, 0.6, spawnZ],
                    active: true,
                    color,
                });
            }
            hasChanges = true;
            }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} coinTexture={coinTexture} pumbaIconTexture={pumbaIconTexture} sensorTexture={sensorTexture} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject, coinTexture: THREE.Texture, pumbaIconTexture: THREE.Texture, sensorTexture: THREE.Texture }> = React.memo(({ data, coinTexture, pumbaIconTexture, sensorTexture }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const iconRef = useRef<THREE.Group>(null);
    
    useFrame((state, delta) => {
        if (groupRef.current) groupRef.current.position.set(data.position[0], 0, data.position[2]);

        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.OBSTACLE) {
                visualRef.current.position.y = baseHeight;
                if (data.subType === 'double_parked') {
                    const blink = Math.floor(state.clock.elapsedTime * 4) % 2 === 0;
                    const lights = visualRef.current.getObjectByName('hazardLights');
                    if (lights) lights.visible = blink;
                }
            } else if (data.type === ObjectType.COIN) {
                // Parking spot pulses slightly
                const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
                visualRef.current.scale.set(pulse, 1, pulse);
            }
        }

        // Rotate the 3D icon above parking spots
        if (iconRef.current && data.type === ObjectType.COIN) {
            iconRef.current.rotation.y += delta * 2.5;
            iconRef.current.position.y = 1.8 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
        }

        // Animate bonus pickup: spin + float
        if (iconRef.current && (data.type === ObjectType.BONUS || data.type === ObjectType.GOLD_BONUS)) {
            iconRef.current.rotation.y += delta * 3.0;
            iconRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.2;
        }
    });

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.COIN && data.subType !== 'no_entry' && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                    <circleGeometry args={[
                      data.subType === 'garbage_truck' ? 1.5
                      : data.type === ObjectType.GOLD_BONUS ? 1.0
                      : 0.8,
                      16
                    ]} />
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            {/* White bonus ground ring */}
            {data.type === ObjectType.BONUS && data.active && (
                <>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                        <ringGeometry args={[0.9, 1.15, 24]} />
                        <meshBasicMaterial color="#42C8BE" transparent opacity={0.75} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                        <circleGeometry args={[0.9, 24]} />
                        <meshBasicMaterial color="#42C8BE" transparent opacity={0.18} />
                    </mesh>
                </>
            )}

            {/* Gold bonus ground ring */}
            {data.type === ObjectType.GOLD_BONUS && data.active && (
                <>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                        <ringGeometry args={[0.9, 1.25, 24]} />
                        <meshBasicMaterial color="#ffd700" transparent opacity={0.9} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                        <circleGeometry args={[0.9, 24]} />
                        <meshBasicMaterial color="#ffaa00" transparent opacity={0.25} />
                    </mesh>
                    {/* Second outer ring for extra flair */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                        <ringGeometry args={[1.3, 1.45, 24]} />
                        <meshBasicMaterial color="#ffd700" transparent opacity={0.4} side={THREE.DoubleSide} />
                    </mesh>
                </>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                
                {/* --- TEL AVIV OBSTACLES --- */}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        {data.subType === 'double_parked' && (
                            <group position={[0, 0, 0]}>
                                {/* Body — color chosen at spawn time */}
                                <mesh position={[0, 0.22, 0]} scale={[1.6, 0.55, 3.0]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color={data.color || '#b0b8c1'} metalness={0.7} roughness={0.25} />
                                </mesh>
                                {/* Cabin / greenhouse */}
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
                                {/* Wheels — 4 corners */}
                                {([ [0.82, 1.1], [-0.82, 1.1], [0.82, -1.1], [-0.82, -1.1] ] as [number,number][]).map(([x, z], i) => (
                                    <mesh key={i} position={[x, 0.0, z]} rotation={[0, 0, Math.PI/2]}>
                                        <cylinderGeometry args={[0.22, 0.22, 0.18, 10]} />
                                        <meshStandardMaterial color="#111111" roughness={0.9} />
                                    </mesh>
                                ))}
                                {/* Hazard lights — amber, flashing handled by opacity pulse via clock */}
                                {([ [0.72, 1.52], [-0.72, 1.52], [0.72, -1.52], [-0.72, -1.52] ] as [number,number][]).map(([x, z], i) => (
                                    <mesh key={i} position={[x, 0.28, z]} scale={[0.22, 0.12, 0.06]}>
                                        <boxGeometry />
                                        <meshBasicMaterial color="#ffaa00" />
                                    </mesh>
                                ))}
                            </group>
                        )}

                        {data.subType === 'no_entry' && (
                            <group position={[0, 0, 0]}>
                                {/* Concrete base block */}
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

                                {/* Sign pushed +Z so the pole sits behind it */}
                                <group position={[0, 1.75, 0.32]}>
                                    {/* Back face — dark grey disc */}
                                    <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, -0.06]}>
                                        <cylinderGeometry args={[0.53, 0.53, 0.04, 28]} />
                                        <meshBasicMaterial color="#444444" />
                                    </mesh>
                                    {/* White border ring */}
                                    <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, -0.02]}>
                                        <cylinderGeometry args={[0.53, 0.53, 0.04, 28]} />
                                        <meshBasicMaterial color="#dddddd" />
                                    </mesh>
                                    {/* Red face disc */}
                                    <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.02]}>
                                        <cylinderGeometry args={[0.46, 0.46, 0.05, 28]} />
                                        <meshBasicMaterial color="#b50000" />
                                    </mesh>
                                    {/* White horizontal no-entry bar */}
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
                            </group>
                        )}

                        {data.subType === 'garbage_truck' && (
                            <group position={[0, 0.4, 0]}>
                                {/* Cabin — light grey */}
                                <mesh position={[0, 0.45, 1.6]} scale={[1.9, 1.4, 1.3]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color="#c0c0c0" roughness={0.5} metalness={0.2} />
                                </mesh>
                                {/* Cabin windshield strip */}
                                <mesh position={[0, 0.72, 2.27]} scale={[1.6, 0.5, 0.05]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color="#1a2a3a" metalness={0.8} roughness={0.1} />
                                </mesh>
                                {/* Body — municipal green */}
                                <mesh position={[0, 0.55, -0.5]} scale={[2.1, 1.7, 3.2]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color="#2d7a3a" roughness={0.5} metalness={0.2} />
                                </mesh>
                                {/* Compactor ridge on top of body */}
                                <mesh position={[0, 1.42, -0.5]} scale={[1.8, 0.18, 2.8]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color="#1f5a28" roughness={0.6} />
                                </mesh>
                                {/* Rear loading panel */}
                                <mesh position={[0, 0.55, 1.11]} scale={[2.1, 1.7, 0.1]}>
                                    <boxGeometry />
                                    <meshStandardMaterial color="#222222" roughness={0.8} />
                                </mesh>
                                {/* Warning stripe — yellow band on body */}
                                <mesh position={[0, 0.1, -0.5]} scale={[2.12, 0.18, 3.22]}>
                                    <boxGeometry />
                                    <meshBasicMaterial color="#f5c518" />
                                </mesh>
                                {/* Wheels — 4 large */}
                                {([ [1.1, 1.4], [-1.1, 1.4], [1.1, -1.2], [-1.1, -1.2] ] as [number,number][]).map(([x, z], i) => (
                                    <mesh key={i} position={[x, -0.35, z]} rotation={[0, 0, Math.PI/2]}>
                                        <cylinderGeometry args={[0.42, 0.42, 0.22, 10]} />
                                        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
                                    </mesh>
                                ))}
                                {/* Orange warning light on cabin roof */}
                                <mesh position={[0, 1.2, 1.6]}>
                                    <boxGeometry args={[0.3, 0.18, 0.3]} />
                                    <meshBasicMaterial color="#ff8800" />
                                </mesh>
                            </group>
                        )}
                    </group>
                )}

                {/* --- PARKING SPOT (COIN) --- */}
                {data.type === ObjectType.COIN && (
                    <group position={[0, 0.02, 0]}>
                        {/* Turquoise floor tint — no white borders */}
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[LANE_WIDTH - 0.2, 3.5]} />
                            <meshBasicMaterial color="#42C8BE" transparent opacity={0.25} />
                        </mesh>

                        {/* 3D Rotating Pumba icon above parking spot */}
                        <group ref={iconRef} position={[0, 1.8, 0]}>
                            {/* Front face */}
                            <mesh position={[0, 0, 0.05]}>
                                <planeGeometry args={[1.6, 1.6]} />
                                <meshBasicMaterial
                                    map={pumbaIconTexture}
                                    transparent
                                    alphaTest={0.1}
                                    side={THREE.FrontSide}
                                />
                            </mesh>
                            {/* Back face (mirror) */}
                            <mesh position={[0, 0, -0.05]} rotation={[0, Math.PI, 0]}>
                                <planeGeometry args={[1.6, 1.6]} />
                                <meshBasicMaterial
                                    map={pumbaIconTexture}
                                    transparent
                                    alphaTest={0.1}
                                    side={THREE.FrontSide}
                                />
                            </mesh>
                        </group>
                    </group>
                )}

                {/* --- WHITE BONUS PICKUP (x2 score) --- */}
                {data.type === ObjectType.BONUS && (
                    <group>
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
                    </group>
                )}

                {/* --- GOLD BONUS PICKUP (lane expansion) --- */}
                {data.type === ObjectType.GOLD_BONUS && (
                    <group>
                        {/* Gold backing disc to distinguish from white bonus */}
                        <mesh position={[0, 0, 0]}>
                            <circleGeometry args={[0.82, 20]} />
                            <meshBasicMaterial color="#ffd700" transparent opacity={0.55} side={THREE.DoubleSide} />
                        </mesh>
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
                    </group>
                )}

            </group>
        </group>
    );
});