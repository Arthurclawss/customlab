import { NextRequest, NextResponse } from 'next/server';
import { KnifeService } from '@/services/KnifeService';

// GET /api/knives/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const knife = await KnifeService.getKnife(id);

    if (!knife) {
      return NextResponse.json({ error: 'Knife not found' }, { status: 404 });
    }

    return NextResponse.json({ data: knife });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch knife' },
      { status: 500 }
    );
  }
}
