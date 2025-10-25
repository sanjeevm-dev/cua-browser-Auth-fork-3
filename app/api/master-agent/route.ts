import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helpers';
import { generateDailyTasks, MasterAgentRequest } from '@/app/lib/master-agent';

// Allow up to 120 seconds for Master Agent task generation (GPT-4 can take 30-90s for complex campaigns)
export const maxDuration = 120;

/**
 * HTTP endpoint for Master Agent (thin wrapper around core logic)
 * This endpoint is kept for backward compatibility and direct API calls
 * The main agent creation flow now calls generateDailyTasks directly
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await getUserId();
    if (error) return error;

    const body: MasterAgentRequest = await request.json();

    console.log('🌐 Master Agent HTTP endpoint called');
    
    // Call the extracted Master Agent function
    const result = await generateDailyTasks(body);

    // Return the result based on success/error
    if (result.success) {
      return NextResponse.json({
        success: true,
        dailyTasks: result.dailyTasks,
        campaignDuration: result.campaignDuration,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to generate daily tasks' 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Master Agent HTTP endpoint error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: (error as Error).message || 'Failed to generate daily tasks' 
      },
      { status: 500 }
    );
  }
}
