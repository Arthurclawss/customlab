import { create } from 'zustand';
import { Knife, CustomOption, Engraving, KnifeConfiguration } from '@/types/Knife';

// ═══════════════════════════════════════════════════════════════
// Iron Forge Custom Lab — Global State (Zustand)
// ═══════════════════════════════════════════════════════════════

interface KnifeLabState {
  // Selected base knife
  selectedKnife: Knife | null;

  // Configuration
  config: KnifeConfiguration;

  // Computed
  totalPrice: number;

  // Actions
  setSelectedKnife: (knife: Knife) => void;
  setSteel: (option: CustomOption | null) => void;
  setFinish: (option: CustomOption | null) => void;
  setHandle: (option: CustomOption | null) => void;
  setPins: (option: CustomOption | null) => void;
  setSheath: (option: CustomOption | null) => void;
  setEngraving: (engraving: Engraving | null) => void;
  resetConfig: () => void;
  clearAll: () => void;
}

const emptyConfig: KnifeConfiguration = {
  steel: null,
  finish: null,
  handle: null,
  pins: null,
  sheath: null,
  engraving: null,
};

function computePrice(base: number, config: KnifeConfiguration): number {
  let total = base;
  if (config.steel) total += config.steel.priceModifier;
  if (config.finish) total += config.finish.priceModifier;
  if (config.handle) total += config.handle.priceModifier;
  if (config.pins) total += config.pins.priceModifier;
  if (config.sheath) total += config.sheath.priceModifier;
  return total;
}

export const useKnifeStore = create<KnifeLabState>((set) => ({
  selectedKnife: null,
  config: { ...emptyConfig },
  totalPrice: 0,

  setSelectedKnife: (knife) =>
    set({
      selectedKnife: knife,
      config: { ...emptyConfig },
      totalPrice: knife.price,
    }),

  setSteel: (option) =>
    set((s) => {
      const next = { ...s.config, steel: option };
      return { config: next, totalPrice: computePrice(s.selectedKnife?.price ?? 0, next) };
    }),

  setFinish: (option) =>
    set((s) => {
      const next = { ...s.config, finish: option };
      return { config: next, totalPrice: computePrice(s.selectedKnife?.price ?? 0, next) };
    }),

  setHandle: (option) =>
    set((s) => {
      const next = { ...s.config, handle: option };
      return { config: next, totalPrice: computePrice(s.selectedKnife?.price ?? 0, next) };
    }),

  setPins: (option) =>
    set((s) => {
      const next = { ...s.config, pins: option };
      return { config: next, totalPrice: computePrice(s.selectedKnife?.price ?? 0, next) };
    }),

  setSheath: (option) =>
    set((s) => {
      const next = { ...s.config, sheath: option };
      return { config: next, totalPrice: computePrice(s.selectedKnife?.price ?? 0, next) };
    }),

  setEngraving: (engraving) =>
    set((s) => ({ config: { ...s.config, engraving } })),

  resetConfig: () =>
    set((s) => ({
      config: { ...emptyConfig },
      totalPrice: s.selectedKnife?.price ?? 0,
    })),

  clearAll: () =>
    set({
      selectedKnife: null,
      config: { ...emptyConfig },
      totalPrice: 0,
    }),
}));
