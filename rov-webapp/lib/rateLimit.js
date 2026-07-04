// Shared rate limiting for auth-sensitive routes (register, forgot-password).
//
// Uses Upstash Redis when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// are configured, so the limit is shared across every Vercel serverless
// instance. Falls back to a per-instance in-memory Map when Upstash isn't
// set up — weaker (a request that lands on a different instance won't see
// the same counter, and it resets on redeploy), but the app still works
// and still gets *some* protection out of the box.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Ratelimit instances are configured with a fixed limit/window at
// construction time, so cache one per (max, windowSeconds) combo used.
const upstashLimiters = new Map();

function getUpstashLimiter(max, windowSeconds) {
  const cacheKey = `${max}:${windowSeconds}`;
  if (!upstashLimiters.has(cacheKey)) {
    upstashLimiters.set(
      cacheKey,
      new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
        prefix: "rov-ratelimit",
      })
    );
  }
  return upstashLimiters.get(cacheKey);
}

// in-memory fallback store: key -> timestamps[]
const memoryStore = new Map();

function checkMemory(key, max, windowMs) {
  const now = Date.now();
  const prev = (memoryStore.get(key) || []).filter((t) => now - t < windowMs);
  if (prev.length >= max) return false;
  prev.push(now);
  memoryStore.set(key, prev);
  return true;
}

/**
 * @param {string} key - unique bucket id, e.g. `register:${ip}` or `reset:${email}`
 * @param {number} max - max requests allowed within the window
 * @param {number} windowSeconds - window size in seconds
 * @returns {Promise<boolean>} true if allowed, false if the limit was hit
 */
export async function checkRateLimit(key, max, windowSeconds) {
  if (hasUpstash) {
    try {
      const { success } = await getUpstashLimiter(max, windowSeconds).limit(key);
      return success;
    } catch (err) {
      // Fail open — an Upstash outage shouldn't lock every user out of
      // registering or resetting their password.
      console.error("Upstash rate limit check failed, allowing request:", err);
      return true;
    }
  }
  return checkMemory(key, max, windowSeconds * 1000);
}
