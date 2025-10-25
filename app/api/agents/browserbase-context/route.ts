import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, BrowserbaseContext } from '@/server/db';
import { encryptCredentials, decryptCredentials } from '@/app/lib/encryption';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function validateInternalRequest(request: Request): boolean {
  if (!INTERNAL_API_KEY) {
    console.error('INTERNAL_API_KEY environment variable is not set');
    return false;
  }
  const apiKey = request.headers.get('x-internal-api-key');
  return apiKey === INTERNAL_API_KEY;
}

export async function POST(request: Request) {
  if (!validateInternalRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { userId, agentId, platform, contextId, cookies, fingerprint, proxyConfig, metadata } = body;

    if (!userId || !agentId || !platform || !contextId) {
      return NextResponse.json(
        { error: 'userId, agentId, platform, and contextId are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const encryptedCookies = cookies ? encryptCredentials({ data: JSON.stringify(cookies) }) : null;

    // Upsert: update if exists, create if not
    const result = await BrowserbaseContext.findOneAndUpdate(
      { userId, agentId, platform },
      {
        $set: {
          userId,
          contextId,
          encryptedCookies,
          fingerprintId: fingerprint,
          proxyConfig,
          metadata,
          lastUsedAt: new Date(),
          isActive: true,
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean().exec();

    const contextResponse = {
      ...result,
      id: result!._id.toString(),
      agentId: result!.agentId.toString(),
      _id: undefined,
    };

    return NextResponse.json({
      success: true,
      context: contextResponse,
    });
  } catch (error) {
    console.error('Error saving browserbase context:', error);
    return NextResponse.json(
      { error: 'Failed to save context' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!validateInternalRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const agentId = searchParams.get('agentId');
    const platform = searchParams.get('platform');

    if (!userId || !agentId) {
      return NextResponse.json(
        { error: 'userId and agentId are required' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agentId' },
        { status: 400 }
      );
    }

    await connectDB();

    const query: Record<string, unknown> = { userId, agentId };
    if (platform) {
      query.platform = platform;
      query.isActive = true;
    }

    const contexts = await BrowserbaseContext.find(query).lean().exec();

    if (platform && contexts.length === 0) {
      return NextResponse.json({
        success: true,
        context: null,
      });
    }

    const decryptedContexts = contexts.map(ctx => ({
      ...ctx,
      id: ctx._id.toString(),
      agentId: ctx.agentId.toString(),
      _id: undefined,
      cookies: ctx.encryptedCookies ? JSON.parse(decryptCredentials(ctx.encryptedCookies as string).data) : null,
    }));

    return NextResponse.json({
      success: true,
      contexts: platform ? decryptedContexts[0] || null : decryptedContexts,
    });
  } catch (error) {
    console.error('Error retrieving browserbase context:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve context' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!validateInternalRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const agentId = searchParams.get('agentId');
    const platform = searchParams.get('platform');

    if (!userId || !agentId || !platform) {
      return NextResponse.json(
        { error: 'userId, agentId and platform are required' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agentId' },
        { status: 400 }
      );
    }

    await connectDB();

    await BrowserbaseContext.updateMany(
      { userId, agentId, platform },
      { $set: { isActive: false, updatedAt: new Date() } }
    ).exec();

    return NextResponse.json({
      success: true,
      message: 'Context deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating browserbase context:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate context' },
      { status: 500 }
    );
  }
}
