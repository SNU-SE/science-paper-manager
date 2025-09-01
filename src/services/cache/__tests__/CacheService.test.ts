import { CacheService } from '../CacheService'
import Redis from 'ioredis'

// Mock Redis
jest.mock('ioredis')
const MockedRedis = Redis as jest.MockedClass<typeof Redis>

describe('CacheService', () => {
  let cacheService: CacheService
  let mockRedis: jest.Mocked<Redis>

  beforeEach(() => {
    // Reset mocks
    MockedRedis.mockClear()
    
    // Create mock Redis instance
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      type: jest.fn(),
      memory: jest.fn(),
      smembers: jest.fn(),
      sadd: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn(),
      flushdb: jest.fn(),
      quit: jest.fn()
    } as any

    // Mock pipeline
    const mockPipeline = {
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    }
    mockRedis.pipeline.mockReturnValue(mockPipeline as any)

    MockedRedis.mockImplementation(() => mockRedis)
    
    cacheService = new CacheService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('get', () => {
    it('should return value from local cache if available', async () => {
      // Set up local cache
      await cacheService.set('test-key', { data: 'test' })
      
      // Mock Redis to ensure it's not called
      mockRedis.get.mockResolvedValue(null)
      
      const result = await cacheService.get('test-key')
      
      expect(result).toEqual({ data: 'test' })
      expect(mockRedis.get).not.toHaveBeenCalled()
    })

    it('should return value from Redis if not in local cache', async () => {
      const testData = { data: 'redis-test' }
      mockRedis.get.mockResolvedValue(JSON.stringify(testData))
      
      const result = await cacheService.get('test-key')
      
      expect(result).toEqual(testData)
      expect(mockRedis.get).toHaveBeenCalledWith('test-key')
    })

    it('should handle compressed data from Redis', async () => {
      const testData = { data: 'compressed-test' }
      const compressed = 'COMPRESSED:' + Buffer.from(JSON.stringify(testData)).toString('base64')
      mockRedis.get.mockResolvedValue(compressed)
      
      // Mock compression/decompression
      const originalDecompress = (cacheService as any).decompress
      ;(cacheService as any).decompress = jest.fn().mockResolvedValue(JSON.stringify(testData))
      
      const result = await cacheService.get('test-key')
      
      expect(result).toEqual(testData)
      expect((cacheService as any).decompress).toHaveBeenCalled()
      
      // Restore original method
      ;(cacheService as any).decompress = originalDecompress
    })

    it('should return null if key not found', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      const result = await cacheService.get('non-existent-key')
      
      expect(result).toBeNull()
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'))
      
      const result = await cacheService.get('test-key')
      
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should store value in both local cache and Redis', async () => {
      const testData = { data: 'test' }
      mockRedis.setex.mockResolvedValue('OK')
      
      await cacheService.set('test-key', testData, { ttl: 300 })
      
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, JSON.stringify(testData))
      
      // Verify local cache
      const localResult = await cacheService.get('test-key')
      expect(localResult).toEqual(testData)
    })

    it('should compress large values', async () => {
      const largeData = { data: 'x'.repeat(2000) } // Larger than compression threshold
      mockRedis.setex.mockResolvedValue('OK')
      
      // Mock compression
      const originalCompress = (cacheService as any).compress
      ;(cacheService as any).compress = jest.fn().mockResolvedValue('compressed-data')
      
      await cacheService.set('test-key', largeData, { ttl: 300 })
      
      expect((cacheService as any).compress).toHaveBeenCalled()
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, 'COMPRESSED:compressed-data')
      
      // Restore original method
      ;(cacheService as any).compress = originalCompress
    })

    it('should handle cache tags', async () => {
      const testData = { data: 'test' }
      const tags = ['tag1', 'tag2']
      mockRedis.setex.mockResolvedValue('OK')
      
      await cacheService.set('test-key', testData, { ttl: 300, tags })
      
      expect(mockRedis.pipeline).toHaveBeenCalled()
    })

    it('should use default TTL if not specified', async () => {
      const testData = { data: 'test' }
      mockRedis.setex.mockResolvedValue('OK')
      
      await cacheService.set('user:123:profile', testData) // Should match user profile pattern
      
      expect(mockRedis.setex).toHaveBeenCalledWith('user:123:profile', 3600, JSON.stringify(testData))
    })
  })

  describe('delete', () => {
    it('should delete from both local cache and Redis', async () => {
      mockRedis.del.mockResolvedValue(1)
      
      const result = await cacheService.delete('test-key')
      
      expect(result).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('test-key')
    })

    it('should return false if key not found', async () => {
      mockRedis.del.mockResolvedValue(0)
      
      const result = await cacheService.delete('non-existent-key')
      
      expect(result).toBe(false)
    })
  })

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      const matchingKeys = ['user:123:profile', 'user:456:profile']
      mockRedis.keys.mockResolvedValue(matchingKeys)
      mockRedis.del.mockResolvedValue(2)
      
      const result = await cacheService.invalidatePattern('user:*:profile')
      
      expect(mockRedis.keys).toHaveBeenCalledWith('user:*:profile')
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys)
      expect(result).toBe(2)
    })

    it('should handle empty pattern matches', async () => {
      mockRedis.keys.mockResolvedValue([])
      
      const result = await cacheService.invalidatePattern('non-matching:*')
      
      expect(result).toBe(0)
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe('invalidateByTags', () => {
    it('should delete keys associated with tags', async () => {
      const taggedKeys = ['key1', 'key2']
      mockRedis.smembers.mockResolvedValue(taggedKeys)
      mockRedis.del.mockResolvedValue(2)
      
      const result = await cacheService.invalidateByTags(['tag1'])
      
      expect(mockRedis.smembers).toHaveBeenCalledWith('tag:tag1')
      expect(mockRedis.del).toHaveBeenCalledWith(...taggedKeys)
      expect(result).toBe(2)
    })
  })

  describe('getOrSet', () => {
    it('should return cached value if available', async () => {
      const cachedData = { data: 'cached' }
      await cacheService.set('test-key', cachedData)
      
      const factory = jest.fn().mockResolvedValue({ data: 'new' })
      
      const result = await cacheService.getOrSet('test-key', factory)
      
      expect(result).toEqual(cachedData)
      expect(factory).not.toHaveBeenCalled()
    })

    it('should call factory and cache result if not cached', async () => {
      const newData = { data: 'new' }
      const factory = jest.fn().mockResolvedValue(newData)
      mockRedis.get.mockResolvedValue(null)
      mockRedis.setex.mockResolvedValue('OK')
      
      const result = await cacheService.getOrSet('test-key', factory, { ttl: 300 })
      
      expect(result).toEqual(newData)
      expect(factory).toHaveBeenCalled()
      expect(mockRedis.setex).toHaveBeenCalled()
    })
  })

  describe('mget', () => {
    it('should batch fetch multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3']
      const values = [JSON.stringify({ data: '1' }), null, JSON.stringify({ data: '3' })]
      mockRedis.mget.mockResolvedValue(values)
      
      const result = await cacheService.mget(keys)
      
      expect(result.get('key1')).toEqual({ data: '1' })
      expect(result.get('key2')).toBeNull()
      expect(result.get('key3')).toEqual({ data: '3' })
      expect(mockRedis.mget).toHaveBeenCalledWith(...keys)
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      mockRedis.set.mockResolvedValue('OK')
      mockRedis.get.mockResolvedValue('test')
      mockRedis.del.mockResolvedValue(1)
      
      const result = await cacheService.healthCheck()
      
      expect(result.status).toBe('healthy')
      expect(result.details.redis).toBe('connected')
      expect(result.details.localCache).toBe('operational')
    })

    it('should return unhealthy status when Redis fails', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'))
      
      const result = await cacheService.healthCheck()
      
      expect(result.status).toBe('unhealthy')
      expect(result.details.error).toContain('Redis connection failed')
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cacheService.getStats()
      
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('sets')
      expect(stats).toHaveProperty('deletes')
      expect(stats).toHaveProperty('localHits')
      expect(stats).toHaveProperty('redisHits')
      expect(stats).toHaveProperty('totalKeys')
      expect(stats).toHaveProperty('memoryUsage')
    })
  })

  describe('clear', () => {
    it('should clear both local cache and Redis', async () => {
      mockRedis.flushdb.mockResolvedValue('OK')
      
      await cacheService.clear()
      
      expect(mockRedis.flushdb).toHaveBeenCalled()
    })
  })

  describe('warmUp', () => {
    it('should warm up cache with provided data', async () => {
      mockRedis.exists.mockResolvedValue(0) // Key doesn't exist
      mockRedis.setex.mockResolvedValue('OK')
      
      const warmUpData = [
        {
          key: 'warm-key',
          factory: jest.fn().mockResolvedValue({ data: 'warm' }),
          options: { ttl: 300 }
        }
      ]
      
      await cacheService.warmUp(warmUpData)
      
      expect(mockRedis.exists).toHaveBeenCalledWith('warm-key')
      expect(warmUpData[0].factory).toHaveBeenCalled()
      expect(mockRedis.setex).toHaveBeenCalled()
    })

    it('should skip warm up if key already exists', async () => {
      mockRedis.exists.mockResolvedValue(1) // Key exists
      
      const warmUpData = [
        {
          key: 'existing-key',
          factory: jest.fn().mockResolvedValue({ data: 'warm' })
        }
      ]
      
      await cacheService.warmUp(warmUpData)
      
      expect(warmUpData[0].factory).not.toHaveBeenCalled()
    })
  })
})