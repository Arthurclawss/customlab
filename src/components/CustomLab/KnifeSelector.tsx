'use client';

import { motion } from 'motion/react';
import { KnifeCategory, CategoryInfo } from '@/types/Knife';
import { ChefHat, Flame, Scissors, Hammer, Trees, Target, PocketKnife } from 'lucide-react';

const CATEGORIES: CategoryInfo[] = [
  { id: 'Chef',      name: 'Chef',      description: 'Multi-purpose kitchen blade',     icon: 'chef' },
  { id: 'Santoku',   name: 'Santoku',   description: 'Japanese precision cutting',      icon: 'santoku' },
  { id: 'Utility',   name: 'Utility',   description: 'Everyday versatile tasks',        icon: 'utility' },
  { id: 'Paring',    name: 'Paring',    description: 'Detailed peeling & trimming',     icon: 'paring' },
  { id: 'Cleaver',   name: 'Cleaver',   description: 'Heavy duty chopping power',       icon: 'cleaver' },
  { id: 'Bushcraft', name: 'Bushcraft', description: 'Wilderness survival & camp',      icon: 'bushcraft' },
  { id: 'Hunting',   name: 'Hunting',   description: 'Field dressing & outdoor',        icon: 'hunting' },
  { id: 'EDC',       name: 'EDC',       description: 'Everyday carry folding knives',   icon: 'edc' },
];

function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const props = { className: className ?? 'w-7 h-7', strokeWidth: 1.5 };
  switch (icon) {
    case 'chef':      return <ChefHat {...props} />;
    case 'santoku':   return <Flame {...props} />;
    case 'utility':   return <Scissors {...props} />;
    case 'paring':    return <Scissors {...props} />;
    case 'cleaver':   return <Hammer {...props} />;
    case 'bushcraft': return <Trees {...props} />;
    case 'hunting':   return <Target {...props} />;
    case 'edc':       return <PocketKnife {...props} />;
    default:          return null;
  }
}

interface Props {
  onSelect: (category: KnifeCategory) => void;
}

export function KnifeSelector({ onSelect }: Props) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-20">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xs text-zinc-500 uppercase tracking-[0.6em] mb-6"
        >
          Iron Forge Custom Lab
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-6xl font-extralight tracking-tight mb-6"
        >
          Monte Sua Faca
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-zinc-500 text-base max-w-lg mx-auto leading-relaxed"
        >
          Selecione o tipo de lâmina para começar sua personalização.
        </motion.p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {CATEGORIES.map((cat, i) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(cat.id)}
            className="group relative bg-[#111111] border border-zinc-800/60 rounded-2xl p-6 md:p-8 text-left cursor-pointer transition-all duration-300 hover:border-[#8B0000]/50 hover:bg-[#111111] hover:shadow-[0_20px_60px_-15px_rgba(139,0,0,0.15)]"
          >
            {/* Icon */}
            <div className="mb-6 text-zinc-600 group-hover:text-[#8B0000] transition-colors duration-300">
              <CategoryIcon icon={cat.icon} />
            </div>

            {/* Name */}
            <h3 className="text-lg font-medium text-zinc-200 mb-1 group-hover:text-white transition-colors">
              {cat.name}
            </h3>

            {/* Description */}
            <p className="text-xs text-zinc-600 leading-relaxed">
              {cat.description}
            </p>

            {/* Corner accent */}
            <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-zinc-800 group-hover:bg-[#8B0000] transition-colors duration-300" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
