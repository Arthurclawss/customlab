'use client';

import { useKnifeStore } from '@/store/useKnifeStore';
import { motion } from 'motion/react';

export function PriceSummary() {
  const { selectedKnife, totalPrice, config } = useKnifeStore();
  if (!selectedKnife) return null;

  const extras = totalPrice - selectedKnife.price;

  return (
    <div className="p-5 md:p-6 flex items-end justify-between gap-4">
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.4em]">
          Total estimado
        </p>
        <div className="flex items-baseline gap-2">
          <motion.span
            key={totalPrice}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-light text-white tabular-nums"
          >
            R$ {totalPrice.toLocaleString('pt-BR')}
          </motion.span>
          {extras > 0 && (
            <span className="text-xs text-[#8B0000] font-mono">
              +R${extras.toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      <button className="bg-[#8B0000] hover:bg-[#6d0000] text-white px-6 py-3 md:px-8 md:py-3.5 text-sm font-medium tracking-widest uppercase transition-colors duration-200 cursor-pointer">
        Finalizar
      </button>
    </div>
  );
}
