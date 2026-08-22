'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Center } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing';
import { Suspense } from 'react';
import { useLabStore } from '@/store/useLabStore';
import { ThreeKnife } from './ThreeKnife';

export function ThreeViewer() {
  const { config, points } = useLabStore();

  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #1E1E1E 0%, #121212 100%)'
      }}
    >
      <Canvas 
        shadows 
        camera={{ position: [0, 2, 25], fov: 35 }} 
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping, 
          toneMappingExposure: 1.0,
          preserveDrawingBuffer: true
        }}
      >
        <Suspense fallback={null}>
          {/* Environment maps for realistic PBR reflections. 'studio' preset matches product photography. */}
          <Environment preset="studio" environmentIntensity={0.6} />
          
          {/* Studio Lighting Setup */}
          <ambientLight intensity={0.05} />
          
          {/* Key Light: Softbox front-left */}
          <spotLight 
            position={[-10, 10, 10]} 
            angle={0.8} 
            penumbra={1} 
            intensity={1.2} 
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
            color="#ffffff"
          />
          
          {/* Fill Light: Low intensity right side */}
          <spotLight 
            position={[10, 2, 8]} 
            angle={0.6} 
            penumbra={1} 
            intensity={0.5} 
            color="#ffffff"
          />
          
          {/* Rim Light: Behind the knife to highlight silhouette */}
          <spotLight 
            position={[0, 0, -15]} 
            angle={0.8} 
            penumbra={1} 
            intensity={1.0} 
            color="#ffffff"
          />
          
          {/* Top Light: Enhances blade geometry */}
          <spotLight 
            position={[0, 15, 0]} 
            angle={0.6} 
            penumbra={1} 
            intensity={0.6} 
            color="#ffffff"
          />

          {/* Group and Center the knife model */}
          <Center top position={[0, -2, 0]}>
            <ThreeKnife config={config} points={points} />
          </Center>

          {/* Invisible shadow catcher floor */}
          <mesh 
            receiveShadow 
            position={[0, -2.05, 0]} 
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[100, 100]} />
            <shadowMaterial transparent opacity={0.25} />
          </mesh>

          {/* Controls to rotate, pan and zoom */}
          <OrbitControls 
            makeDefault
            minDistance={10}
            maxDistance={50}
            enablePan={false}
            autoRotate={false}
            maxPolarAngle={Math.PI / 2 + 0.1} // Prevent going too far below floor
            minPolarAngle={Math.PI / 4}
          />
          
          {/* Post Processing for AAA realism */}
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={1.5} intensity={1.0} halfRes={true} color="#000000" />
            <Bloom luminanceThreshold={1.5} mipmapBlur intensity={0.2} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
