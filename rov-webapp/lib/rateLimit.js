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
//
// ── Why this needs pruning ──
// Every distinct key ever passed to checkMemory() (e.g. `login:email:${email}`,
// `save-data-user:${email}`, `register:${ip}`) becomes, and STAYS, an entry in
// this Map for the lifetime of the process — even once its timestamp array has
// been filtered down to empty. On Vercel's serverless functions this is bounded
// in practice (instances are short-lived and get recycled), but it's a real,
// unbounded memory leak on any longer-lived Node process (a VPS/container
// deploy, or just a very long-lived serverless instance under sustained
// traffic) — every unique IP or email that ever hits a rate-limited route adds
// a permanent entry that's never removed, only ever emptied.
// This gets worse combined with routes that don't cap input length before
// using it as part of a rate-limit key: an attacker submitting many requests
// each with a unique, very long fake value (e.g. a long fake email address)
// would accumulate many large string keys, never evicted. (app/api/register
// and lib/auth.js's login flow now both cap the relevant input lengths before
// they can reach here — see MAX_EMAIL there — but this file shouldn't rely on
// every caller doing that correctly forever; pruning here is the actual fix.)
//
// Fix: whenever a key's timestamp array empties out (every timestamp aged past
// the window), delete the key entirely instead of leaving a zero-length array
// behind. Combined with a periodic full sweep (in case a key's *window* means
// it naturally goes quiet without ever being checked again — nothing else
// would trigger the "delete when empty" path for it), this keeps the map's
// size bounded by "currently active" keys rather than "every key ever seen".
const memoryStore = new Map();

const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
// เดา window ที่ยาวที่สุดที่ระบบนี้ใช้จริงไว้กว้างๆ (register: 15 นาที) — sweep คีย์ที่ไม่ได้ใช้
// นานเกิน 30 นาทีทิ้ง ไม่มีทางที่ entry อายุเกินนี้จะยังเป็น "active limiter" ของใครอยู่
const SWEEP_STALE_MS = 30 * 60 * 1000;
let lastSweepAt = Date.now();

function sweepMemoryStore(now) {
  for (const [key, timestamps] of memoryStore) {
    const newest = timestamps.length ? timestamps[timestamps.length - 1] : 0;
    if (now - newest > SWEEP_STALE_MS) memoryStore.delete(key);
  }
  lastSweepAt = now;
}

function checkMemory(key, max, windowMs) {
  const now = Date.now();

  // Opportunistic full sweep — piggybacks on whatever request happens to call
  // this, no setInterval/timer needed (which wouldn't fit serverless anyway;
  // a timer started in one invocation doesn't survive into the next one).
  if (now - lastSweepAt > SWEEP_INTERVAL_MS) sweepMemoryStore(now);

  const prev = (memoryStore.get(key) || []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    // ยังนับว่า key นี้ active อยู่ (ใกล้โดน block) — เก็บ array ที่กรองแล้วไว้ก่อน ไม่ลบทิ้ง
    memoryStore.set(key, prev);
    return false;
  }
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

// Exposed for tests only — not used by application code.
export const __internal = { memoryStore, sweepMemoryStore, SWEEP_STALE_MS };
