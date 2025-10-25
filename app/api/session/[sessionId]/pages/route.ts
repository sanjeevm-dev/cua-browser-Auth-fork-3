import Browserbase from "@browserbasehq/sdk";
import { NextResponse } from "next/server";

async function getOpenPages(sessionId: string) {
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const debug = await bb.sessions.debug(sessionId);
  return debug.pages;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const pages = await getOpenPages(sessionId);
  return NextResponse.json({ pages });
}
