import { NextResponse } from 'next/server';
import { StagehandBrowser } from '@/app/api/cua/agent/stagehand';
import { z } from 'zod';

const PREDEFINED_SCHEMAS = {
  products: z.object({
    products: z.array(z.object({
      name: z.string(),
      price: z.string(),
      rating: z.number().optional(),
    }))
  }),
  page_info: z.object({
    title: z.string(),
    description: z.string().optional(),
    links: z.array(z.string().url()).optional(),
  }),
  contact_info: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
};

export async function POST(request: Request) {
  let stagehand: StagehandBrowser | null = null;

  try {
    const body = await request.json();
    const { action, sessionId } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action in request body. Use "act", "extract", "observe", or "agent"' },
        { status: 400 }
      );
    }

    stagehand = new StagehandBrowser(sessionId || null);
    
    const initResult = await stagehand.init();
    console.log('Stagehand initialized:', initResult);

    let result: any;

    switch (action) {
      case 'act':
        await stagehand.goto(body.url || 'https://example.com');
        result = await stagehand.act(body.instruction || 'click the first link');
        break;

      case 'extract':
        await stagehand.goto(body.url || 'https://example.com');
        
        if (body.schemaType && PREDEFINED_SCHEMAS[body.schemaType as keyof typeof PREDEFINED_SCHEMAS]) {
          const schema = PREDEFINED_SCHEMAS[body.schemaType as keyof typeof PREDEFINED_SCHEMAS];
          result = await stagehand.extract({
            instruction: body.instruction || 'extract page data',
            schema,
          });
        } else {
          result = await stagehand.extract(body.instruction || 'extract page content');
        }
        break;

      case 'observe':
        await stagehand.goto(body.url || 'https://example.com');
        result = await stagehand.observe(body.instruction || 'find clickable elements');
        break;

      case 'agent':
        await stagehand.goto(body.url || 'https://example.com');
        result = await stagehand.runAgent(
          body.instruction || 'analyze this page and summarize what it does'
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "act", "extract", "observe", or "agent"' },
          { status: 400 }
        );
    }

    const screenshot = await stagehand.screenshot();

    return NextResponse.json({
      success: true,
      sessionId: stagehand.getSessionId(),
      sessionUrl: initResult.sessionUrl,
      debugUrl: initResult.debugUrl,
      result,
      screenshot,
    });
  } catch (error) {
    console.error('Error in stagehand endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process request' 
      },
      { status: 500 }
    );
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}
