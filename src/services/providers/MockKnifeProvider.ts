import { Knife, KnifeCategory, KnifeProvider } from '@/types/Knife';
import { mockKnives } from '@/data/mockKnives';

export class MockKnifeProvider implements KnifeProvider {
  private knives: Knife[] = mockKnives;

  async searchKnives(category?: string): Promise<Knife[]> {
    await this.delay(400);

    let results = this.knives;
    if (category) {
      results = this.knives.filter(
        (k) => k.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Use an external image API for the mock images
    return results.map((k, i) => ({
      ...k,
      image: `https://loremflickr.com/640/480/knife?lock=${k.id.length + i}`
    }));
  }

  async getKnife(id: string): Promise<Knife | null> {
    await this.delay(200);
    const k = this.knives.find((k) => k.id === id);
    if (!k) return null;
    return { ...k, image: `https://loremflickr.com/640/480/knife?lock=${k.id.length}` };
  }

  async getKnifesByCategory(category: KnifeCategory): Promise<Knife[]> {
    await this.delay(400);
    return this.knives
      .filter((k) => k.category === category)
      .map((k, i) => ({ ...k, image: `https://loremflickr.com/640/480/knife?lock=${k.id.length + i}` }));
  }

  async getSpecifications(id: string): Promise<Record<string, string>> {
    const knife = await this.getKnife(id);
    if (!knife) return {};

    return {
      'Nome': knife.name,
      'Marca': knife.brand,
      'Categoria': knife.category,
      'Comprimento da Lâmina': knife.blade.length,
      'Tipo de Aço': knife.blade.steel,
      'Acabamento': knife.blade.finish,
      'Material do Cabo': knife.handle.material,
      'Peso': knife.weight,
    };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
