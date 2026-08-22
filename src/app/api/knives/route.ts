import { NextRequest, NextResponse } from 'next/server';
import { KnifeService } from '@/services/KnifeService';

// GET /api/knives?category=Chef
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;

    const knives = await KnifeService.searchKnives(category);

    return NextResponse.json({ data: knives, count: knives.length });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch knives' },
      { status: 500 }
    );
  }
}
