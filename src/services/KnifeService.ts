import { Knife, KnifeCategory, KnifeProvider } from '@/types/Knife';
import { MockKnifeProvider } from './providers/MockKnifeProvider';
import { EbayKnifeProvider } from './providers/EbayKnifeProvider';
import { LocalStorageProvider } from './storage/LocalStorageProvider';
class KnifeServiceFacade implements KnifeProvider {
  private primaryProvider: KnifeProvider;
  private fallbackProvider: KnifeProvider;

  constructor() {
    this.primaryProvider = new EbayKnifeProvider();
    this.fallbackProvider = new MockKnifeProvider();
  }

  async searchKnives(category?: string): Promise<Knife[]> {
    try {
      return await this.primaryProvider.searchKnives(category);
    } catch (error) {
      console.warn("Primary provider failed, falling back to Mock Provider:", error);
      return this.fallbackProvider.searchKnives(category);
    }
  }

  async getKnife(id: string): Promise<Knife | null> {
    try {
      return await this.primaryProvider.getKnife(id);
    } catch (error) {
      console.warn(`Primary provider failed for id ${id}, falling back:`, error);
      return this.fallbackProvider.getKnife(id);
    }
  }

  async getKnifesByCategory(category: KnifeCategory): Promise<Knife[]> {
    try {
      return await this.primaryProvider.getKnifesByCategory(category);
    } catch (error) {
      console.warn(`Primary provider failed for category ${category}, falling back:`, error);
      return this.fallbackProvider.getKnifesByCategory(category);
    }
  }

  async getSpecifications(id: string): Promise<Record<string, string>> {
    try {
      return await this.primaryProvider.getSpecifications(id);
    } catch (error) {
      console.warn(`Primary provider failed to get specs for id ${id}, falling back:`, error);
      return this.fallbackProvider.getSpecifications(id);
    }
  }
}

// ── Singleton ──
const provider: KnifeProvider = new KnifeServiceFacade();

const cache = new LocalStorageProvider();
// ── Public Service API ──
export const KnifeService = {
  /** Search knives – cached for 24h */
  async searchKnives(category?: string) {
    const cacheKey = `knives:search:${category ?? 'all'}`;
    const cached = cache.getItem<{ data: any; ts: number }>(cacheKey);
    const now = Date.now();
    if (cached && now - cached.ts < 24 * 60 * 60 * 1000) {
      return cached.data;
    }
    const data = await provider.searchKnives(category);
    cache.setItem(cacheKey, { data, ts: now });
    return data;
  },
  async getKnife(id: string) {
    const cacheKey = `knife:${id}`;
    const cached = cache.getItem<any>(cacheKey);
    if (cached) return cached;
    const data = await provider.getKnife(id);
    if (data) cache.setItem(cacheKey, data);
    return data;
  },
  async getKnifesByCategory(category: KnifeCategory) {
    return this.searchKnives(category);
  },
  async getSpecifications(id: string) {
    const cacheKey = `knife:specs:${id}`;
    const cached = cache.getItem<any>(cacheKey);
    if (cached) return cached;
    const data = await provider.getSpecifications(id);
    if (data) cache.setItem(cacheKey, data);
    return data;
  },
};
