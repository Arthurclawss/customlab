'use client';

import { useLabStore } from '@/store/useLabStore';
import { Ruler, Scale, Flame, Sparkles, Diamond, Coins, X, Layers, CircleDot } from 'lucide-react';
import { STEEL_OPTIONS, HANDLE_MATERIAL_OPTIONS, FINISH_OPTIONS, EDGE_OPTIONS } from '@/lib/labConstants';

interface SpecPanelProps {
  onClose?: () => void;
}

export function SpecPanel({ onClose }: SpecPanelProps) {
  const { config, points } = useLabStore();

  const steel = STEEL_OPTIONS.find(s => s.id === config.steelType);
  const handle = HANDLE_MATERIAL_OPTIONS.find(h => h.id === config.handleMaterial);
  const finish = FINISH_OPTIONS.find(f => f.id === config.finishType);
  const edge = EDGE_OPTIONS.find(e => e.id === config.edgeType);

  const basePrice = 800;
  const estPrice = basePrice + (steel?.priceModifier || 0) + (handle?.priceModifier || 0) + (finish?.priceModifier || 0) + (edge?.priceModifier || 0);
  const estWeight = Math.round((config.bladeLength * config.bladeHeight * config.bladeThickness) * 0.4);
  const totalLength = config.bladeLength + config.handleLength;

  return (
    <aside className="w-[260px] h-full bg-[#0a0a0a] border-l border-[#1a1a1a] p-4 flex flex-col shrink-0 z-40">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <ScanLineIcon className="w-4 h-4 text-[#8B0000]" />
          Especificações
        </h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="lg:hidden p-1 text-gray-400 hover:text-white rounded-md hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto custom-scrollbar">
        
        {/* Dimensions */}
        <SpecSection title="Dimensões">
          <SpecRow icon={<Ruler />} label="Comp. Total" value={`${totalLength.toFixed(1)} cm`} />
          <SpecRow icon={<Ruler />} label="Lâmina" value={`${config.bladeLength.toFixed(1)} cm`} />
          <SpecRow icon={<Ruler />} label="Cabo" value={`${config.handleLength.toFixed(1)} cm`} />
          <SpecRow icon={<Ruler />} label="Altura Lâmina" value={`${config.bladeHeight.toFixed(1)} cm`} />
          <SpecRow icon={<Ruler />} label="Esp. Dorso" value={`${config.bladeThickness.toFixed(1)} mm`} />
          <SpecRow icon={<Ruler />} label="Esp. Cabo" value={`${config.handleThickness} mm`} />
        </SpecSection>

        {/* Physical */}
        <SpecSection title="Física">
          <SpecRow icon={<Scale />} label="Peso Estimado" value={`${estWeight} g`} />
          <SpecRow icon={<ShieldIcon />} label="Construção" value={config.isFullTang ? "Full Tang" : "Hidden Tang"} />
          <SpecRow icon={<CircleDot />} label="Pinos" value={`${config.pinCount}× ${config.pinMaterial === 'brass' ? 'Latão' : config.pinMaterial === 'stainless' ? 'Inox' : 'Mosaico'}`} />
        </SpecSection>

        {/* Structure */}
        <SpecSection title="Estrutura">
          <SpecTag label="Guarda" active={config.hasGuard} />
          <SpecTag label="Choil" active={config.hasFingerChoil} />
          <SpecTag label="Furo Fiel" active={config.hasLanyardHole} />
          <SpecTag label="Quebra-Crânio" active={config.hasSkullCrusher} />
        </SpecSection>

        {/* Materials */}
        <SpecSection title="Materiais">
          <SpecRow icon={<Flame />} label="Aço" value={steel?.name || "—"} />
          <SpecRow icon={<Sparkles />} label="Acabamento" value={finish?.name || "—"} />
          <SpecRow icon={<Diamond />} label="Cabo" value={handle?.name || "—"} />
          <SpecRow icon={<Layers />} label="Geometria" value={edge?.name || "—"} />
        </SpecSection>
      </div>
    </aside>
  );
}

function SpecSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      {children}
      <div className="h-px bg-[#1a1a1a]"></div>
    </div>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between group py-1.5 px-2 -mx-2 rounded-md hover:bg-[#121212] transition-colors border border-transparent hover:border-[#1a1a1a]">
      <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-200 transition-colors">
        <div className="w-3.5 h-3.5 opacity-60 text-[#8B0000]">{icon}</div>
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-bold text-white text-right max-w-[130px] truncate">{value}</span>
    </div>
  );
}

function SpecTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mr-1.5 mb-1 border ${
      active
        ? 'bg-[#8B0000]/20 border-[#8B0000]/40 text-[#ff6b6b]'
        : 'bg-[#111] border-[#222] text-gray-500'
    }`}>
      {active ? '✓ ' : ''}{label}
    </span>
  );
}

function ScanLineIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function ShieldIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
