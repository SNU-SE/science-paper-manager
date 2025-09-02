import { LRUCache } from 'lru-cache'
import crypto from 'crypto'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  localTtl?: number // Local cache TTL in milliseconds
  compress?: boolean
  tags?: string[]
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  localHits: number
  redisHits: number
  totalKeys: number
  memoryUsage: number
}

export interface CachePattern {
  pattern: string
  description: string
  ttl: number
}

export class CacheService {
  private redis: any
  private localCache: LRUCache<string, any>
  private stats: CacheStats
  private patterns: Map<string, CachePattern>
  private compressionThreshold: number = 1024 // bytes
  private redisInitialized = false

  constructor(redisUrl?: string) {
    this.redis = null
    
    // Local L1 cache configuration
    this.localCache = new LRUCache({
      max: 1000, // Maximum number of items
      ttl: 5 * 60 * 1000, // 5 minutes default TTL
      updateAgeOnGet: true,
      allowStale: false
    })

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      localHits: 0,
      redisHits: 0,
      totalKeys: 0,
      memoryUsage: 0
    }

    this.patterns = new Map()
    this.initializeCommonPatterns()
    this.initializeRedis(redisUrl)
  }

  private async initializeRedis(redisUrl?: string) {
    if (this.redisInitialized) return
    
    try {
      // Completely prevent Redis import during build/static generation
      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                         process.env.NODE_ENV !== 'production' ||
                         typeof window !== 'undefined' ||
                         !process.env.VERCEL_ENV ||
                         process.env.VERCEL_ENV !== 'production'

      if (isBuildTime) {
        const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
        this.redis = new MockRedis()
        this.redisInitialized = true
        return
      }

      // Only import real Redis in production runtime with valid Redis URL
      if (process.env.REDIS_URL && typeof process.env.REDIS_URL === 'string') {
        const Redis = (await import('ioredis')).default
        this.redis = new Redis(redisUrl || process.env.REDIS_URL)
      } else {
        // Fallback to mock if no Redis URL
        const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
        this.redis = new MockRedis()
      }
      this.redisInitialized = true
    } catch (error) {
      console.warn('Redis initialization failed in CacheService, using mock:', error)
      const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
      this.redis = new MockRedis()
      this.redisInitialized = true
    }
  }

  private initializeCommonPatterns(): void {
    const commonPatterns: CachePattern[] = [
      { pattern: 'user:*:profile', description: 'User profile data', ttl: 3600 },
      { pattern: 'paper:*:analysis', description: 'AI analysis results', ttl: 86400 },
      { pattern: 'search:*', description: 'Search results', ttl: 1800 },
      { pattern: 'api:*:usage', description: 'API usage metrics', ttl: 300 },
      { pattern: 'health:*', description: 'Health check results', ttl: 60 },
      { pattern: 'notifications:*', description: 'User notifications', ttl: 3600 }
    ]

    commonPatterns.forEach(pattern => {
      this.patterns.set(pattern.pattern, pattern)
    })
  }

  /**
   * Get value from cache with multi-layer lookup
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // L1: Check local memory cache first
      const localValue = this.localCache.get(key)
      if (localValue !== undefined) {
        this.stats.hits++
        this.stats.localHits++
        return localValue
      }

      // L2: Check Redis cache
      const redisValue = await this.redis.get(key)
      if (redisValue !== null) {
        let parsedValue: T
        
        // Handle compressed data
        if (redisValue.startsWith('COMPRESSED:')) {
          const compressed = redisValue.substring(11)
          const decompressed = await this.decompress(compressed)
          parsedValue = JSON.parse(decompressed)
        } else {
          parsedValue = JSON.parse(redisValue)
        }

        // Store in local cache for faster subsequent access
        this.localCache.set(key, parsedValue)
        
        this.stats.hits++
        this.stats.redisHits++
        return parsedValue
      }

      this.stats.misses++
      return null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      this.stats.misses++
      return null
    }
  }

  /**
   * Set value in cache with automatic compression and TTL
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      const ttl = options.ttl || this.getTTLForPattern(key)
      
      // Store in local cache
      this.localCache.set(key, value, { ttl: options.localTtl || 5 * 60 * 1000 })

      // Determine if compression is needed
      let redisValue = serialized
      if (options.compress || serialized.length > this.compressionThreshold) {
        const compressed = await this.compress(serialized)
        redisValue = `COMPRESSED:${compressed}`
      }

      // Store in Redis with TTL
      if (ttl > 0) {
        await this.redis.setex(key, ttl, redisValue)
      } else {
        await this.redis.set(key, redisValue)
      }

      // Handle cache tags for smart invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(key, options.tags)
      }

      this.stats.sets++
      this.updateMemoryUsage()
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
      throw error
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Remove from local cache
      this.localCache.delete(key)
      
      // Remove from Redis
      const result = await this.redis.del(key)
      
      this.stats.deletes++
      this.updateMemoryUsage()
      
      return result > 0
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Smart cache invalidation using patterns
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0

      // Invalidate from Redis using pattern matching
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        deletedCount += keys.length
      }

      // Invalidate from local cache
      this.localCache.forEach((value, key) => {
        if (this.matchesPattern(key, pattern)) {
          this.localCache.delete(key)
          deletedCount++
        }
      })

      this.stats.deletes += deletedCount
      this.updateMemoryUsage()
      
      return deletedCount
    } catch (error) {
      console.error(`Cache pattern invalidation error for pattern ${pattern}:`, error)
      return 0
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0

      for (const tag of tags) {
        const tagKey = `tag:${tag}`
        const keys = await this.redis.smembers(tagKey)
        
        if (keys.length > 0) {
          // Delete the actual cache keys
          await this.redis.del(...keys)
          
          // Remove from local cache
          keys.forEach(key => this.localCache.delete(key))
          
          // Clean up the tag set
          await this.redis.del(tagKey)
          
          deletedCount += keys.length
        }
      }

      this.stats.deletes += deletedCount
      this.updateMemoryUsage()
      
      return deletedCount
    } catch (error) {
      console.error(`Cache tag invalidation error:`, error)
      return 0
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, options)
    return value
  }

  /**
   * Batch operations for better performance
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>()
    const redisKeys: string[] = []
    const redisKeyMap = new Map<string, string>()

    // Check local cache first
    for (const key of keys) {
      const localValue = this.localCache.get(key)
      if (localValue !== undefined) {
        results.set(key, localValue)
        this.stats.localHits++
      } else {
        redisKeys.push(key)
        redisKeyMap.set(key, key)
      }
    }

    // Batch fetch from Redis for remaining keys
    if (redisKeys.length > 0) {
      try {
        const redisValues = await this.redis.mget(...redisKeys)
        
        for (let i = 0; i < redisKeys.length; i++) {
          const key = redisKeys[i]
          const value = redisValues[i]
          
          if (value !== null) {
            let parsedValue: T
            
            if (value.startsWith('COMPRESSED:')) {
              const compressed = value.substring(11)
              const decompressed = await this.decompress(compressed)
              parsedValue = JSON.parse(decompressed)
            } else {
              parsedValue = JSON.parse(value)
            }
            
            results.set(key, parsedValue)
            this.localCache.set(key, parsedValue)
            this.stats.redisHits++
          } else {
            results.set(key, null)
            this.stats.misses++
          }
        }
      } catch (error) {
        console.error('Batch get error:', error)
        // Set remaining keys as null
        redisKeys.forEach(key => results.set(key, null))
      }
    }

    this.stats.hits += results.size - redisKeys.filter((_, i) => redisValues?.[i] === null).length
    return results
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      totalKeys: this.localCache.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.localCache.clear()
    await this.redis.flushdb()
    this.resetStats()
  }

  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(warmUpData: Array<{ key: string; factory: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    const promises = warmUpData.map(async ({ key, factory, options }) => {
      try {
        const exists = await this.redis.exists(key)
        if (!exists) {
          const value = await factory()
          await this.set(key, value, options)
        }
      } catch (error) {
        console.error(`Warm up failed for key ${key}:`, error)
      }
    })

    await Promise.allSettled(promises)
  }

  // Private helper methods

  private matchesPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }

  private getTTLForPattern(key: string): number {
    for (const [pattern, config] of this.patterns) {
      if (this.matchesPattern(key, pattern)) {
        return config.ttl
      }
    }
    return 3600 // Default 1 hour
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const tag of tags) {
      const tagKey = `tag:${tag}`
      pipeline.sadd(tagKey, key)
      pipeline.expire(tagKey, 86400) // Tags expire in 24 hours
    }
    
    await pipeline.exec()
  }

  private async compress(data: string): Promise<string> {
    const zlib = await import('zlib')
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(data), (err, compressed) => {
        if (err) reject(err)
        else resolve(compressed.toString('base64'))
      })
    })
  }

  private async decompress(data: string): Promise<string> {
    const zlib = await import('zlib')
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data, 'base64')
      zlib.gunzip(buffer, (err, decompressed) => {
        if (err) reject(err)
        else resolve(decompressed.toString())
      })
    })
  }

  private updateMemoryUsage(): void {
    // This is an estimation - in production you might want more accurate measurement
    this.stats.totalKeys = this.localCache.size
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage
    let size = 0
    this.localCache.forEach((value, key) => {
      size += key.length * 2 // UTF-16 characters
      size += JSON.stringify(value).length * 2
    })
    return size
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      localHits: 0,
      redisHits: 0,
      totalKeys: 0,
      memoryUsage: 0
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test Redis connection
      const testKey = 'health:check:' + Date.now()
      await this.redis.set(testKey, 'test', 'EX', 10)
      const testValue = await this.redis.get(testKey)
      await this.redis.del(testKey)

      if (testValue !== 'test') {
        throw new Error('Redis read/write test failed')
      }

      // Test local cache
      this.localCache.set('health:test', 'test')
      const localTest = this.localCache.get('health:test')
      this.localCache.delete('health:test')

      if (localTest !== 'test') {
        throw new Error('Local cache test failed')
      }

      return {
        status: 'healthy',
        details: {
          redis: 'connected',
          localCache: 'operational',
          stats: this.getStats()
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stats: this.getStats()
        }
      }
    }
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService()
  }
  return cacheServiceInstance
}

export default CacheService