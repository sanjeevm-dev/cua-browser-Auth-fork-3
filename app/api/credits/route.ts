import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helpers';
import { connectDB } from '@/server/db';
import { getUserCredits, checkSufficientCredits } from '@/app/lib/credits';
import { CREDITS_CONFIG } from '@/app/lib/constants';

// GET /api/credits - Get current user's credit balance
export async function GET() {
  try {
    const { userId, error } = await getUserId();
    if (error || !userId) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const credits = await getUserCredits(userId);
    const percentage = Math.round((credits / CREDITS_CONFIG.FREE_SIGNUP_CREDITS) * 100);

    return NextResponse.json({
      success: true,
      credits,
      percentage,
      maxCredits: CREDITS_CONFIG.FREE_SIGNUP_CREDITS,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}

// POST /api/credits - Check if user has sufficient credits for estimated runtime
export async function POST(request: Request) {
  try {
    const { userId, error } = await getUserId();
    if (error || !userId) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { estimatedMinutes = 1 } = await request.json();

    await connectDB();

    const result = await checkSufficientCredits(userId, estimatedMinutes);

    return NextResponse.json({
      success: true,
      sufficient: result.sufficient,
      currentBalance: result.currentBalance,
      required: result.required,
    });
  } catch (error) {
    console.error('Error checking credits:', error);
    return NextResponse.json(
      { error: 'Failed to check credits' },
      { status: 500 }
    );
  }
}
