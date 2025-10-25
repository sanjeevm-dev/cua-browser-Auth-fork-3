import mongoose from 'mongoose';
import { UserCredits, CreditsHistory } from '../../lib/models';
import { CREDITS_CONFIG, CREDITS_REASONS } from './constants';
import NotificationService from '../../lib/services/NotificationService';

/**
 * Get current credit balance for a user
 */
export async function getUserCredits(userId: string): Promise<number> {
  const userCredits = await UserCredits.findOne({ userId });
  
  if (!userCredits) {
    // User doesn't have credits record yet - create one with initial credits
    const newUserCredits = await UserCredits.create({
      userId,
      credits: CREDITS_CONFIG.FREE_SIGNUP_CREDITS,
    });
    
    // Log the signup bonus
    await CreditsHistory.create({
      userId,
      delta: CREDITS_CONFIG.FREE_SIGNUP_CREDITS,
      reason: CREDITS_REASONS.SIGNUP_BONUS,
      balanceAfter: CREDITS_CONFIG.FREE_SIGNUP_CREDITS,
      metadata: { source: 'auto_allocation' },
    });
    
    return newUserCredits.credits;
  }
  
  return userCredits.credits;
}

/**
 * Check if user has sufficient credits
 */
export async function checkSufficientCredits(
  userId: string,
  estimatedMinutes: number = 1
): Promise<{ sufficient: boolean; currentBalance: number; required: number }> {
  const currentBalance = await getUserCredits(userId);
  const required = estimatedMinutes * CREDITS_CONFIG.CREDITS_PER_MINUTE;
  
  return {
    sufficient: currentBalance >= required,
    currentBalance,
    required,
  };
}

/**
 * Deduct credits from user account with atomic transaction
 * @returns New balance after deduction, or null if insufficient credits
 */
export async function deductCredits(
  userId: string,
  minutes: number,
  reason: string = CREDITS_REASONS.AGENT_RUN,
  metadata?: {
    agentId?: string;
    sessionId?: string;
    [key: string]: unknown;
  }
): Promise<{ 
  success: boolean; 
  newBalance?: number; 
  error?: string;
  creditNotification?: {
    type: 'credits_low' | 'credits_exhausted';
    title: string;
    message: string;
    priority: 'critical' | 'warning';
  };
}> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const creditsToDeduct = Math.ceil(minutes * CREDITS_CONFIG.CREDITS_PER_MINUTE);
    
    // 1. Find user credits with lock (for update)
    const userCredits = await UserCredits.findOne({ userId }).session(session);
    
    if (!userCredits) {
      await session.abortTransaction();
      return { success: false, error: 'User credits not found' };
    }
    
    const currentCredits = userCredits.credits;
    
    // 2. Check sufficient balance
    if (currentCredits < creditsToDeduct) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: `Insufficient credits. Required: ${creditsToDeduct}, Available: ${currentCredits}` 
      };
    }
    
    // 3. Deduct credits
    const newBalance = currentCredits - creditsToDeduct;
    await UserCredits.updateOne(
      { userId },
      { $set: { credits: newBalance } }
    ).session(session);
    
    // 4. Log transaction in history
    await CreditsHistory.create([{
      userId,
      delta: -creditsToDeduct,
      reason,
      agentId: metadata?.agentId ? new mongoose.Types.ObjectId(metadata.agentId) : null,
      sessionId: metadata?.sessionId ? new mongoose.Types.ObjectId(metadata.sessionId) : null,
      balanceAfter: newBalance,
      metadata: metadata || null,
    }], { session });
    
    // 5. Commit transaction
    await session.commitTransaction();
    
    // 6. Check credit thresholds and create notifications
    let creditNotification = undefined;
    
    try {
      const baselineCredits = CREDITS_CONFIG.FREE_SIGNUP_CREDITS;
      const percentageRemaining = (newBalance / baselineCredits) * 100;
      
      if (newBalance === 0) {
        await NotificationService.createNotification({
          userId,
          typeKey: 'credits_exhausted',
          metadata: {
            creditBalance: 0,
          }
        });
        
        creditNotification = {
          type: 'credits_exhausted' as const,
          title: 'Credits Exhausted',
          message: 'Your credits have been exhausted. All agents have been paused.',
          priority: 'critical' as const
        };
      } else if (percentageRemaining <= 10) {
        await NotificationService.createNotification({
          userId,
          typeKey: 'credits_low',
          metadata: {
            creditBalance: Math.round(percentageRemaining),
          }
        });
        
        creditNotification = {
          type: 'credits_low' as const,
          title: 'Credits Running Low',
          message: `Your credit balance is at ${Math.round(percentageRemaining)}%. Consider topping up soon.`,
          priority: 'warning' as const
        };
      }
    } catch (notifError) {
      console.error('Error creating credit notification:', notifError);
    }
    
    return { success: true, newBalance, creditNotification };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deducting credits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct credits' 
    };
  } finally {
    session.endSession();
  }
}

/**
 * Add credits to user account (for bonuses, purchases, or admin adjustments)
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string = CREDITS_REASONS.ADMIN_ADJUSTMENT,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Find or create user credits
    const userCredits = await UserCredits.findOne({ userId }).session(session);
    let newBalance: number;
    
    if (!userCredits) {
      await UserCredits.create([{
        userId,
        credits: amount,
      }], { session });
      newBalance = amount;
    } else {
      newBalance = userCredits.credits + amount;
      await UserCredits.updateOne(
        { userId },
        { $set: { credits: newBalance } }
      ).session(session);
    }
    
    // 2. Log transaction
    await CreditsHistory.create([{
      userId,
      delta: amount,
      reason,
      balanceAfter: newBalance,
      metadata: metadata || null,
    }], { session });
    
    await session.commitTransaction();
    
    return { success: true, newBalance };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding credits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to add credits' 
    };
  } finally {
    session.endSession();
  }
}

/**
 * Get credits transaction history for a user
 */
export async function getCreditsHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  timestamp: Date;
  metadata?: Record<string, unknown> | null;
}>> {
  const history = await CreditsHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .lean();
  
  return history.map((record) => ({
    id: (record as { _id: { toString: () => string } })._id.toString(),
    delta: record.delta as number,
    reason: record.reason as string,
    balanceAfter: record.balanceAfter as number,
    timestamp: record.createdAt as Date,
    metadata: record.metadata as Record<string, unknown> | null,
  }));
}

/**
 * Calculate session runtime in minutes
 */
export function calculateSessionMinutes(startTime: Date, endTime: Date): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = durationMs / (1000 * 60);
  return Math.max(0, durationMinutes); // Ensure non-negative
}
