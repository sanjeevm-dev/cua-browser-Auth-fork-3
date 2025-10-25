import { NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfTokenCookie } from '@/app/lib/csrf';

// GET endpoint to obtain a CSRF token
export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ token });
  return setCsrfTokenCookie(response, token);
}
