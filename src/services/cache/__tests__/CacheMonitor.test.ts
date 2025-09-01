import CacheMonitor from '../CacheMonitor'
import { CacheService } from '../CacheService'

// Mock CacheService
jest.mock('../CacheService')
const MockedCacheService = CacheService as jest.MockedClass<typeof CacheService>

describe('CacheMonitor', () => {
  let cacheMonitor: CacheMonitor
  let mockCacheService: jest.Mocked<CacheService>

  beforeEach(() => {
    mockCacheService = {
      getStats: jest.fn(),
      healthCheck: jest.fn()
    } as any

    MockedCacheService.mockImplementation(() => mockCacheService)
    cacheMonitor = new CacheMonitor(mockCacheService)
  })

  afterEach(() => {
    cacheMonitor.stopMonitoring()
    jest.clearAllMocks()
  })

  describe('recordKeyAccess', () => {
    it('should track key access counts', () => {
      cacheMonitor.recordKeyAccess('test-key')
      cacheMonitor.recordKeyAccess('test-key')
      cacheMonitor.recordKeyAccess('another-key')

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.hotKeys).toContainEqual({
        key: 'test-key',
        accessCount: 2
      })
      expect(metrics.hotKeys).toContainEqual({
        key: 'another-key',
        accessCount: 1
      })
    })
  })

  describe('recordResponseTime', () => {
    it('should track response times', () => {
      cacheMonitor.recordResponseTime(50)
      cacheMonitor.recordResponseTime(100)
      cacheMonitor.recordResponseTime(75)

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.averageResponseTime).toBe(75) // (50 + 100 + 75) / 3
    })

    it('should limit response time history', () => {
      // Add more than 1000 measurements
      for (let i = 0; i < 1200; i++) {
        cacheMonitor.recordResponseTime(i)
      }

      const metrics = cacheMonitor.getMetrics()
      
      // Should only keep last 1000 measurements
      expect(metrics.averageResponseTime).toBeGreaterThan(600) // Average of last 1000 should be > 600
    })
  })

  describe('getMetrics', () => {
    beforeEach(() => {
      mockCacheService.getStats.mockReturnValue({
        hits: 80,
        misses: 20,
        sets: 50,
        deletes: 10,
        localHits: 60,
        redisHits: 20,
        totalKeys: 100,
        memoryUsage: 1024 * 1024 // 1MB
      })
    })

    it('should calculate hit rate correctly', () => {
      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.hitRate).toBe(80) // 80 hits out of 100 total requests
      expect(metrics.missRate).toBe(20) // 20 misses out of 100 total requests
    })

    it('should calculate local and Redis hit rates', () => {
      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.localHitRate).toBe(75) // 60 local hits out of 80 total hits
      expect(metrics.redisHitRate).toBe(25) // 20 Redis hits out of 80 total hits
    })

    it('should handle zero requests gracefully', () => {
      mockCacheService.getStats.mockReturnValue({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        localHits: 0,
        redisHits: 0,
        totalKeys: 0,
        memoryUsage: 0
      })

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.hitRate).toBe(0)
      expect(metrics.missRate).toBe(0)
      expect(metrics.localHitRate).toBe(0)
      expect(metrics.redisHitRate).toBe(0)
    })

    it('should return key distribution', () => {
      cacheMonitor.recordKeyAccess('user:123:profile')
      cacheMonitor.recordKeyAccess('user:456:profile')
      cacheMonitor.recordKeyAccess('paper:789:analysis')
      cacheMonitor.recordKeyAccess('search:query1')

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.keyDistribution).toEqual({
        user: 2,
        paper: 1,
        search: 1
      })
    })

    it('should return hot keys sorted by access count', () => {
      cacheMonitor.recordKeyAccess('key1')
      cacheMonitor.recordKeyAccess('key2')
      cacheMonitor.recordKeyAccess('key2')
      cacheMonitor.recordKeyAccess('key3')
      cacheMonitor.recordKeyAccess('key3')
      cacheMonitor.recordKeyAccess('key3')

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.hotKeys[0]).toEqual({ key: 'key3', accessCount: 3 })
      expect(metrics.hotKeys[1]).toEqual({ key: 'key2', accessCount: 2 })
      expect(metrics.hotKeys[2]).toEqual({ key: 'key1', accessCount: 1 })
    })

    it('should generate recommendations based on metrics', () => {
      // Set up low hit rate scenario
      mockCacheService.getStats.mockReturnValue({
        hits: 30,
        misses: 70,
        sets: 50,
        deletes: 10,
        localHits: 20,
        redisHits: 10,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      const metrics = cacheMonitor.getMetrics()
      
      expect(metrics.recommendations).toContain('Consider increasing cache TTL for frequently accessed data')
      expect(metrics.recommendations).toContain('Review cache key patterns and implement cache warming')
    })
  })

  describe('getHealthScore', () => {
    beforeEach(() => {
      mockCacheService.getStats.mockReturnValue({
        hits: 85,
        misses: 15,
        sets: 50,
        deletes: 10,
        localHits: 60,
        redisHits: 25,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })
    })

    it('should return high score for good performance', () => {
      cacheMonitor.recordResponseTime(10) // Good response time
      
      const score = cacheMonitor.getHealthScore()
      
      expect(score).toBeGreaterThan(80)
    })

    it('should penalize low hit rate', () => {
      mockCacheService.getStats.mockReturnValue({
        hits: 30,
        misses: 70,
        sets: 50,
        deletes: 10,
        localHits: 20,
        redisHits: 10,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      const score = cacheMonitor.getHealthScore()
      
      expect(score).toBeLessThan(70) // Should be penalized for low hit rate
    })

    it('should penalize high response times', () => {
      cacheMonitor.recordResponseTime(200) // High response time
      
      const score = cacheMonitor.getHealthScore()
      
      expect(score).toBeLessThan(80) // Should be penalized for high response time
    })
  })

  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring', (done) => {
      const originalSetInterval = global.setInterval
      const originalClearInterval = global.clearInterval
      
      let intervalId: NodeJS.Timeout | null = null
      let intervalCleared = false

      global.setInterval = jest.fn().mockImplementation((callback, ms) => {
        intervalId = originalSetInterval(callback, ms)
        return intervalId
      })

      global.clearInterval = jest.fn().mockImplementation((id) => {
        intervalCleared = true
        return originalClearInterval(id)
      })

      cacheMonitor.startMonitoring(100) // 100ms interval for testing
      
      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 100)
      
      setTimeout(() => {
        cacheMonitor.stopMonitoring()
        expect(intervalCleared).toBe(true)
        
        // Restore original functions
        global.setInterval = originalSetInterval
        global.clearInterval = originalClearInterval
        
        done()
      }, 50)
    })
  })

  describe('optimizeCache', () => {
    it('should provide optimization recommendations', async () => {
      mockCacheService.getStats.mockReturnValue({
        hits: 40,
        misses: 60,
        sets: 50,
        deletes: 10,
        localHits: 30,
        redisHits: 10,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      cacheMonitor.recordResponseTime(80) // High response time

      const optimization = await cacheMonitor.optimizeCache()
      
      expect(optimization.recommendations).toContain('Consider increasing local cache size')
      expect(optimization.recommendations).toContain('Review TTL settings for frequently accessed keys')
    })

    it('should recommend hot key optimization', async () => {
      mockCacheService.getStats.mockReturnValue({
        hits: 80,
        misses: 20,
        sets: 50,
        deletes: 10,
        localHits: 60,
        redisHits: 20,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      // Create a hot key
      for (let i = 0; i < 1500; i++) {
        cacheMonitor.recordKeyAccess('very-hot-key')
      }

      const optimization = await cacheMonitor.optimizeCache()
      
      expect(optimization.recommendations).toContain('Consider pre-warming hot key: very-hot-key')
    })
  })

  describe('getAlerts', () => {
    it('should return alerts sorted by timestamp', () => {
      // Trigger some alerts by setting up poor performance
      mockCacheService.getStats.mockReturnValue({
        hits: 20,
        misses: 80,
        sets: 50,
        deletes: 10,
        localHits: 15,
        redisHits: 5,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      cacheMonitor.recordResponseTime(150) // High response time

      // Manually trigger analysis (normally done by monitoring interval)
      const analyzePerformance = (cacheMonitor as any).analyzePerformance.bind(cacheMonitor)
      analyzePerformance()

      const alerts = cacheMonitor.getAlerts(10)
      
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].timestamp).toBeInstanceOf(Date)
      
      // Check that alerts are sorted by timestamp (newest first)
      if (alerts.length > 1) {
        expect(alerts[0].timestamp.getTime()).toBeGreaterThanOrEqual(alerts[1].timestamp.getTime())
      }
    })

    it('should limit number of returned alerts', () => {
      // Generate multiple alerts
      mockCacheService.getStats.mockReturnValue({
        hits: 10,
        misses: 90,
        sets: 50,
        deletes: 10,
        localHits: 8,
        redisHits: 2,
        totalKeys: 100,
        memoryUsage: 1024 * 1024
      })

      // Trigger analysis multiple times to generate alerts
      const analyzePerformance = (cacheMonitor as any).analyzePerformance.bind(cacheMonitor)
      for (let i = 0; i < 5; i++) {
        analyzePerformance()
      }

      const alerts = cacheMonitor.getAlerts(2)
      
      expect(alerts.length).toBeLessThanOrEqual(2)
    })
  })
})