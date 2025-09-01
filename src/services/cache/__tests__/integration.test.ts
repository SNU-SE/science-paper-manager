import { CacheService } from '../CacheService'
import CacheMonitor from '../CacheMonitor'
import { cacheQuery, cacheUserData, invalidateUserCache } from '../../../utils/cache'
import Redis from 'ioredis'

// Integration tests for the complete caching system
describe('Cache System Integration', () => {
  let cacheService: CacheService
  let cacheMonitor: CacheMonitor
  let redis: Redis

  beforeAll(async () => {
    // Use test Redis instance
    const redisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
    redis = new Redis(redisUrl)
    cacheService = new CacheService(redisUrl)
    cacheMonitor = new CacheMonitor(cacheService)
  })

  afterAll(async () => {
    await cacheService.clear()
    await redis.quit()
    cacheMonitor.stopMonitoring()
  })

  beforeEach(async () => {
    await cacheService.clear()
  })

  describe('Multi-layer caching', () => {
    it('should cache data in both local and Redis layers', async () => {
      const testData = { id: 1, name: 'Test User' }
      
      // Set data
      await cacheService.set('user:1', testData, { ttl: 300 })
      
      // Verify it's in Redis
      const redisValue = await redis.get('user:1')
      expect(JSON.parse(redisValue!)).toEqual(testData)
      
      // Verify it's in local cache by checking stats
      const stats1 = cacheService.getStats()
      await cacheService.get('user:1')
      const stats2 = cacheService.getStats()
      
      expect(stats2.localHits).toBe(stats1.localHits + 1)
    })

    it('should fall back to Redis when local cache misses', async () => {
      const testData = { id: 2, name: 'Test User 2' }
      
      // Set directly in Redis
      await redis.set('user:2', JSON.stringify(testData))
      
      // Get through cache service (should hit Redis)
      const result = await cacheService.get('user:2')
      expect(result).toEqual(testData)
      
      // Verify Redis hit was recorded
      const stats = cacheService.getStats()
      expect(stats.redisHits).toBeGreaterThan(0)
    })
  })

  describe('Cache compression', () => {
    it('should compress large values automatically', async () => {
      const largeData = {
        content: 'x'.repeat(2000), // Larger than compression threshold
        metadata: { size: 'large' }
      }
      
      await cacheService.set('large-data', largeData, { ttl: 300 })
      
      // Check that Redis value is compressed
      const redisValue = await redis.get('large-data')
      expect(redisValue).toMatch(/^COMPRESSED:/)
      
      // Verify we can still retrieve the original data
      const retrieved = await cacheService.get('large-data')
      expect(retrieved).toEqual(largeData)
    })

    it('should handle compression option explicitly', async () => {
      const smallData = { id: 1, name: 'Small' }
      
      await cacheService.set('small-data', smallData, { 
        ttl: 300, 
        compress: true 
      })
      
      const redisValue = await redis.get('small-data')
      expect(redisValue).toMatch(/^COMPRESSED:/)
      
      const retrieved = await cacheService.get('small-data')
      expect(retrieved).toEqual(smallData)
    })
  })

  describe('Cache tags and invalidation', () => {
    it('should invalidate cache by tags', async () => {
      const userData1 = { id: 1, name: 'User 1' }
      const userData2 = { id: 2, name: 'User 2' }
      const paperData = { id: 1, title: 'Paper 1' }
      
      // Set data with tags
      await cacheService.set('user:1:profile', userData1, { 
        ttl: 300, 
        tags: ['user:1', 'users'] 
      })
      await cacheService.set('user:2:profile', userData2, { 
        ttl: 300, 
        tags: ['user:2', 'users'] 
      })
      await cacheService.set('paper:1:details', paperData, { 
        ttl: 300, 
        tags: ['paper:1', 'papers'] 
      })
      
      // Invalidate by user tag
      const deletedCount = await cacheService.invalidateByTags(['users'])
      expect(deletedCount).toBe(2)
      
      // Verify user data is gone but paper data remains
      expect(await cacheService.get('user:1:profile')).toBeNull()
      expect(await cacheService.get('user:2:profile')).toBeNull()
      expect(await cacheService.get('paper:1:details')).toEqual(paperData)
    })

    it('should invalidate cache by patterns', async () => {
      await cacheService.set('user:1:profile', { id: 1 }, { ttl: 300 })
      await cacheService.set('user:1:settings', { theme: 'dark' }, { ttl: 300 })
      await cacheService.set('user:2:profile', { id: 2 }, { ttl: 300 })
      await cacheService.set('paper:1:analysis', { score: 0.8 }, { ttl: 300 })
      
      // Invalidate all user:1 data
      const deletedCount = await cacheService.invalidatePattern('user:1:*')
      expect(deletedCount).toBe(2)
      
      // Verify correct data was deleted
      expect(await cacheService.get('user:1:profile')).toBeNull()
      expect(await cacheService.get('user:1:settings')).toBeNull()
      expect(await cacheService.get('user:2:profile')).toEqual({ id: 2 })
      expect(await cacheService.get('paper:1:analysis')).toEqual({ score: 0.8 })
    })
  })

  describe('Cache monitoring', () => {
    it('should track cache metrics accurately', async () => {
      cacheMonitor.startMonitoring(100) // Fast monitoring for testing
      
      // Generate some cache activity
      await cacheService.set('test:1', { data: 'test1' }, { ttl: 300 })
      await cacheService.set('test:2', { data: 'test2' }, { ttl: 300 })
      
      // Generate hits and misses
      await cacheService.get('test:1') // Hit
      await cacheService.get('test:1') // Local hit
      await cacheService.get('nonexistent') // Miss
      
      // Record key access for monitoring
      cacheMonitor.recordKeyAccess('test:1')
      cacheMonitor.recordKeyAccess('test:1')
      cacheMonitor.recordKeyAccess('test:2')
      
      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.hitRate).toBeGreaterThan(0)
      expect(metrics.hotKeys).toContainEqual({
        key: 'test:1',
        accessCount: 2
      })
      
      cacheMonitor.stopMonitoring()
    })

    it('should generate performance alerts', async () => {
      // Simulate poor performance
      cacheMonitor.recordResponseTime(150) // High response time
      cacheMonitor.recordResponseTime(200)
      
      // Trigger analysis manually
      const analyzePerformance = (cacheMonitor as any).analyzePerformance.bind(cacheMonitor)
      analyzePerformance()
      
      const alerts = cacheMonitor.getAlerts(10)
      const performanceAlert = alerts.find(alert => 
        alert.type === 'performance' && alert.message.includes('response time')
      )
      
      expect(performanceAlert).toBeDefined()
      expect(performanceAlert?.severity).toBe('medium')
    })
  })

  describe('Utility functions', () => {
    it('should cache query results', async () => {
      let callCount = 0
      const queryFn = jest.fn().mockImplementation(async () => {
        callCount++
        return { id: 1, data: `result-${callCount}` }
      })
      
      // First call should execute query
      const result1 = await cacheQuery('query:test', queryFn, { ttl: 300 })
      expect(result1).toEqual({ id: 1, data: 'result-1' })
      expect(queryFn).toHaveBeenCalledTimes(1)
      
      // Second call should use cache
      const result2 = await cacheQuery('query:test', queryFn, { ttl: 300 })
      expect(result2).toEqual({ id: 1, data: 'result-1' }) // Same result
      expect(queryFn).toHaveBeenCalledTimes(1) // Not called again
    })

    it('should cache user-specific data', async () => {
      const userData = { id: 123, name: 'Test User', email: 'test@example.com' }
      const dataFn = jest.fn().mockResolvedValue(userData)
      
      const result = await cacheUserData('123', 'profile', dataFn, 300)
      expect(result).toEqual(userData)
      
      // Verify it was cached with correct key
      const cached = await cacheService.get('user:123:profile')
      expect(cached).toEqual(userData)
    })

    it('should invalidate user cache correctly', async () => {
      // Set up user data
      await cacheService.set('user:123:profile', { id: 123 }, { 
        ttl: 300, 
        tags: ['user:123'] 
      })
      await cacheService.set('user:123:settings', { theme: 'dark' }, { 
        ttl: 300, 
        tags: ['user:123'] 
      })
      
      // Invalidate user cache
      await invalidateUserCache('123')
      
      // Verify data is gone
      expect(await cacheService.get('user:123:profile')).toBeNull()
      expect(await cacheService.get('user:123:settings')).toBeNull()
    })
  })

  describe('Batch operations', () => {
    it('should perform batch get operations efficiently', async () => {
      const testData = {
        'key1': { id: 1, name: 'Item 1' },
        'key2': { id: 2, name: 'Item 2' },
        'key3': { id: 3, name: 'Item 3' }
      }
      
      // Set up test data
      for (const [key, value] of Object.entries(testData)) {
        await cacheService.set(key, value, { ttl: 300 })
      }
      
      // Batch get
      const results = await cacheService.mget(['key1', 'key2', 'key3', 'nonexistent'])
      
      expect(results.get('key1')).toEqual(testData.key1)
      expect(results.get('key2')).toEqual(testData.key2)
      expect(results.get('key3')).toEqual(testData.key3)
      expect(results.get('nonexistent')).toBeNull()
    })
  })

  describe('Cache warm-up', () => {
    it('should warm up cache with provided data', async () => {
      const warmUpData = [
        {
          key: 'warm:1',
          factory: jest.fn().mockResolvedValue({ id: 1, warmed: true }),
          options: { ttl: 300 }
        },
        {
          key: 'warm:2',
          factory: jest.fn().mockResolvedValue({ id: 2, warmed: true }),
          options: { ttl: 600 }
        }
      ]
      
      await cacheService.warmUp(warmUpData)
      
      // Verify data was cached
      expect(await cacheService.get('warm:1')).toEqual({ id: 1, warmed: true })
      expect(await cacheService.get('warm:2')).toEqual({ id: 2, warmed: true })
      
      // Verify factories were called
      expect(warmUpData[0].factory).toHaveBeenCalled()
      expect(warmUpData[1].factory).toHaveBeenCalled()
    })

    it('should skip warm-up for existing keys', async () => {
      // Pre-populate cache
      await cacheService.set('existing:key', { existing: true }, { ttl: 300 })
      
      const warmUpData = [
        {
          key: 'existing:key',
          factory: jest.fn().mockResolvedValue({ id: 1, warmed: true })
        }
      ]
      
      await cacheService.warmUp(warmUpData)
      
      // Factory should not have been called
      expect(warmUpData[0].factory).not.toHaveBeenCalled()
      
      // Original data should remain
      expect(await cacheService.get('existing:key')).toEqual({ existing: true })
    })
  })

  describe('Health checks', () => {
    it('should report healthy status when everything works', async () => {
      const health = await cacheService.healthCheck()
      
      expect(health.status).toBe('healthy')
      expect(health.details.redis).toBe('connected')
      expect(health.details.localCache).toBe('operational')
      expect(health.details.stats).toBeDefined()
    })
  })

  describe('TTL and expiration', () => {
    it('should respect TTL settings', async () => {
      await cacheService.set('short-lived', { data: 'test' }, { ttl: 1 }) // 1 second
      
      // Should be available immediately
      expect(await cacheService.get('short-lived')).toEqual({ data: 'test' })
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      // Should be expired in Redis (but might still be in local cache)
      const redisValue = await redis.get('short-lived')
      expect(redisValue).toBeNull()
    })
  })
})