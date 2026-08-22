// ═══════════════════════════════════════════════════════════════
// Custom Lab — Domain Types
// ═══════════════════════════════════════════════════════════════

// ── Control Points ──

export interface ControlPoint {
  id: string;
  x: number;
  y: number;
  group: PointGroup;
  locked: boolean;
  selected: boolean;
}

export type PointGroup =
  | 'spine'
  | 'edge'
  | 'tip'
  | 'ricasso'
  | 'choil'
  | 'handle-top'
  | 'handle-bottom'
  | 'guard'
  | 'pommel'
  | 'skull-crusher';

export const POINT_GROUP_LABELS: Record<PointGroup, string> = {
  'spine': 'Dorso',
  'edge': 'Fio',
  'tip': 'Ponta',
  'ricasso': 'Ricasso',
  'choil': 'Choil',
  'handle-top': 'Cabo (Cima)',
  'handle-bottom': 'Cabo (Baixo)',
  'guard': 'Guarda',
  'pommel': 'Pommel',
  'skull-crusher': 'Quebra-Crânio',
};

export const POINT_GROUP_COLORS: Record<PointGroup, string> = {
  'spine': '#f97316',
  'edge': '#ef4444',
  'tip': '#f43f5e',
  'ricasso': '#a855f7',
  'choil': '#d946ef',
  'handle-top': '#3b82f6',
  'handle-bottom': '#06b6d4',
  'guard': '#eab308',
  'pommel': '#22c55e',
  'skull-crusher': '#14b8a6',
};

// ── Tools ──

export type LabTool =
  | 'cursor'
  | 'move'
  | 'add-point'
  | 'delete-point'
  | 'smooth'
  | 'mirror'
  | 'symmetry';

export interface LabToolInfo {
  id: LabTool;
  label: string;
  shortcut: string;
  icon: string; // Lucide icon name
}

// ── Knife Specifications (real-time) ──

export interface KnifeSpecs {
  totalLength: number;      // mm
  bladeLength: number;      // mm
  handleLength: number;     // mm
  bladeHeight: number;      // mm
  thickness: number;        // mm
  bladeArea: number;        // mm²
  estimatedWeight: number;  // grams
  centerOfGravity: { x: number; y: number };
}

// ── Materials ──

export type SteelType =
  | 'damascus'
  | 'carbon-1095'
  | 'sandvik-14c28n'
  | 'vg10'
  | 'd2';

export type HandleMaterial =
  | 'jacaranda'
  | 'resin-hybrid'
  | 'micarta'
  | 'g10'
  | 'carbon-fiber'
  | 'brass'
  | 'titanium';

export type FinishType =
  | 'brut-de-forge'
  | 'acid-wash'
  | 'mirror-polish'
  | 'satin'
  | 'stonewash';

export type EdgeType =
  | 'flat-grind'
  | 'hollow-grind'
  | 'convex-grind'
  | 'scandi-grind';

export type GuardStyle =
  | 'bolster'
  | 'd-guard'
  | 'double-guard'
  | 's-guard';

export interface MaterialOption {
  id: string;
  name: string;
  color: string;        // Display color for canvas rendering
  priceModifier: number; // BRL
}

// ── Lab Configuration (sidebar state) ──

export interface LabConfig {
  // Structure
  hasSkullCrusher: boolean;
  hasGuard: boolean;
  hasFingerChoil: boolean;
  hasLanyardHole: boolean;
  isFullTang: boolean;

  // Blade
  bladeLength: number;      // cm
  bladeHeight: number;      // cm
  bladeThickness: number;   // mm
  bladeCurvature: number;   // 0-100
  steelType: SteelType;
  finishType: FinishType;
  edgeType: EdgeType;

  // Handle
  handleLength: number;     // cm
  handleThickness: number;  // mm
  handleMaterial: HandleMaterial;
  handleColor: string;
  pinCount: number;
  pinMaterial: string;

  // Guard (if hasGuard)
  guardMaterial: string;
  guardSize: number;
  guardStyle: GuardStyle;

  // Extras
  engraving: string;
  serialNumber: string;
  includeSheath: boolean;
  includeClip: boolean;
  
  // UI Display
  showAnnotations: boolean;
}

// ── Project ──

export interface LabProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  points: ControlPoint[];
  config: LabConfig;
}

// ── Analysis ──

export interface AnalysisCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface AnalysisResult {
  score: number;         // 0-100
  checks: AnalysisCheck[];
  suggestions: string[];
}

// ── Canvas State ──

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface HoveredPoint {
  id: string;
  screenX: number;
  screenY: number;
}
