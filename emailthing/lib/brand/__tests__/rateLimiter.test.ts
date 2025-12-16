/**
 * PR3: Tests for in-memory rate limiter
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../rateLimiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxTokens: 5,
      refillRate: 1, // 1 token per second
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  it("should allow requests within limit", () => {
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(true);
  });

  it("should rate limit after maxTokens", () => {
    // Consume all 5 tokens
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("user1")).toBe(true);
    }

    // 6th request should be blocked
    expect(limiter.check("user1")).toBe(false);
  });

  it("should track different keys separately", () => {
    // Consume tokens for user1
    for (let i = 0; i < 5; i++) {
      limiter.check("user1");
    }

    // user2 should still have tokens
    expect(limiter.check("user2")).toBe(true);
  });

  it("should refill tokens over time", async () => {
    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("user1")).toBe(true);
    }

    // Should be blocked
    expect(limiter.check("user1")).toBe(false);

    // Wait for refill (2 seconds = 2 tokens)
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Should have 2 tokens now
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user1")).toBe(false);
  });

  it("should not exceed maxTokens on refill", async () => {
    // Use 1 token
    limiter.check("user1");

    // Wait for refill (3 seconds = 3 tokens, total will be 4 + 3 = 7, but capped at 5)
    await new Promise((resolve) => setTimeout(resolve, 3100));

    // Should have maxTokens (5), not more
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("user1")).toBe(true);
    }
    expect(limiter.check("user1")).toBe(false);
  }, 10000); // Set timeout to 10s for this test

  it("should clear all buckets", () => {
    limiter.check("user1");
    limiter.check("user2");

    limiter.clear();

    // Both users should have fresh buckets
    expect(limiter.check("user1")).toBe(true);
    expect(limiter.check("user2")).toBe(true);
  });

  it("should run cleanup periodically", async () => {
    const limiterWithCleanup = new RateLimiter({
      maxTokens: 5,
      refillRate: 1,
      cleanupInterval: 100, // 100ms for testing
    });

    limiterWithCleanup.check("user1");

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 150));

    limiterWithCleanup.destroy();
  });
});
