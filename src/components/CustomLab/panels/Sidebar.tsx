import React, { useState } from 'react';
import { useLabStore } from '@/store/useLabStore';
import { LabSlider } from '../controls/LabSlider';
import { 
  LabSelect, 
  LabSelectTrigger, 
  LabSelectValue, 
  LabSelectContent, 
  LabSelectItem 
} from '../controls/LabSelect';
import { LabCheckbox } from '../controls/LabCheckbox';
import { 
  STEEL_OPTIONS, 
  HANDLE_MATERIAL_OPTIONS, 
  FINISH_OPTIONS, 
  EDGE_OPTIONS,
  GUARD_STYLE_OPTIONS 
} from '@/lib/labConstants';

import { X, Swords, Ruler, Palette, Wrench, Circle, Activity, Shield, Hammer, Droplets, Layers, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onClose?: () => void;
}

// Helper Components for Modular Structure
function ControlSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="bg-[#050505] rounded-xl border border-[#1a1a1a] shadow-sm flex flex-col overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#8B0000]" />
        </div>
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4 space-y-5">
        {children}
      </div>
    </section>
  );
}

function SidebarToggle({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between p-3.5 rounded-lg border border-[#222] bg-[#0d0d0d] hover:border-[#444] cursor-pointer transition-all group"
    >
      <div className="flex flex-col gap-1 pr-4">
        <label className="text-sm font-semibold text-gray-200 cursor-pointer pointer-events-none group-hover:text-white transition-colors">{label}</label>
        <span className="text-xs text-gray-500 pointer-events-none leading-snug">{description}</span>
      </div>
      <div className="shrink-0 pointer-events-none">
        <LabCheckbox id={id} checked={checked} />
      </div>
    </div>
  )
}

function SidebarSlider({ 
  label, value, min, max, step, unit, onChange 
}: { 
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        <span className="text-[11px] font-mono font-medium text-[#8B0000] bg-[#1a0505] px-2 py-0.5 rounded border border-[#3a1111]">
          {value}{unit}
        </span>
      </div>
      <LabSlider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(val) => onChange(val[0])}
      />
    </div>
  );
}

const TABS = [
  { id: 'structure', label: 'Estrutura', icon: Swords },
  { id: 'blade', label: 'Lâmina', icon: Activity },
  { id: 'handle', label: 'Cabo', icon: Circle },
  { id: 'materials', label: 'Materiais', icon: Palette },
];

