'use client';

import { useKnifeStore } from '@/store/useKnifeStore';
import { motion, AnimatePresence } from 'motion/react';

/**
 * KnifeViewer — Left panel visualization.
 *
 * ARCHITECTURE NOTE:
 * This component is the ONLY thing that needs to change
 * when migrating from 2D images to 3D (.glb / React Three Fiber).
 * All state, configuration, and pricing logic lives in the Zustand store
 * and is completely decoupled from this viewer.
 *
 * Future migration:
 *   1. Install @react-three/fiber and @react-three/drei
 *   2. Replace the <img> tag below with a <Canvas> containing your .glb model
 *   3. Map config options from useKnifeStore to material/mesh changes on the model
 */
export function KnifeViewer() {
  const { selectedKnife, config } = useKnifeStore();

  if (!selectedKnife) return null;

  // Unique key for AnimatePresence — triggers transition on any config change
  const configKey = [
    selectedKnife.id,
    config.steel?.id,
    config.finish?.id,
    config.handle?.id,
    config.pins?.id,
    config.sheath?.id,
  ].join('-');

  return (
    <div className="w-full h-full relative flex items-center justify-center p-8 md:p-16">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#8B0000]/[0.04] rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#080808_85%)]" />
      </div>

      {/* Knife visualization */}
      <AnimatePresence mode="wait">
        <motion.div
          key={configKey}
          initial={{ opacity: 0, scale: 0.92, rotateY: -8 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          className="relative z-10 w-full max-w-2xl aspect-[16/7] flex items-center justify-center"
          style={{ perspective: '1200px' }}
        >
          {/* Large knife name as visual backdrop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <span className="text-[8vw] lg:text-[6vw] font-black uppercase tracking-tighter text-zinc-800/[0.06] whitespace-nowrap -rotate-6">
              {selectedKnife.name}
            </span>
          </div>

          {/* Actual knife image — will be replaced by 3D Canvas in the future */}
          <img
            src={selectedKnife.image}
            alt={selectedKnife.name}
            className="w-full h-auto object-contain max-h-[85%] drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)] relative z-10"
            onError={(e) => {
              // Hide broken image, the text backdrop remains visible
              (e.target as HTMLImageElement).style.opacity = '0';
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Bottom-left info */}
      <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 z-20">
        <p className="text-[10px] text-zinc-700 uppercase tracking-[0.5em] font-mono">
          Iron Forge Custom Lab
        </p>
      </div>

      {/* Bottom-right spec badge */}
      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 z-20">
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
          <span>{selectedKnife.blade.steel}</span>
          <span className="text-zinc-800">|</span>
          <span>{selectedKnife.blade.length}</span>
          <span className="text-zinc-800">|</span>
          <span>{selectedKnife.weight}</span>
        </div>
      </div>
    </div>
  );
}
