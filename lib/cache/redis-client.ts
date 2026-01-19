/**
 * Upstash Redis Cache Client
 *
 * Provides caching layer for:
 * - Gemini API responses
 * - Document queries
 * - Rate limiting
 * - Public API endpoints (FAQ, testimonials, glossary, etc.)
 *
 * Configuration:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 * - DISABLE_CACHE (optional) - Set to 'true' to disable caching globally
 */

import { Redis } from '@upstash/redis';

// ===========================
// Configuration
// ===========================

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DISABLE_CACHE = process.env.DISABLE_CACHE === 'true';

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

  // ===========================
  // Public API Cache TTLs (Fase 10)
  // ===========================

  // Lei 14.133 articles (1 hour) - Complex queries
  LEI_ARTICLES: 60 * 60,

  // FAQ list (2 hours) - Infrequent changes
  FAQ_LIST: 60 * 60 * 2,

  // Testimonials (4 hours) - Very infrequent changes
  TESTIMONIALS: 60 * 60 * 4,

  // Glossary terms (2 hours) - Moderate changes
  GLOSSARY: 60 * 60 * 2,

  // Legislative acts (2 hours) - Moderate changes
  LEGISLATIVE_ACTS: 60 * 60 * 2,

  // Course documents (1 hour) - Per user/course
  COURSE_DOCUMENTS: 60 * 60,

  // ===========================
  // Embeddings/Vector Search TTLs
  // ===========================

  // Vector search results (15 minutes) - Per query
  VECTOR_SEARCH: 60 * 15,

  // Query embeddings (1 hour) - Cached query vectors
  QUERY_EMBEDDING: 60 * 60,

  // Synthesized answers (1 hour) - LLM responses
  SYNTHESIZED_ANSWER: 60 * 60,
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

  // ===========================
  // Public API Cache Keys (Fase 10)
  // ===========================

  /**
   * Lei 14.133 articles cache key
   * Format: lei:articles:{auth|public}:{filterHash}
   * Separated by auth state because documents differ
   */
  leiArticles: (isAuth: boolean, filters?: { withDocuments?: boolean; titulo?: string }): string => {
    const authKey = isAuth ? 'auth' : 'public';
    const filterHash = filters ? hashString(JSON.stringify(filters)) : 'all';
    return `lei:articles:${authKey}:${filterHash}`;
  },

  /**
   * FAQ list cache key
   * Format: faq:list:{category|all}
   */
  faqList: (category?: string | null): string => {
    return `faq:list:${category || 'all'}`;
  },

  /**
   * Testimonials list cache key
   * Format: testimonials:list
   * Single key (no filters)
   */
  testimonialsList: (): string => {
    return 'testimonials:list';
  },

  /**
   * Glossary terms cache key
   * Format: glossary:{category}:{letter}:{offset}:{limit}
   */
  glossaryTerms: (params: {
    category?: string | null;
    letter?: string | null;
    offset?: number;
    limit?: number;
  }): string => {
    const { category, letter, offset = 0, limit = 100 } = params;
    return `glossary:${category || 'all'}:${letter || 'all'}:${offset}:${limit}`;
  },

  /**
   * Legislative acts cache key
   * Format: acts:{filterHash}:{page}:{limit}
   */
  legislativeActs: (params: {
    type?: string | null;
    issuer?: string | null;
    year?: string | null;
    search?: string | null;
    articleNumber?: string | null;
    page?: number;
    limit?: number;
  }): string => {
    const { type, issuer, year, search, articleNumber, page = 1, limit = 20 } = params;
    const filterHash = hashString(JSON.stringify({ type, issuer, year, search, articleNumber }));
    return `acts:${filterHash}:${page}:${limit}`;
  },

  /**
   * Course documents cache key
   * Format: docs:course:{courseId}:{userId}
   */
  courseDocuments: (courseId: string, userId: string): string => {
    return `docs:course:${courseId}:${userId}`;
  },

  /**
   * Registry key for tracking cache keys by prefix
   * Format: registry:{prefix}
   */
  registry: (prefix: string): string => {
    return `registry:${prefix}`;
  },

  // ===========================
  // Embeddings/Vector Search Keys
  // ===========================

  /**
   * Vector search results cache key
   * Format: vector-search:{queryHash}:{courseId}:{category}:{limit}:{threshold}
   */
  vectorSearch: (params: {
    query: string;
    courseId?: string;
    category?: string;
    limit?: number;
    threshold?: number;
  }): string => {
    const { query, courseId, category, limit = 5, threshold = 0.5 } = params;
    const queryHash = hashString(query);
    return `vector-search:${queryHash}:${courseId || 'all'}:${category || 'all'}:${limit}:${threshold}`;
  },

  /**
   * Query embedding cache key
   * Format: query-embedding:{queryHash}
   */
  queryEmbedding: (query: string): string => {
    const queryHash = hashString(query);
    return `query-embedding:${queryHash}`;
  },

  /**
   * Synthesized answer cache key
   * Format: synth-answer:{queryHash}:{contextHash}
   */
  synthesizedAnswer: (query: string, contextIds: string[]): string => {
    const queryHash = hashString(query);
    const contextHash = hashString(contextIds.sort().join(','));
    return `synth-answer:${queryHash}:${contextHash}`;
  },

  /**
   * Document embedding status cache key
   * Format: embed-status:{documentId}
   */
  embeddingStatus: (documentId: string): string => {
    return `embed-status:${documentId}`;
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
// Cache Registry (Workaround for Upstash SCAN limitation)
// ===========================

/**
 * Register a cache key in a prefix registry
 * Allows invalidation of all keys with a given prefix without SCAN
 */
export async function registerCacheKey(prefix: string, fullKey: string): Promise<void> {
  if (!redis || DISABLE_CACHE) return;

  try {
    const registryKey = CacheKeys.registry(prefix);
    await redis.sadd(registryKey, fullKey);
    // Registry never expires - cleaned on invalidation
  } catch (error) {
    console.error('Cache registry error:', error);
  }
}

/**
 * Get all registered keys for a prefix
 */
export async function getRegisteredKeys(prefix: string): Promise<string[]> {
  if (!redis || DISABLE_CACHE) return [];

  try {
    const registryKey = CacheKeys.registry(prefix);
    const keys = await redis.smembers(registryKey);
    return keys as string[];
  } catch (error) {
    console.error('Cache registry get error:', error);
    return [];
  }
}

/**
 * Invalidate all cache keys for a given prefix
 * Uses registry to track keys (workaround for Upstash SCAN limitation)
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<number> {
  if (!redis || DISABLE_CACHE) return 0;

  try {
    const registryKey = CacheKeys.registry(prefix);
    const keys = await redis.smembers(registryKey);

    if (!keys || keys.length === 0) {
      console.log(`🗑️ No keys to invalidate for prefix: ${prefix}`);
      return 0;
    }

    // Delete all registered keys
    const keysArray = keys as string[];
    await Promise.all(keysArray.map(key => redis.del(key)));

    // Clear the registry
    await redis.del(registryKey);

    console.log(`🗑️ Invalidated ${keysArray.length} keys for prefix: ${prefix}`);
    return keysArray.length;
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return 0;
  }
}

// ===========================
// Cache Wrapper
// ===========================

/**
 * Options for withCache
 */
export interface WithCacheOptions {
  /** Prefix for registry (enables prefix-based invalidation) */
  prefix?: string;
}

/**
 * Cache wrapper for expensive operations
 * Automatically caches the result and returns cached value on subsequent calls
 *
 * @param key - Cache key
 * @param fn - Function to execute if cache miss
 * @param ttl - Time to live in seconds
 * @param options - Additional options (prefix for registry)
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL.SEARCH_RESULTS,
  options?: WithCacheOptions
): Promise<T> {
  // Skip cache if globally disabled or redis not configured
  if (DISABLE_CACHE || !redis) {
    return fn();
  }

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

  // Register key in prefix registry if specified
  if (options?.prefix) {
    await registerCacheKey(options.prefix, key);
  }

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
// Cache Invalidation Helpers (Fase 10)
// ===========================

/**
 * Centralized cache invalidation helpers
 * Use these in admin routes after mutations
 */
export const CacheInvalidation = {
  /**
   * Invalidate FAQ cache
   */
  faq: async (): Promise<number> => {
    return invalidateCacheByPrefix('faq');
  },

  /**
   * Invalidate testimonials cache
   */
  testimonials: async (): Promise<void> => {
    await deleteCache(CacheKeys.testimonialsList());
    console.log('🗑️ Invalidated testimonials cache');
  },

  /**
   * Invalidate glossary cache
   */
  glossary: async (): Promise<number> => {
    return invalidateCacheByPrefix('glossary');
  },

  /**
   * Invalidate legislative acts cache
   */
  legislativeActs: async (): Promise<number> => {
    return invalidateCacheByPrefix('acts');
  },

  /**
   * Invalidate Lei 14.133 articles cache
   */
  leiArticles: async (): Promise<number> => {
    return invalidateCacheByPrefix('lei');
  },

  /**
   * Invalidate course documents cache
   * @param courseId - Optional: invalidate only for specific course
   */
  courseDocuments: async (courseId?: string): Promise<number> => {
    if (courseId) {
      // Invalidate keys for specific course (all users)
      // Note: This requires the registry to track course-specific keys
      return invalidateCacheByPrefix(`docs:course:${courseId}`);
    }
    return invalidateCacheByPrefix('docs');
  },

  /**
   * Invalidate vector search cache
   */
  vectorSearch: async (): Promise<number> => {
    return invalidateCacheByPrefix('vector-search');
  },

  /**
   * Invalidate query embeddings cache
   */
  queryEmbeddings: async (): Promise<number> => {
    return invalidateCacheByPrefix('query-embedding');
  },

  /**
   * Invalidate synthesized answers cache
   */
  synthesizedAnswers: async (): Promise<number> => {
    return invalidateCacheByPrefix('synth-answer');
  },

  /**
   * Invalidate all public API caches
   * Use with caution - clears everything
   */
  all: async (): Promise<{ total: number; details: Record<string, number> }> => {
    const results = await Promise.all([
      CacheInvalidation.faq(),
      CacheInvalidation.testimonials().then(() => 1),
      CacheInvalidation.glossary(),
      CacheInvalidation.legislativeActs(),
      CacheInvalidation.leiArticles(),
      CacheInvalidation.courseDocuments(),
      CacheInvalidation.vectorSearch(),
      CacheInvalidation.queryEmbeddings(),
      CacheInvalidation.synthesizedAnswers(),
    ]);

    const details = {
      faq: results[0],
      testimonials: results[1],
      glossary: results[2],
      legislativeActs: results[3],
      leiArticles: results[4],
      courseDocuments: results[5],
      vectorSearch: results[6],
      queryEmbeddings: results[7],
      synthesizedAnswers: results[8],
    };

    const total = results.reduce((sum, count) => sum + count, 0);
    console.log(`🗑️ Invalidated ${total} cache entries total`);

    return { total, details };
  },
};

/**
 * Check if caching is enabled
 */
export function isCacheEnabled(): boolean {
  return !DISABLE_CACHE && redis !== null;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  enabled: boolean;
  connected: boolean;
  registeredPrefixes: { prefix: string; count: number }[];
}> {
  const health = await healthCheck();

  const prefixes = ['faq', 'glossary', 'acts', 'lei', 'docs'];
  const registeredPrefixes: { prefix: string; count: number }[] = [];

  for (const prefix of prefixes) {
    const keys = await getRegisteredKeys(prefix);
    registeredPrefixes.push({ prefix, count: keys.length });
  }

  return {
    enabled: isCacheEnabled(),
    connected: health.connected,
    registeredPrefixes,
  };
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
  // Registry functions
  registerCacheKey,
  getRegisteredKeys,
  invalidateCacheByPrefix,
  // Invalidation helpers
  CacheInvalidation,
  // Utility
  isCacheEnabled,
  getCacheStats,
};
