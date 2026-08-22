// ═══════════════════════════════════════════════════════════════
// Custom Lab — Constants & Defaults
// ═══════════════════════════════════════════════════════════════

import type { LabConfig, LabToolInfo, MaterialOption, GuardStyle } from '@/types/Lab';

// ── Colors ──

export const LAB_COLORS = {
  bg:           '#050505',
  bgPanel:      '#0a0a0a',
  bgSurface:    '#0e0e0e',
  bgHover:      '#141414',
  border:       '#1a1a1a',
  borderHover:  '#2a2a2a',
  borderActive: '#8B0000',
  accent:       '#8B0000',
  accentLight:  '#ff5c5c',
  accentGlow:   'rgba(139, 0, 0, 0.3)',
  text:         '#e0e0e0',
  textMuted:    '#666666',
  textDim:      '#444444',
  gridLine:     'rgba(255, 255, 255, 0.03)',
  gridLineMajor:'rgba(255, 255, 255, 0.06)',
  point:        '#8B0000',
  pointHover:   '#ff5c5c',
  pointSelected:'#ffffff',
  pointLocked:  '#444444',
  curveFill:    'rgba(139, 0, 0, 0.04)',
  curveStroke:  'rgba(255, 255, 255, 0.6)',
  curveEdit:    'rgba(139, 0, 0, 0.15)',
  connectionLine: 'rgba(255, 92, 92, 0.2)',
} as const;

// ── Dimensions ──

export const LAB_DIMENSIONS = {
  navbarHeight:    48,
  sidebarWidth:    280,
  specPanelWidth:  260,
  toolbarHeight:   44,
  pointRadius:     5,
  pointHitRadius:  12,
  pointGlowRadius: 16,
  gridSpacing:     20,
  gridMajorEvery:  5,
} as const;

// ── Tools ──

export const LAB_TOOLS: LabToolInfo[] = [
  { id: 'cursor',       label: 'Cursor',       shortcut: 'V', icon: 'MousePointer2' },
  { id: 'move',         label: 'Mover Ponto',  shortcut: 'G', icon: 'Move' },
  { id: 'add-point',    label: 'Adicionar Ponto', shortcut: 'A', icon: 'Plus' },
  { id: 'delete-point', label: 'Deletar Ponto', shortcut: 'X', icon: 'Minus' },
  { id: 'smooth',       label: 'Suavizar Curva', shortcut: 'S', icon: 'Spline' },
  { id: 'mirror',       label: 'Espelhar',       shortcut: 'M', icon: 'FlipHorizontal' },
  { id: 'symmetry',     label: 'Simetria',     shortcut: 'Y', icon: 'Symmetry' },
];

// ── Default Lab Configuration ──

export const DEFAULT_LAB_CONFIG: LabConfig = {
  hasSkullCrusher: false,
  hasGuard: true,
  hasFingerChoil: false,
  hasLanyardHole: false,
  isFullTang: true,

  bladeLength: 15,
  bladeHeight: 4,
  bladeThickness: 4,
  bladeCurvature: 50,
  steelType: 'carbon-1095',
  finishType: 'satin',
  edgeType: 'flat-grind',

  handleLength: 12,
  handleThickness: 22,
  handleMaterial: 'micarta',
  handleColor: '#3d2b1f',
  pinCount: 2,
  pinMaterial: 'brass',

  // Guard
  guardMaterial: 'brass',
  guardSize: 12,
  guardStyle: 'bolster',

  // Extras
  engraving: '',
  serialNumber: '',
  includeSheath: false,
  includeClip: false,
  
  // UI Display
  showAnnotations: true,
};

// ── Material Options ──

export const STEEL_OPTIONS: MaterialOption[] = [
  { id: 'damascus',       name: 'Aço Damasco Premium',     color: '#8a8a8a', priceModifier: 350 },
  { id: 'carbon-1095',    name: 'Aço Carbono 1095',        color: '#6b6b6b', priceModifier: 0 },
  { id: 'sandvik-14c28n', name: 'Sandvik 14C28N',          color: '#9a9a9a', priceModifier: 180 },
  { id: 'vg10',           name: 'VG-10',                   color: '#7d7d7d', priceModifier: 220 },
  { id: 'd2',             name: 'Aço D2 Tool Steel',       color: '#757575', priceModifier: 150 },
];

export const HANDLE_MATERIAL_OPTIONS: MaterialOption[] = [
  { id: 'jacaranda',     name: 'Jacarandá da Bahia',       color: '#3d2b1f', priceModifier: 120 },
  { id: 'resin-hybrid',  name: 'Resina Híbrida',           color: '#2a4a6b', priceModifier: 200 },
  { id: 'micarta',       name: 'Micarta Celeron',          color: '#4a3728', priceModifier: 0 },
  { id: 'g10',           name: 'G10',                      color: '#2d2d2d', priceModifier: 80 },
  { id: 'carbon-fiber',  name: 'Fibra de Carbono',         color: '#1a1a1a', priceModifier: 280 },
  { id: 'brass',         name: 'Latão',                    color: '#b5a642', priceModifier: 160 },
  { id: 'titanium',      name: 'Titânio',                  color: '#8a9a9a', priceModifier: 400 },
];

export const FINISH_OPTIONS: MaterialOption[] = [
  { id: 'brut-de-forge', name: 'Brut de Forge',            color: '#555555', priceModifier: 80 },
  { id: 'acid-wash',     name: 'Acid Wash',                color: '#4a4a4a', priceModifier: 60 },
  { id: 'mirror-polish', name: 'Polimento Espelhado',      color: '#cccccc', priceModifier: 200 },
  { id: 'satin',         name: 'Cetim',                    color: '#aaaaaa', priceModifier: 0 },
  { id: 'stonewash',     name: 'Stonewash',                color: '#6a6a6a', priceModifier: 40 },
];

export const EDGE_OPTIONS: MaterialOption[] = [
  { id: 'flat-grind',    name: 'Flat Grind',               color: '#888888', priceModifier: 0 },
  { id: 'hollow-grind',  name: 'Hollow Grind',             color: '#888888', priceModifier: 50 },
  { id: 'convex-grind',  name: 'Convex Grind',             color: '#888888', priceModifier: 80 },
  { id: 'scandi-grind',  name: 'Scandi Grind',             color: '#888888', priceModifier: 30 },
];

export interface GuardStyleOption {
  id: GuardStyle;
  name: string;
  description: string;
  priceModifier: number;
}

export const GUARD_STYLE_OPTIONS: GuardStyleOption[] = [
  { id: 'bolster',      name: 'Bolster Clássico',       description: 'Retangular arredondado, estilo clássico.',                    priceModifier: 0 },
  // STANDBY: Options available in the code but hidden from the UI for now
  // { id: 'd-guard',      name: 'Guarda D (D-Guard)',     description: 'Barra curvada em D envolvendo o cabo, proteção total.',       priceModifier: 180 },
  // { id: 'double-guard', name: 'Guarda Dupla (Quillon)', description: 'Cruz com quillons curvados para cima e baixo, estilo Bowie.', priceModifier: 80 },
  // { id: 's-guard',      name: 'Guarda em S',            description: 'Lâminas curvas elegantes com pontas afiadas, estilo clássico.', priceModifier: 100 },
];
