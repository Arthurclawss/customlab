'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { KnifeCategory } from '@/types/Knife';
import { useKnifeStore } from '@/store/useKnifeStore';
import { KnifeSelector } from './KnifeSelector';
import { ModelCarousel } from './ModelCarousel';
import { KnifeViewer } from './KnifeViewer';
import { ConfigurationPanel } from './ConfigurationPanel';

type LabStep = 'category' | 'model' | 'configure';

export function BladeAtlasLayout() {
  const { selectedKnife, clearAll } = useKnifeStore();
  const [selectedCategory, setSelectedCategory] = useState<KnifeCategory | null>(null);

  // Derive step from state
  const step: LabStep = !selectedCategory
    ? 'category'
    : !selectedKnife
      ? 'model'
      : 'configure';

  const goBackToCategories = () => {
    setSelectedCategory(null);
    clearAll();
  };

  const goBackToModels = () => {
    clearAll();
  };

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 overflow-hidden">
      <AnimatePresence mode="wait">
        {/* ─────────── STEP 1: Category ─────────── */}
        {step === 'category' && (
          <motion.div
            key="step-category"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen flex flex-col"
          >
            <LabHeader>
              <Link
                href="/"
                className="text-xs text-zinc-500 hover:text-white uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
              >
                <ChevronLeft /> Home
              </Link>
              <StepIndicator current={1} total={3} />
            </LabHeader>
            <div className="flex-1 flex items-center justify-center p-6">
              <KnifeSelector onSelect={setSelectedCategory} />
            </div>
          </motion.div>
        )}

        {/* ─────────── STEP 2: Model ─────────── */}
        {step === 'model' && (
          <motion.div
            key="step-model"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen flex flex-col"
          >
            <LabHeader>
              <button
                onClick={goBackToCategories}
                className="text-xs text-zinc-500 hover:text-white uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
              >
                <ChevronLeft /> Categorias
              </button>
              <StepIndicator current={2} total={3} />
            </LabHeader>
            <div className="flex-1 flex flex-col justify-center px-6">
              <div className="text-center mb-16">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-[#8B0000] text-xs uppercase tracking-[0.5em] mb-4 font-medium"
                >
                  {selectedCategory}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl md:text-5xl font-extralight text-zinc-100 tracking-tight"
                >
                  Escolha seu modelo base
                </motion.h1>
              </div>
              <ModelCarousel category={selectedCategory!} />
            </div>
          </motion.div>
        )}

        {/* ─────────── STEP 3: Configure ─────────── */}
        {step === 'configure' && (
          <motion.div
            key="step-configure"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="h-screen flex flex-col lg:flex-row overflow-hidden"
          >
            {/* Left — Viewer (60%) */}
            <div className="w-full lg:w-[60%] h-[40vh] lg:h-screen relative flex items-center justify-center bg-gradient-to-br from-[#080808] via-[#0d0d0d] to-[#080808]">
              <KnifeViewer />
            </div>

            {/* Right — Config Panel (40%) */}
            <div className="w-full lg:w-[40%] h-[60vh] lg:h-screen bg-[#0a0a0a] border-t lg:border-t-0 lg:border-l border-zinc-800/40 flex flex-col overflow-hidden">
              <ConfigurationPanel onBack={goBackToModels} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Small shared components ──

function LabHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 md:px-12 py-5 flex items-center justify-between border-b border-zinc-800/30 backdrop-blur-sm bg-[#080808]/80 sticky top-0 z-50">
      {children}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] rounded-full transition-all duration-500 ${
            i + 1 <= current ? 'w-8 bg-[#8B0000]' : 'w-4 bg-zinc-800'
          }`}
        />
      ))}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
