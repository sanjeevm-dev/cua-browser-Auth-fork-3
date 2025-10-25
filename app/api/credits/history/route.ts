import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helpers';
import { connectDB } from '@/server/db';
import { getCreditsHistory } from '@/app/lib/credits';

// GET /api/credits/history - Get user's credit transaction history
export async function GET(request: Request) {
  try {
    const { userId, error } = await getUserId();
    if (error || !userId) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    await connectDB();

    const history = await getCreditsHistory(userId, limit, offset);

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error fetching credits history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits history' },
      { status: 500 }
    );
  }
}
