import { Knife, KnifeCategory, KnifeProvider, CustomOption } from '@/types/Knife';

interface EbayToken {
  access_token: string;
  expires_in: number;
  timestamp: number;
}

export class EbayKnifeProvider implements KnifeProvider {
  private token: EbayToken | null = null;

  private getAppId() { return process.env.EBAY_APP_ID; }
  private getCertId() { return process.env.EBAY_CERT_ID; }

  private async getAccessToken(): Promise<string> {
    if (this.token && (Date.now() - this.token.timestamp) / 1000 < this.token.expires_in - 300) {
      return this.token.access_token;
    }

    const appId = this.getAppId();
    const certId = this.getCertId();

    if (!appId || !certId) {
      throw new Error("Missing eBay credentials");
    }

    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      }),
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch eBay token: ${errorText}`);
    }

    const data = await res.json();
    this.token = {
      access_token: data.access_token,
      expires_in: data.expires_in,
      timestamp: Date.now()
    };

    return this.token.access_token;
  }

  async searchKnives(category?: string): Promise<Knife[]> {
    const token = await this.getAccessToken();
    const query = category ? `${category} knife` : 'knife';
    
    // We search within a specific category or with a keyword
    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=12`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      throw new Error('Failed to fetch from eBay');
    }

    const data = await res.json();
    return (data.itemSummaries || []).map((item: any) => this.mapEbayItemToKnife(item, category as KnifeCategory));
  }

  async getKnife(id: string): Promise<Knife | null> {
    const token = await this.getAccessToken();
    
    // Convert base64 id to original itemId if needed, or assume id is the eBay itemId
    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(id)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch item details from eBay');
    }

    const data = await res.json();
    return this.mapEbayItemDetailToKnife(data);
  }

  async getKnifesByCategory(category: KnifeCategory): Promise<Knife[]> {
    return this.searchKnives(category);
  }

  async getSpecifications(id: string): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(id)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) return {};

    const data = await res.json();
    const specs: Record<string, string> = {
      'Nome': data.title || '',
      'Preço': `${data.price?.value} ${data.price?.currency}`
    };

    if (data.localizedAspects) {
      for (const aspect of data.localizedAspects) {
        specs[aspect.name] = aspect.value;
      }
    }

    return specs;
  }

  // Helper mappings
  private mapEbayItemToKnife(item: any, fallbackCategory: KnifeCategory = 'Chef'): Knife {
    return {
      id: item.itemId,
      name: item.title,
      brand: 'eBay Item', // Extract from item if possible
      category: fallbackCategory,
      image: item.image?.imageUrl || '/placeholders/knife-placeholder.png',
      price: parseFloat(item.price?.value || '0') * 5, // Approximate conversion to BRL
      description: 'Importado via eBay API',
      weight: 'N/A',
      blade: {
        shape: 'Standard', length: 'N/A', thickness: 'N/A', steel: 'N/A', finish: 'Standard', grind: 'Standard'
      },
      handle: { material: 'N/A', color: 'N/A', shape: 'Standard' },
      sheath: null,
      availableSteels: this.getDefaultSteels(),
      availableFinishes: this.getDefaultFinishes(),
      availableHandles: this.getDefaultHandles(),
      availablePins: this.getDefaultPins(),
      availableSheaths: this.getDefaultSheaths()
    };
  }

  private mapEbayItemDetailToKnife(item: any): Knife {
    // In detail API, we have localizedAspects
    let brand = 'eBay Item';
    if (item.localizedAspects) {
      const brandAspect = item.localizedAspects.find((a: any) => a.name.toLowerCase() === 'brand');
      if (brandAspect) brand = brandAspect.value;
    }

    return {
      id: item.itemId,
      name: item.title,
      brand: brand,
      category: 'Chef', // Would need better categorization logic in a real app
      image: item.image?.imageUrl || '/placeholders/knife-placeholder.png',
      price: parseFloat(item.price?.value || '0') * 5,
      description: item.shortDescription || item.title,
      weight: 'N/A',
      blade: {
        shape: 'Standard', length: 'N/A', thickness: 'N/A', steel: 'N/A', finish: 'Standard', grind: 'Standard'
      },
      handle: { material: 'N/A', color: 'N/A', shape: 'Standard' },
      sheath: null,
      availableSteels: this.getDefaultSteels(),
      availableFinishes: this.getDefaultFinishes(),
      availableHandles: this.getDefaultHandles(),
      availablePins: this.getDefaultPins(),
      availableSheaths: this.getDefaultSheaths()
    };
  }

  // --- Default options to allow UI configurator to still work ---
  private getDefaultSteels(): CustomOption[] {
    return [
      { id: '1095', name: '1095 High Carbon', priceModifier: 0, description: 'Excelente retenção de fio.' },
      { id: 'VG10', name: 'VG-10 Inox', priceModifier: 150, description: 'Aço japonês premium.' }
    ];
  }
  private getDefaultFinishes(): CustomOption[] {
    return [
      { id: 'satin', name: 'Satin', priceModifier: 0 },
      { id: 'stonewash', name: 'Stonewash', priceModifier: 50 }
    ];
  }
  private getDefaultHandles(): CustomOption[] {
    return [
      { id: 'g10', name: 'G10 Preto', priceModifier: 0 },
      { id: 'micarta', name: 'Micarta Verde', priceModifier: 80 }
    ];
  }
  private getDefaultPins(): CustomOption[] {
    return [
      { id: 'brass', name: 'Latão', priceModifier: 0 },
      { id: 'mosaic', name: 'Mosaico', priceModifier: 120 }
    ];
  }
  private getDefaultSheaths(): CustomOption[] {
    return [
      { id: 'none', name: 'Sem Bainha', priceModifier: 0 },
      { id: 'kydex', name: 'Kydex', priceModifier: 150 }
    ];
  }
}
