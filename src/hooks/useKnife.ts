'use client';

import { useState, useEffect, useCallback } from 'react';
import { Knife, KnifeCategory } from '@/types/Knife';

// ═══════════════════════════════════════════════════════════════
// Hook: useKnives — fetches knives from /api/knives
// ═══════════════════════════════════════════════════════════════

export function useKnives(category: KnifeCategory | null) {
  const [knives, setKnives] = useState<Knife[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnives = useCallback(async () => {
    if (!category) {
      setKnives([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/knives?category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setKnives(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchKnives();
  }, [fetchKnives]);

  return { knives, loading, error, refetch: fetchKnives };
}
