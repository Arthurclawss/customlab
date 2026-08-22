// ═══════════════════════════════════════════════════════════════
// Iron Forge Custom Lab — Domain Types
// ═══════════════════════════════════════════════════════════════

export type KnifeCategory =
  | 'Chef'
  | 'Santoku'
  | 'Utility'
  | 'Paring'
  | 'Cleaver'
  | 'Bushcraft'
  | 'Hunting'
  | 'EDC';

// ── Sub-component types ──

export interface Blade {
  shape: string;
  length: string;
  thickness: string;
  steel: string;
  finish: string;
  grind: string;
}

export interface Handle {
  material: string;
  color: string;
  shape: string;
}

export interface Sheath {
  material: string;
}

export interface Pins {
  material: string;
}

export interface Engraving {
  text: string;
  font: string;
  position: string;
}

// ── Customization option (for selectable variants) ──

export interface CustomOption {
  id: string;
  name: string;
  priceModifier: number;
  description?: string;
}

// ── The main Knife model ──

export interface Knife {
  id: string;
  name: string;
  brand: string;
  category: KnifeCategory;
  image: string;         // Path like /knives/chef-01.png
  price: number;         // Base price in BRL
  description: string;
  weight: string;

  blade: Blade;
  handle: Handle;
  sheath: Sheath | null;

  availableSteels: CustomOption[];
  availableFinishes: CustomOption[];
  availableHandles: CustomOption[];
  availablePins: CustomOption[];
  availableSheaths: CustomOption[];
}

// ── Category card (for step 1) ──

export interface CategoryInfo {
  id: KnifeCategory;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
}

// ── Provider interface ──

export interface KnifeProvider {
  searchKnives(category?: string): Promise<Knife[]>;
  getKnife(id: string): Promise<Knife | null>;
  getKnifesByCategory(category: KnifeCategory): Promise<Knife[]>;
  getSpecifications(id: string): Promise<Record<string, string>>;
}

// ── Configuration state ──

export interface KnifeConfiguration {
  steel: CustomOption | null;
  finish: CustomOption | null;
  handle: CustomOption | null;
  pins: CustomOption | null;
  sheath: CustomOption | null;
  engraving: Engraving | null;
}
