import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.ENCRYPTION_SECRET || 'default-csrf-secret-change-in-production';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

// Generate a CSRF token
export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
  return `${token}.${signature}`;
}

// Verify a CSRF token
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const [tokenValue, signature] = token.split('.');
  if (!tokenValue || !signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', CSRF_SECRET).update(tokenValue).digest('hex');
  
  // Use timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}

// Middleware function to check CSRF token for state-changing requests
export async function validateCsrfToken(request: NextRequest): Promise<{ valid: boolean; token?: string }> {
  const method = request.method.toUpperCase();
  
  // Only check CSRF for state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return { valid: true };
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  // Both tokens must be present and match
  if (!headerToken || !cookieToken) {
    return { valid: false };
  }

  // Verify the token is properly signed
  if (!verifyCsrfToken(headerToken)) {
    return { valid: false };
  }

  // Double-submit pattern: tokens must match
  if (headerToken !== cookieToken) {
    return { valid: false };
  }

  return { valid: true, token: headerToken };
}

// Helper to set CSRF token in response
export function setCsrfTokenCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCsrfToken();
  
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be accessible to JavaScript to send in headers
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  // Also set in header for convenience
  response.headers.set(CSRF_TOKEN_HEADER, csrfToken);

  return response;
}

// API route helper to apply CSRF protection
export async function applyCsrfProtection(request: NextRequest): Promise<{ protected: boolean; response?: NextResponse }> {
  const validation = await validateCsrfToken(request);

  if (!validation.valid) {
    return {
      protected: false,
      response: NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      ),
    };
  }

  return { protected: true };
}
