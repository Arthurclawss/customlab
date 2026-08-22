'use client';

import { useKnifeStore } from '@/store/useKnifeStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion } from '@/components/ui/accordion';
import { AccordionSection } from './AccordionSection';
import { OptionGrid } from './OptionGrid';
import { PriceSummary } from './PriceSummary';
import { useState } from 'react';

interface Props {
  onBack: () => void;
}

export function ConfigurationPanel({ onBack }: Props) {
  const {
    selectedKnife,
    config,
    setSteel,
    setFinish,
    setHandle,
    setPins,
    setSheath,
    setEngraving,
  } = useKnifeStore();

  const [engravingText, setEngravingText] = useState('');
  const [engravingFont, setEngravingFont] = useState('serif');
  const [engravingPosition, setEngravingPosition] = useState('blade');

  if (!selectedKnife) return null;

  const handleEngravingChange = (text: string) => {
    setEngravingText(text);
    if (text.trim()) {
      setEngraving({ text: text.trim(), font: engravingFont, position: engravingPosition });
    } else {
      setEngraving(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#090909]">
      {/* Header */}
      <div className="p-5 md:p-6 border-b border-zinc-800/30">
        <button
          onClick={onBack}
          className="text-[10px] text-zinc-600 hover:text-zinc-300 uppercase tracking-[0.3em] mb-3 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Trocar modelo
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] mb-1">{selectedKnife.brand}</p>
            <h2 className="text-xl font-light text-white tracking-tight">{selectedKnife.name}</h2>
          </div>
        </div>
      </div>

      {/* Scrollable options */}
      <ScrollArea className="flex-1">
        <div className="p-5 md:p-6">
          <Accordion defaultValue={[0]} className="space-y-3">

            {/* 1. Steel */}
            <AccordionSection
              title="Tipo de Aço"
              step={1}
              selectedLabel={config.steel?.name}
            >
              <OptionGrid
                options={selectedKnife.availableSteels}
                selected={config.steel}
                onSelect={setSteel}
              />
            </AccordionSection>

            {/* 2. Finish */}
            <AccordionSection
              title="Acabamento"
              step={2}
              selectedLabel={config.finish?.name}
            >
              <OptionGrid
                options={selectedKnife.availableFinishes}
                selected={config.finish}
                onSelect={setFinish}
              />
            </AccordionSection>

            {/* 3. Handle */}
            <AccordionSection
              title="Empunhadura"
              step={3}
              selectedLabel={config.handle?.name}
            >
              <OptionGrid
                options={selectedKnife.availableHandles}
                selected={config.handle}
                onSelect={setHandle}
              />
            </AccordionSection>

            {/* 4. Pins */}
            <AccordionSection
              title="Pinos"
              step={4}
              selectedLabel={config.pins?.name}
            >
              <OptionGrid
                options={selectedKnife.availablePins}
                selected={config.pins}
                onSelect={setPins}
                columns={2}
              />
            </AccordionSection>

            {/* 5. Sheath */}
            <AccordionSection
              title="Bainha"
              step={5}
              selectedLabel={config.sheath?.name}
            >
              <OptionGrid
                options={selectedKnife.availableSheaths}
                selected={config.sheath}
                onSelect={setSheath}
              />
            </AccordionSection>

            {/* 6. Engraving */}
            <AccordionSection
              title="Gravação Pessoal"
              step={6}
              selectedLabel={engravingText ? `"${engravingText}"` : undefined}
            >
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">Adicione um toque pessoal à sua lâmina.</p>

                {/* Text */}
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Texto</label>
                  <input
                    type="text"
                    value={engravingText}
                    onChange={(e) => handleEngravingChange(e.target.value)}
                    placeholder="Ex: J. Silva"
                    maxLength={20}
                    className="w-full bg-[#111111] border border-zinc-800/50 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-[#8B0000]/50 transition-colors"
                  />
                </div>

                {/* Font */}
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Fonte</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['serif', 'sans-serif', 'script'] as const).map((font) => (
                      <button
                        key={font}
                        onClick={() => {
                          setEngravingFont(font);
                          if (engravingText.trim()) {
                            setEngraving({ text: engravingText.trim(), font, position: engravingPosition });
                          }
                        }}
                        className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                          engravingFont === font
                            ? 'border-[#8B0000] bg-[#8B0000]/10 text-white'
                            : 'border-zinc-800/50 bg-[#111111] text-zinc-500 hover:border-zinc-600'
                        }`}
                        style={{ fontFamily: font === 'script' ? 'cursive' : font }}
                      >
                        {font === 'serif' ? 'Serif' : font === 'sans-serif' ? 'Sans' : 'Script'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Posição</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['blade', 'handle', 'bolster'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => {
                          setEngravingPosition(pos);
                          if (engravingText.trim()) {
                            setEngraving({ text: engravingText.trim(), font: engravingFont, position: pos });
                          }
                        }}
                        className={`p-3 rounded-lg border text-xs capitalize transition-all cursor-pointer ${
                          engravingPosition === pos
                            ? 'border-[#8B0000] bg-[#8B0000]/10 text-white'
                            : 'border-zinc-800/50 bg-[#111111] text-zinc-500 hover:border-zinc-600'
                        }`}
                      >
                        {pos === 'blade' ? 'Lâmina' : pos === 'handle' ? 'Cabo' : 'Bolster'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionSection>

          </Accordion>
        </div>
      </ScrollArea>

      {/* Footer — Price */}
      <div className="border-t border-zinc-800/30 bg-[#080808]">
        <PriceSummary />
      </div>
    </div>
  );
}
