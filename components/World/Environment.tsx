

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

// Pill (rounded-rect) flat shape for the Dynamic Island in 3D
function makePillShape(w: number, h: number): THREE.Shape {
    const shape = new THREE.Shape();
    const r = h / 2;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.absarc(-w / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2, false);
    shape.closePath();
    return shape;
}
import { useStore } from '../../store';
import { LANE_WIDTH } from '../../types';

const CloudField: React.FC = () => {
  const speed = useStore(state => state.speed);
  const count = 100;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const getRandomX = () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      // Start clouds 20 units away from the center, and spread them over 60 units.
      return side * (20 + Math.random() * 60);
  };

  const particles = useMemo(() => {
      const temp = [];
      for (let i = 0; i < count; i++) {
        temp.push({
          x: getRandomX(),
          y: Math.random() * 50 + 10,
          z: -500 + Math.random() * 600,
          scale: 3 + Math.random() * 8, // Made clouds smaller
          speed: 0.5 + Math.random() * 2
        });
      }
      return temp;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const activeSpeed = speed > 0 ? speed : 2;

    particles.forEach((p, i) => {
        p.z += activeSpeed * delta;
        if (p.z > 50) {
            p.z = -550;
            p.x = getRandomX();
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
    </instancedMesh>
  );
};

const SideFlags: React.FC = () => {
    const speed = useStore(state => state.speed);
    const texture = useLoader(THREE.TextureLoader, '/logo_1.svg');
    texture.colorSpace = THREE.SRGBColorSpace;

    // Define Flag Geometry
    const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 12, 8), []);
    const poleBaseGeo = useMemo(() => new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16), []);
    const poleTopGeo = useMemo(() => new THREE.SphereGeometry(0.25, 16, 16), []);
    const flagGeo = useMemo(() => new THREE.PlaneGeometry(3.5, 2.5), []);

    // Create a set of flags
    const pairCount = 4; // How many pairs to keep in the scene
    const flagCount = pairCount * 2; 
    const spacing = 100; // Distance between flags on Z as requested
    const totalLength = pairCount * spacing; // Total loop length
    
    // State to store dynamic positions
    const [flags] = useState(() => {
        const arr = [];
        for (let i = 0; i < flagCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const pairIndex = Math.floor(i / 2);
            arr.push({
                x: side * 14, // 14 units away from center
                z: -50 - (pairIndex * spacing), // Start first pair at -50
                side: side,
                offset: Math.random() * 100 // For random wind phase
            });
        }
        return arr;
    });

    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        
        const activeSpeed = speed > 0 ? speed : 5;
        const time = state.clock.elapsedTime;

        // Move the entire group of flags logic manually since they are individual children
        groupRef.current.children.forEach((child, i) => {
            const flagData = flags[i];
            
            // Move Z
            flagData.z += activeSpeed * delta;
            
            // Loop back logic
            // If flag goes behind camera (z > 20), move it to the back of the queue
            if (flagData.z > 20) {
                flagData.z -= totalLength; 
            }

            child.position.set(flagData.x, 0, flagData.z);

            // Animate the Flag Mesh (child index 3 is the flag plane)
            const flagMesh = child.children[3];
            if (flagMesh) {
                // Wind effect: Rotate Y slightly based on time + offset
                // Base rotation is 0 (facing camera) + oscillation
                const wind = Math.sin(time * 3 + flagData.offset) * 0.15;
                flagMesh.rotation.y = wind;
            }
        });
    });

    return (
        <group ref={groupRef}>
            {flags.map((flag, i) => (
                <group key={i} position={[flag.x, 0, flag.z]}>
                    {/* Pole Base */}
                    <mesh geometry={poleBaseGeo} position={[0, 0.25, 0]}>
                        <meshStandardMaterial color="#333333" roughness={0.5} metalness={0.8} />
                    </mesh>
                    
                    {/* Pole */}
                    <mesh geometry={poleGeo} position={[0, 6, 0]}>
                        <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.9} />
                    </mesh>

                    {/* Pole Top (Gold Finial) */}
                    <mesh geometry={poleTopGeo} position={[0, 12, 0]}>
                         <meshStandardMaterial color="#FFD700" roughness={0.1} metalness={1.0} emissive="#DAA520" emissiveIntensity={0.2} />
                    </mesh>

                    {/* The Flag — white cloth with logo_1.svg overlay */}
                    <mesh 
                        geometry={flagGeo} 
                        position={[flag.side === 1 ? -1.75 : 1.75, 10.5, 0]} 
                        rotation={[0, 0, 0]}
                    >
                        <meshStandardMaterial 
                            color="#FFFFFF"
                            side={THREE.DoubleSide}
                            roughness={0.7}
                        />
                    </mesh>
                    {/* Logo on flag */}
                    <mesh
                        position={[flag.side === 1 ? -1.75 : 1.75, 10.5, 0.02]}
                        rotation={[0, 0, 0]}
                    >
                        <planeGeometry args={[3.2, 1.0]} />
                        <meshBasicMaterial
                            map={texture}
                            transparent
                            alphaTest={0.05}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

const LaneGuides: React.FC = () => {
    const { laneCount } = useStore();
    
    const separators = useMemo(() => {
        const lines: number[] = [];
        const startX = -(laneCount * LANE_WIDTH) / 2;
        
        for (let i = 0; i <= laneCount; i++) {
            lines.push(startX + (i * LANE_WIDTH));
        }
        return lines;
    }, [laneCount]);

    return (
        <group position={[0, 0.02, 0]}>
            {/* Lane Floor — semi-transparent dark asphalt so video road blends through */}
            <mesh position={[0, -0.02, -20]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[laneCount * LANE_WIDTH, 200]} />
                <meshBasicMaterial color="#111111" transparent opacity={0.45} />
            </mesh>

            {/* Lane Separators - Blue Lines */}
            {separators.map((x, i) => (
                <mesh key={`sep-${i}`} position={[x, 0, -20]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.05, 200]} /> 
                    <meshBasicMaterial 
                        color="#42C8BE" 
                        transparent 
                        opacity={0.6} 
                    />
                </mesh>
            ))}
        </group>
    );
};

const RetroSun: React.FC = () => {
    const texture = useLoader(THREE.TextureLoader, '/logo_2.svg');
    texture.colorSpace = THREE.SRGBColorSpace;

    // Pill dimensions (wide Dynamic Island style)
    const PW = 58, PH = 20; // main pill width/height
    const GW = 64, GH = 26; // outer glow pill
    const pillMain  = useMemo(() => makePillShape(PW, PH), []);
    const pillGlow  = useMemo(() => makePillShape(GW, GH), []);

    // Camera is at ~Z=8, looks toward Z=-30.
    // Place the island at Z=-88 so it sits at the road's vanishing horizon.
    // Y=13 places it in the sky clearly above the road surface.
    // depthWrite=false so near objects (obstacles, flags) correctly occlude it.
    return (
        <group position={[0, 32, -88]}>
            {/* Outer turquoise glow pill — very subtle */}
            <mesh renderOrder={-3}>
                <shapeGeometry args={[pillGlow]} />
                <meshBasicMaterial
                    color="#42C8BE"
                    transparent
                    opacity={0.07}
                    depthWrite={false}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>

            {/* Black pill body — semi-transparent so video shows through */}
            <mesh renderOrder={-2}>
                <shapeGeometry args={[pillMain]} />
                <meshBasicMaterial
                    color="#000000"
                    transparent
                    opacity={0.55}
                    depthWrite={false}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>

            {/* Turquoise border — very faint */}
            <mesh renderOrder={-1} position={[0, 0, 0.05]}>
                <shapeGeometry args={[makePillShape(PW + 1.2, PH + 1.2)]} />
                <meshBasicMaterial
                    color="#42C8BE"
                    transparent
                    opacity={0.22}
                    depthWrite={false}
                    fog={false}
                    toneMapped={false}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* logo_2.svg — 714:226 ≈ 3.16:1, reduced opacity */}
            <mesh renderOrder={0} position={[0, 0, 0.1]}>
                <planeGeometry args={[PW - 10, (PW - 10) / 3.16]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    opacity={0.6}
                    depthWrite={false}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
};

// MovingGrid removed — video background provides the world atmosphere.

export const Environment: React.FC = () => {
  return (
    <>
      {/* No fog — video background is the sky/atmosphere */}

      <ambientLight intensity={1.2} color="#ffffff" />
      <directionalLight position={[0, 50, -20]} intensity={1.0} color="#fff8e8" />

      {/* No CloudField, no MovingGrid — video background provides the world */}
      <LaneGuides />
    </>
  );
};