export function Sidebar({ onClose }: SidebarProps) {
  const { config, updateConfig } = useLabStore();
  const [activeTab, setActiveTab] = useState('structure');

  return (
    <aside className="w-[360px] h-full bg-[#0a0a0a] border-r border-[#1a1a1a] shrink-0 z-40 flex">
      {/* Mini-Sidebar Navigation */}
      <div className="w-[64px] h-full bg-[#050505] border-r border-[#1a1a1a] flex flex-col items-center py-6 gap-6 shrink-0">
        <Wrench className="w-5 h-5 text-[#8B0000] mb-2" />
        
        <div className="flex flex-col gap-3 w-full px-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={cn(
                  "w-full aspect-square rounded-xl flex items-center justify-center transition-all group relative",
                  isActive ? "bg-[#8B0000] text-white shadow-lg shadow-red-900/20" : "text-gray-500 hover:bg-[#111] hover:text-gray-200"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute -left-2 w-1 h-8 bg-[#ff5c5c] rounded-r-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar flex flex-col relative">
        {/* Header */}
        <div className="p-5 border-b border-[#141414] flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Propriedades</h2>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-gray-500 hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-4">
          
          {/* ── Structure Section ── */}
          {activeTab === 'structure' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
              
              <ControlSection title="Interface / Visualização" icon={Eye}>
                <SidebarToggle
                  id="annotations"
                  label="Mostrar Anotações"
                  description="Exibe rótulos e marcações técnicas (como Dorso, Fio, Centro de Gravidade) ao redor da faca."
                  checked={config.showAnnotations}
                  onChange={(v) => updateConfig({ showAnnotations: v })}
                />
              </ControlSection>
              
              <ControlSection title="Anatomia da Lâmina" icon={Swords}>
                <SidebarToggle
                  id="fullTang"
                  label="Construção Full Tang"
                  description="A espiga de aço percorre toda a extensão do cabo, garantindo resistência máxima."
                  checked={config.isFullTang}
                  onChange={(v) => updateConfig({ isFullTang: v })}
                />
                <SidebarToggle
                  id="choil"
                  label="Côncavo de Dedo (Choil)"
                  description="Recuo na base da lâmina para acomodar o dedo indicador e dar controle preciso."
                  checked={config.hasFingerChoil}
                  onChange={(v) => updateConfig({ hasFingerChoil: v })}
                />
              </ControlSection>

              <ControlSection title="Proteção Frontal" icon={Shield}>
                <SidebarToggle
                  id="guard"
                  label="Guarda de Proteção"
                  description="Peça metálica divisória entre a lâmina e o cabo."
                  checked={config.hasGuard}
                  onChange={(v) => updateConfig({ hasGuard: v })}
                />
                
                {config.hasGuard && (
                  <div className="pt-2 border-t border-[#1a1a1a] mt-2 space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400">Estilo da Guarda</label>
                      <div className="grid grid-cols-2 gap-2">
                        {GUARD_STYLE_OPTIONS.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => updateConfig({ guardStyle: opt.id })}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              config.guardStyle === opt.id
                                ? "border-[#8B0000] bg-[#1a0505] shadow-sm shadow-red-900/10"
                                : "border-[#222] bg-[#0d0d0d] hover:border-[#444]"
                            )}
                          >
                            <span className={cn(
                              "text-xs font-semibold block mb-0.5",
                              config.guardStyle === opt.id ? "text-[#ff5c5c]" : "text-gray-300"
                            )}>
                              {opt.name}
                            </span>
                            <span className="text-[10px] text-gray-500 leading-tight block">
                              {opt.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <SidebarSlider
                      label="Tamanho da Guarda"
                      value={config.guardSize}
                      min={5} max={30} step={1}
                      unit="mm"
                      onChange={(v) => updateConfig({ guardSize: v })}
                    />
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400">Liga da Guarda</label>
                      <LabSelect value={config.guardMaterial} onValueChange={(val: any) => updateConfig({ guardMaterial: val })}>
                        <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                          <LabSelectValue placeholder="Material da Guarda" />
                        </LabSelectTrigger>
                        <LabSelectContent>
                          <LabSelectItem value="brass">Latão Dourado</LabSelectItem>
                          <LabSelectItem value="steel">Aço Inoxidável</LabSelectItem>
                          <LabSelectItem value="titanium">Titânio Fosco</LabSelectItem>
                          <LabSelectItem value="copper">Cobre Envelhecido</LabSelectItem>
                        </LabSelectContent>
                      </LabSelect>
                    </div>
                  </div>
                )}
              </ControlSection>

              <ControlSection title="Extremidade do Cabo" icon={Hammer}>
                <SidebarToggle
                  id="skull"
                  label="Quebra-Crânio (Pommel)"
                  description="Extensão pontiaguda agressiva na parte traseira (pommel)."
                  checked={config.hasSkullCrusher}
                  onChange={(v) => updateConfig({ hasSkullCrusher: v })}
                />
                <SidebarToggle
                  id="lanyard"
                  label="Furo para Fiel"
                  description="Orifício no fim do cabo para passar cordão ou fiel de segurança."
                  checked={config.hasLanyardHole}
                  onChange={(v) => updateConfig({ hasLanyardHole: v })}
                />
              </ControlSection>

            </div>
          )}

          {/* ── Blade Parameters ── */}
          {activeTab === 'blade' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
              
              <ControlSection title="Proporções Principais" icon={Ruler}>
                <SidebarSlider
                  label="Comprimento Útil"
                  value={config.bladeLength}
                  min={10} max={40} step={0.5}
                  unit="cm"
                  onChange={(v) => updateConfig({ bladeLength: v })}
                />
                <SidebarSlider
                  label="Altura (Calcanhar)"
                  value={config.bladeHeight}
                  min={1} max={10} step={0.1}
                  unit="cm"
                  onChange={(v) => updateConfig({ bladeHeight: v })}
                />
                <SidebarSlider
                  label="Espessura do Dorso"
                  value={config.bladeThickness}
                  min={1} max={10} step={0.5}
                  unit="mm"
                  onChange={(v) => updateConfig({ bladeThickness: v })}
                />
              </ControlSection>

              <ControlSection title="Geometria" icon={Layers}>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400">Tipo de Desbaste (Fio)</label>
                  <LabSelect value={config.edgeType} onValueChange={(val: any) => updateConfig({ edgeType: val })}>
                    <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                      <LabSelectValue placeholder="Selecione o Desbaste" />
                    </LabSelectTrigger>
                    <LabSelectContent>
                      {EDGE_OPTIONS.map(opt => (
                        <LabSelectItem key={opt.id} value={opt.id}>{opt.name}</LabSelectItem>
                      ))}
                    </LabSelectContent>
                  </LabSelect>
                  <p className="text-xs text-gray-500 mt-2">
                    Define o ângulo e o tipo de corte lateral (v-grind, scandi, hollow, etc).
                  </p>
                </div>
              </ControlSection>

            </div>
          )}

          {/* ── Handle Section ── */}
          {activeTab === 'handle' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
              
              <ControlSection title="Design e Material" icon={Circle}>
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-medium text-gray-400">Talas do Cabo</label>
                  <LabSelect value={config.handleMaterial} onValueChange={(val: any) => updateConfig({ handleMaterial: val })}>
                    <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                      <LabSelectValue placeholder="Material do Cabo" />
                    </LabSelectTrigger>
                    <LabSelectContent>
                      {HANDLE_MATERIAL_OPTIONS.map(opt => (
                        <LabSelectItem key={opt.id} value={opt.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full ring-1 ring-white/20 shadow-inner" style={{ backgroundColor: opt.color }}></span>
                            {opt.name}
                          </span>
                        </LabSelectItem>
                      ))}
                    </LabSelectContent>
                  </LabSelect>
                </div>

                <SidebarSlider
                  label="Comprimento do Cabo"
                  value={config.handleLength}
                  min={6} max={20} step={0.5}
                  unit="cm"
                  onChange={(v) => updateConfig({ handleLength: v })}
                />
                <SidebarSlider
                  label="Espessura das Talas"
                  value={config.handleThickness}
                  min={10} max={40} step={1}
                  unit="mm"
                  onChange={(v) => updateConfig({ handleThickness: v })}
                />
              </ControlSection>

              <ControlSection title="Elementos de Fixação" icon={Hammer}>
                <SidebarSlider
                  label="Quantidade de Pinos"
                  value={config.pinCount}
                  min={0} max={4} step={1}
                  unit=""
                  onChange={(v) => updateConfig({ pinCount: v })}
                />
                
                {config.pinCount > 0 && (
                  <div className="pt-2 border-t border-[#1a1a1a] mt-2 space-y-2">
                    <label className="text-xs font-medium text-gray-400">Liga dos Pinos</label>
                    <LabSelect value={config.pinMaterial} onValueChange={(val: any) => updateConfig({ pinMaterial: val })}>
                      <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                        <LabSelectValue placeholder="Material dos Pinos" />
                      </LabSelectTrigger>
                      <LabSelectContent>
                        <LabSelectItem value="brass">Latão Dourado</LabSelectItem>
                        <LabSelectItem value="stainless">Aço Inoxidável</LabSelectItem>
                        <LabSelectItem value="mosaic">Pinos Mosaico</LabSelectItem>
                      </LabSelectContent>
                    </LabSelect>
                  </div>
                )}
              </ControlSection>

            </div>
          )}

          {/* ── Materials & Finish Section ── */}
          {activeTab === 'materials' && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
              
              <ControlSection title="Forja e Liga" icon={Droplets}>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400">Liga Metálica Base</label>
                  <LabSelect value={config.steelType} onValueChange={(val: any) => updateConfig({ steelType: val })}>
                    <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                      <LabSelectValue placeholder="Selecione o Aço" />
                    </LabSelectTrigger>
                    <LabSelectContent>
                      {STEEL_OPTIONS.map(opt => (
                        <LabSelectItem key={opt.id} value={opt.id}>{opt.name}</LabSelectItem>
                      ))}
                    </LabSelectContent>
                  </LabSelect>
                  <p className="text-xs text-gray-500 mt-2">
                    Aços carbono oferecem mais retenção de fio, enquanto inoxidáveis facilitam a manutenção.
                  </p>
                </div>
              </ControlSection>

              <ControlSection title="Acabamento Final" icon={Palette}>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400">Tratamento de Superfície</label>
                  <LabSelect value={config.finishType} onValueChange={(val: any) => updateConfig({ finishType: val })}>
                    <LabSelectTrigger className="bg-[#0a0a0a] border-[#222]">
                      <LabSelectValue placeholder="Acabamento" />
                    </LabSelectTrigger>
                    <LabSelectContent>
                      {FINISH_OPTIONS.map(opt => (
                        <LabSelectItem key={opt.id} value={opt.id}>{opt.name}</LabSelectItem>
                      ))}
                    </LabSelectContent>
                  </LabSelect>
                  <p className="text-xs text-gray-500 mt-2">
                    O polimento ou tratamento químico afeta a resistência à oxidação e o reflexo.
                  </p>
                </div>
              </ControlSection>

            </div>
          )}

        </div>
      </div>
    </aside>
  );
}
