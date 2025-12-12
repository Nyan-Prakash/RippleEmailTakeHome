/**
 * PR3: In-Memory Rate Limiter
 * Simple token bucket implementation for rate limiting without external storage
 */

export interface RateLimiterConfig {
  /** Maximum number of tokens in the bucket */
  maxTokens: number;
  /** Refill rate: tokens per second */
  refillRate: number;
  /** Window in milliseconds for cleanup */
  cleanupInterval?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory token bucket rate limiter
 * No external storage needed
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private config: RateLimiterConfig) {
    // Periodic cleanup to prevent memory leaks
    if (config.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, config.cleanupInterval);
    }
  }

  /**
   * Check if request is allowed for given key (e.g., IP address)
   * Returns true if allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // First request from this key
      bucket = {
        tokens: this.config.maxTokens - 1, // Consume 1 token
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
      return true;
    }

    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.config.refillRate;
    bucket.tokens = Math.min(
      this.config.maxTokens,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup() {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Clear all buckets (useful for testing)
   */
  clear() {
    this.buckets.clear();
  }

  /**
   * Cleanup timer on shutdown
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * Global rate limiter instance
 * 10 requests per minute per IP
 */
export const globalRateLimiter = new RateLimiter({
  maxTokens: 10,
  refillRate: 10 / 60, // 10 tokens per 60 seconds
  cleanupInterval: 60000, // Cleanup every minute
});
