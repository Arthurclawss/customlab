'use client';

import { CustomOption } from '@/types/Knife';
import { motion } from 'motion/react';

interface Props {
  options: CustomOption[];
  selected: CustomOption | null;
  onSelect: (option: CustomOption) => void;
  columns?: 1 | 2;
}

export function OptionGrid({ options, selected, onSelect, columns = 1 }: Props) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((opt) => {
        const isSelected = selected?.id === opt.id;
        return (
          <motion.button
            key={opt.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(opt)}
            className={`p-4 text-left rounded-lg border transition-all duration-200 cursor-pointer ${
              isSelected
                ? 'border-[#8B0000] bg-[#8B0000]/10 text-white shadow-[0_0_20px_rgba(139,0,0,0.1)]'
                : 'border-zinc-800/50 bg-[#111111] text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Selection dot */}
                <div className={`w-2.5 h-2.5 rounded-full border transition-all ${
                  isSelected
                    ? 'border-[#8B0000] bg-[#8B0000]'
                    : 'border-zinc-700 bg-transparent'
                }`} />
                <span className="text-sm">{opt.name}</span>
              </div>
              {opt.priceModifier > 0 && (
                <span className={`text-xs font-mono ${isSelected ? 'text-[#8B0000]' : 'text-zinc-600'}`}>
                  +R${opt.priceModifier}
                </span>
              )}
              {opt.priceModifier === 0 && (
                <span className="text-xs text-zinc-700 font-mono">Incluso</span>
              )}
            </div>
            {opt.description && (
              <p className="text-[11px] text-zinc-600 mt-1 ml-[22px]">{opt.description}</p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
