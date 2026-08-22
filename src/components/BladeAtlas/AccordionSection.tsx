'use client';

import { ReactNode } from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface Props {
  title: string;
  step: number;
  selectedLabel?: string;
  children: ReactNode;
}

export function AccordionSection({ title, step, selectedLabel, children }: Props) {
  return (
    <AccordionItem
      className="border border-zinc-800/40 bg-[#0d0d0d] rounded-xl overflow-hidden data-open:border-[#8B0000]/20 transition-colors duration-300"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 text-zinc-200 hover:text-white group cursor-pointer">
        <div className="flex items-center gap-4 w-full">
          {/* Step number */}
          <span className="w-7 h-7 rounded-full border border-zinc-700 flex items-center justify-center text-[11px] font-mono text-zinc-500 group-aria-expanded:border-[#8B0000]/50 group-aria-expanded:text-[#8B0000] transition-colors shrink-0">
            {step}
          </span>

          <div className="flex flex-col items-start text-left gap-0.5 min-w-0 flex-1">
            <span className="text-sm font-light tracking-wide">{title}</span>
            {selectedLabel && (
              <span className="text-[11px] text-[#8B0000]/80 font-medium truncate max-w-full group-aria-expanded:opacity-0 transition-opacity duration-200">
                {selectedLabel}
              </span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pt-1 pb-6">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
