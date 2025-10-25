// In-memory rate limiter using sliding window algorithm
// For production, consider using Redis-based rate limiting with @upstash/ratelimit

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetTime < now) {
        this.requests.delete(key);
      }
    }
  }

  async limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || entry.resetTime < now) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });

      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: now + this.windowMs,
      };
    }

    // Within existing window
    if (entry.count >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: entry.resetTime,
      };
    }

    entry.count++;
    this.requests.set(identifier, entry);

    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - entry.count,
      reset: entry.resetTime,
    };
  }
}

// Different rate limiters for different endpoint types
export const apiRateLimiter = new InMemoryRateLimiter(60000, 100); // 100 requests per minute for general API
export const resourceIntensiveRateLimiter = new InMemoryRateLimiter(60000, 10); // 10 requests per minute for heavy operations
export const agentExecutionRateLimiter = new InMemoryRateLimiter(300000, 5); // 5 requests per 5 minutes for agent execution

// Helper function to get client identifier
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (works with proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }

  // Fallback to a combination of headers for identification
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${userAgent.substring(0, 50)}`;
}

// Rate limiting middleware function
export async function applyRateLimit(
  request: Request,
  limiter: InMemoryRateLimiter = apiRateLimiter
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const identifier = getClientIdentifier(request);
  const result = await limiter.limit(identifier);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };

  if (!result.success) {
    headers['Retry-After'] = Math.ceil((result.reset - Date.now()) / 1000).toString();
  }

  return {
    allowed: result.success,
    headers,
  };
}
