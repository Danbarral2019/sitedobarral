/**
 * Upstash Redis Cache Client
 *
 * Provides caching layer for:
 * - Gemini API responses
 * - Document queries
 * - Rate limiting
 *
 * Configuration:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// ===========================
// Configuration
// ===========================

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn('⚠️  Upstash Redis not configured. Caching disabled.');
}

// ===========================
// Redis Client
// ===========================

export const redis = UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// ===========================
// Cache TTL Configuration
// ===========================

export const CACHE_TTL = {
  // Gemini responses (24 hours)
  GEMINI_QUERY: 60 * 60 * 24,

  // Document metadata (1 hour)
  DOCUMENT_META: 60 * 60,

  // Search results (15 minutes)
  SEARCH_RESULTS: 60 * 15,

  // User session (7 days)
  USER_SESSION: 60 * 60 * 24 * 7,

  // Rate limit windows (1 minute)
  RATE_LIMIT: 60,
} as const;

// ===========================
// Cache Key Builders
// ===========================

export const CacheKeys = {
  /**
   * Gemini query cache key
   * Format: gemini:query:{fileId}:{queryHash}
   */
  geminiQuery: (fileId: string, query: string): string => {
    const queryHash = hashString(query);
    return `gemini:query:${fileId}:${queryHash}`;
  },

  /**
   * Document metadata cache key
   * Format: doc:meta:{documentId}
   */
  documentMeta: (documentId: string): string => {
    return `doc:meta:${documentId}`;
  },

  /**
   * Search results cache key
   * Format: search:{queryHash}:{filters}
   */
  searchResults: (query: string, filters?: Record<string, any>): string => {
    const queryHash = hashString(query);
    const filterHash = filters ? hashString(JSON.stringify(filters)) : 'none';
    return `search:${queryHash}:${filterHash}`;
  },

  /**
   * Rate limit key
   * Format: ratelimit:{identifier}:{window}
   */
  rateLimit: (identifier: string, window: string = 'default'): string => {
    return `ratelimit:${identifier}:${window}`;
  },

  /**
   * Gemini file indexation status
   * Format: gemini:indexed:{documentId}
   */
  geminiIndexed: (documentId: string): string => {
    return `gemini:indexed:${documentId}`;
  },
} as const;

// ===========================
// Helper Functions
// ===========================

/**
 * Simple hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ===========================
// Cache Utilities
// ===========================

/**
 * Get from cache with JSON parsing
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set in cache with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CACHE_TTL.SEARCH_RESULTS
): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete from cache
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) return;

  try {
    // Note: Upstash Redis doesn't support SCAN, so we need to be careful with patterns
    // For now, we'll just delete exact keys
    // In production, consider using a key prefix strategy
    console.warn('Pattern deletion not fully supported. Consider using exact keys.');
  } catch (error) {
    console.error('Cache pattern delete error:', error);
  }
}

/**
 * Check if key exists
 */
export async function existsCache(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Cache exists error:', error);
    return false;
  }
}

/**
 * Increment a counter (for rate limiting)
 */
export async function incrementCache(
  key: string,
  ttl: number = CACHE_TTL.RATE_LIMIT
): Promise<number> {
  if (!redis) return 0;

  try {
    const count = await redis.incr(key);

    // Set TTL on first increment
    if (count === 1) {
      await redis.expire(key, ttl);
    }

    return count;
  } catch (error) {
    console.error('Cache increment error:', error);
    return 0;
  }
}

// ===========================
// Rate Limiting
// ===========================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * Check rate limit
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 60 // seconds
): Promise<RateLimitResult> {
  if (!redis) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset: Date.now() + window * 1000,
    };
  }

  try {
    const key = CacheKeys.rateLimit(identifier);
    const count = await incrementCache(key, window);

    const remaining = Math.max(0, limit - count);
    const reset = Date.now() + window * 1000;

    return {
      allowed: count <= limit,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open on error
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset: Date.now() + window * 1000,
    };
  }
}

// ===========================
// Cache Wrapper
// ===========================

/**
 * Cache wrapper for expensive operations
 * Automatically caches the result and returns cached value on subsequent calls
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL.SEARCH_RESULTS
): Promise<T> {
  // Try to get from cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    console.log(`✅ Cache HIT: ${key}`);
    return cached;
  }

  // Execute function and cache result
  console.log(`❌ Cache MISS: ${key}`);
  const result = await fn();
  await setCache(key, result, ttl);

  return result;
}

// ===========================
// Health Check
// ===========================

/**
 * Check if Redis is connected and healthy
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  if (!redis) {
    return {
      connected: false,
      error: 'Redis not configured',
    };
  }

  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return {
      connected: true,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ===========================
// Export
// ===========================

export default {
  redis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  existsCache,
  incrementCache,
  checkRateLimit,
  withCache,
  healthCheck,
  CacheKeys,
  CACHE_TTL,
};
