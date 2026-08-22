'use client';

import { useKnives } from '@/hooks/useKnife';
import { useKnifeStore } from '@/store/useKnifeStore';
import { KnifeCategory } from '@/types/Knife';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  category: KnifeCategory;
}

export function ModelCarousel({ category }: Props) {
  const { knives, loading, error } = useKnives(category);
  const setSelectedKnife = useKnifeStore((s) => s.setSelectedKnife);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-zinc-600 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm tracking-widest uppercase">Carregando modelos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500/80 text-sm">Falha ao carregar modelos.</p>
      </div>
    );
  }

  if (knives.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-zinc-600 text-sm">Nenhum modelo encontrado para {category}.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-8 px-4 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {knives.map((knife, i) => (
          <motion.div
            key={knife.id}
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: i * 0.08,
              type: 'spring',
              stiffness: 100,
              damping: 18,
            }}
            whileHover={{
              y: -8,
              transition: { duration: 0.25 },
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedKnife(knife)}
            className="group w-[300px] md:w-[340px] shrink-0 snap-center bg-[#0e0e0e] border border-zinc-800/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-[#8B0000]/40 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
          >
            {/* Image area */}
            <div className="h-48 w-full bg-gradient-to-b from-zinc-900/50 to-transparent flex items-center justify-center relative overflow-hidden p-4">
              <img
                src={knife.image}
                alt={knife.name}
                className="w-full h-full object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  // Fallback for broken images
                  (e.target as HTMLImageElement).style.opacity = '0';
                }}
              />
              {/* Accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B0000]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Info */}
            <div className="p-5 space-y-3">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] mb-1">{knife.brand}</p>
                <h3 className="text-base font-medium text-zinc-200 group-hover:text-white transition-colors leading-tight">
                  {knife.name}
                </h3>
              </div>

              {/* Specs row */}
              <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                <span>{knife.blade.length}</span>
                <span className="text-zinc-800">·</span>
                <span>{knife.blade.steel}</span>
                <span className="text-zinc-800">·</span>
                <span>{knife.weight}</span>
              </div>

              {/* Price */}
              <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                <span className="text-xs text-zinc-600 uppercase tracking-widest">Base</span>
                <span className="text-lg font-light text-white">
                  R$ {knife.price.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
