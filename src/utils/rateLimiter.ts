/**
 * Rate Limiter for PU2-rc1
 * Prevents abuse of RPC endpoints and third-party APIs
 */

import { logger } from './logger';

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests = new Map<string, RequestRecord>();
  
  /**
   * Check if a request is allowed under the rate limit
   */
  isAllowed(options: RateLimitOptions): boolean {
    const { maxRequests, windowMs, identifier = 'default' } = options;
    const now = Date.now();
    
    // Get or create request record
    let record = this.requests.get(identifier);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.requests.set(identifier, record);
    }
    
    // Check if limit exceeded
    if (record.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        component: 'RateLimiter',
        identifier,
        count: record.count,
        maxRequests,
        resetTime: record.resetTime
      });
      return false;
    }
    
    // Increment count and allow request
    record.count++;
    return true;
  }
  
  /**
   * Wait until rate limit resets
   */
  async waitForReset(identifier: string = 'default'): Promise<void> {
    const record = this.requests.get(identifier);
    if (!record) return;
    
    const waitTime = record.resetTime - Date.now();
    if (waitTime > 0) {
      logger.debug(`Waiting for rate limit reset`, {
        component: 'RateLimiter',
        identifier,
        waitTime
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(identifier: string = 'default', maxRequests: number): number {
    const record = this.requests.get(identifier);
    if (!record || Date.now() > record.resetTime) {
      return maxRequests;
    }
    return Math.max(0, maxRequests - record.count);
  }
  
  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [identifier, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(identifier);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Cleanup expired records every minute
setInterval(() => rateLimiter.cleanup(), 60 * 1000);

// Predefined rate limiters for different services
export const RPC_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

export const CONTRACT_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
};

export const DATABASE_RATE_LIMIT = {
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Decorator to rate limit async functions
 */
export function withRateLimit<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RateLimitOptions
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    if (!rateLimiter.isAllowed(options)) {
      throw new Error(`Rate limit exceeded. Max ${options.maxRequests} requests per ${options.windowMs}ms`);
    }
    return await fn(...args);
  };
}

/**
 * Rate limited fetch wrapper
 */
export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
  rateLimit: RateLimitOptions = RPC_RATE_LIMIT
): Promise<Response> {
  const identifier = new URL(url).hostname;
  
  if (!rateLimiter.isAllowed({ ...rateLimit, identifier })) {
    throw new Error(`Rate limit exceeded for ${identifier}. Max ${rateLimit.maxRequests} requests per ${rateLimit.windowMs}ms`);
  }
  
  logger.debug('Making rate-limited request', {
    component: 'RateLimiter',
    url,
    identifier,
    remaining: rateLimiter.getRemainingRequests(identifier, rateLimit.maxRequests)
  });
  
  return fetch(url, options);
}

/**
 * Exponential backoff with jitter for retries
 */
export async function exponentialBackoff(
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        logger.error(`Max retries exceeded (${maxRetries})`, lastError, {
          component: 'RateLimiter'
        });
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        30000 // Max 30 seconds
      );
      
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        component: 'RateLimiter',
        error: lastError.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}