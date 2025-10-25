import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function getUserId(): Promise<{ userId: string | null; error: NextResponse | null }> {
  const authResult = await auth();
  
  if (!authResult.userId) {
    return {
      userId: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Please sign in to access this resource' },
        { status: 401 }
      )
    };
  }
  
  return { userId: authResult.userId, error: null };
}
