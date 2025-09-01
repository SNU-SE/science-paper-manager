import { HealthService } from '../HealthService'
import { NotificationService } from '../../notifications/NotificationService'

// Mock external dependencies
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data: [{ count: 1 }], error: null }))
    }))
  })),
  rpc: jest.fn(() => Promise.resolve({ data: 'test', error: null }))
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(() => Promise.resolve('OK')),
    get: jest.fn(() => Promise.resolve('test')),
    del: jest.fn(() => Promise.resolve(1)),
    info: jest.fn(() => Promise.resolve('used_memory:1000000\nused_memory_human:976.56K')),
    disconnect: jest.fn()
  }))
})

jest.mock('../../notifications/NotificationService')

// Mock fetch for external API checks
global.fetch = jest.fn()

describe('Health System Integration', () => {
  let healthService: HealthService
  let mockNotificationService: jest.Mocked<NotificationService>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Create health service with test configuration
    const config = HealthService.createDefaultConfig()
    config.resourceMonitoring.interval = 100 // Fast interval for testing
    config.autoRecovery.checkInterval = 200 // Fast interval for testing
    
    healthService = new HealthService(config)
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>
  })

  afterEach(async () => {
    await healthService.stop()
  })

  describe('Service Lifecycle', () => {
    it('should start and stop health service successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      await healthService.start()
      await healthService.stop()
      
      expect(consoleSpy).toHaveBeenCalledWith('Starting Health Service...')
      expect(consoleSpy).toHaveBeenCalledWith('Health Service started successfully')
      expect(consoleSpy).toHaveBeenCalledWith('Stopping Health Service...')
      expect(consoleSpy).toHaveBeenCalledWith('Health Service stopped')
      
      consoleSpy.mockRestore()
    })

    it('should perform initial health check on start', async () => {
      // Mock successful responses
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      })

      await healthService.start()
      
      const systemHealth = await healthService.getSystemHealth()
      expect(systemHealth).toBeTruthy()
      expect(systemHealth.services.length).toBeGreaterThan(0)
    })
  })

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      // Mock successful external API responses
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      })
      
      await healthService.start()
    })

    it('should collect system health data', async () => {
      const systemHealth = await healthService.getSystemHealth()
      
      expect(systemHealth.overall).toMatch(/^(healthy|degraded|unhealthy)$/)
      expect(systemHealth.services).toBeInstanceOf(Array)
      expect(systemHealth.timestamp).toBeTruthy()
      expect(systemHealth.uptime).toBeGreaterThan(0)
    })

    it('should track resource metrics', async () => {
      // Wait for resource monitoring to collect metrics
      await new Promise(resolve => setTimeout(resolve, 150))
      
      const resourceMetrics = healthService.getCurrentResourceMetrics()
      
      if (resourceMetrics) {
        expect(resourceMetrics.memory).toBeTruthy()
        expect(resourceMetrics.cpu).toBeTruthy()
        expect(resourceMetrics.process).toBeTruthy()
        expect(resourceMetrics.eventLoop).toBeTruthy()
      }
    })

    it('should maintain resource history', async () => {
      // Wait for multiple metric collections
      await new Promise(resolve => setTimeout(resolve, 250))
      
      const history = healthService.getResourceHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('should detect and report resource alerts', async () => {
      const alerts = healthService.getActiveResourceAlerts()
      expect(Array.isArray(alerts)).toBe(true)
    })
  })

  describe('Service Status Monitoring', () => {
    beforeEach(async () => {
      await healthService.start()
    })

    it('should check individual service status', async () => {
      // Mock successful database response
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [{ count: 1 }], error: null }))
        }))
      })

      const dbStatus = await healthService.getServiceStatus('database')
      
      if (dbStatus) {
        expect(dbStatus.service).toBe('database')
        expect(dbStatus.status).toMatch(/^(healthy|degraded|unhealthy)$/)
        expect(dbStatus.lastCheck).toBeTruthy()
      }
    })

    it('should handle service failures gracefully', async () => {
      // Mock database failure
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') }))
        }))
      })

      const systemHealth = await healthService.getSystemHealth()
      const dbService = systemHealth.services.find(s => s.service === 'database')
      
      expect(dbService?.status).toBe('unhealthy')
      expect(dbService?.error).toBeTruthy()
    })
  })

  describe('Recovery System', () => {
    beforeEach(async () => {
      await healthService.start()
    })

    it('should track recovery statistics', async () => {
      const recoveryStats = healthService.getRecoveryStats()
      
      expect(recoveryStats).toHaveProperty('totalAttempts')
      expect(recoveryStats).toHaveProperty('successfulAttempts')
      expect(recoveryStats).toHaveProperty('failedAttempts')
      expect(recoveryStats).toHaveProperty('actionStats')
    })

    it('should maintain recovery history', async () => {
      const recoveryHistory = healthService.getRecoveryHistory()
      expect(recoveryHistory).toBeInstanceOf(Map)
    })
  })

  describe('Resource Summary', () => {
    beforeEach(async () => {
      await healthService.start()
      // Wait for some metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    it('should generate resource summary', async () => {
      const summary = healthService.getResourceSummary()
      
      expect(summary).toHaveProperty('average')
      expect(summary).toHaveProperty('peak')
      expect(summary).toHaveProperty('alertCount')
      expect(typeof summary.alertCount).toBe('number')
    })

    it('should handle custom time ranges', async () => {
      const summary = healthService.getResourceSummary(60000) // 1 minute
      
      expect(summary).toHaveProperty('average')
      expect(summary).toHaveProperty('peak')
      expect(summary).toHaveProperty('alertCount')
    })
  })

  describe('Error Handling', () => {
    it('should handle health service initialization errors gracefully', async () => {
      // Mock a configuration that would cause errors
      const badConfig = HealthService.createDefaultConfig()
      badConfig.healthCheck.database.timeout = -1 // Invalid timeout
      
      const badHealthService = new HealthService(badConfig)
      
      // Should not throw during start
      await expect(badHealthService.start()).resolves.not.toThrow()
      
      await badHealthService.stop()
    })

    it('should continue operating when individual checks fail', async () => {
      // Mock Redis failure
      const Redis = require('ioredis')
      const mockRedis = new Redis()
      mockRedis.set.mockRejectedValue(new Error('Redis down'))
      
      // Mock successful database
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [{ count: 1 }], error: null }))
        }))
      })
      
      // Mock successful external API
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200
      })

      await healthService.start()
      const systemHealth = await healthService.getSystemHealth()
      
      // Should still return health data even with Redis failure
      expect(systemHealth).toBeTruthy()
      expect(systemHealth.services.length).toBeGreaterThan(0)
      
      // Redis service should be marked as unhealthy
      const redisService = systemHealth.services.find(s => s.service === 'redis')
      expect(redisService?.status).toBe('unhealthy')
    })
  })

  describe('Configuration', () => {
    it('should create valid default configuration', () => {
      const config = HealthService.createDefaultConfig()
      
      expect(config.healthCheck).toBeTruthy()
      expect(config.autoRecovery).toBeTruthy()
      expect(config.resourceMonitoring).toBeTruthy()
      
      expect(config.healthCheck.database.enabled).toBe(true)
      expect(config.healthCheck.redis.enabled).toBe(true)
      expect(config.autoRecovery.enabled).toBe(true)
      expect(config.resourceMonitoring.enabled).toBe(true)
    })

    it('should respect configuration settings', async () => {
      const config = HealthService.createDefaultConfig()
      config.healthCheck.redis.enabled = false
      config.resourceMonitoring.enabled = false
      
      const customHealthService = new HealthService(config)
      await customHealthService.start()
      
      const systemHealth = await customHealthService.getSystemHealth()
      
      // Should not include Redis service when disabled
      const redisService = systemHealth.services.find(s => s.service === 'redis')
      expect(redisService).toBeUndefined()
      
      await customHealthService.stop()
    })
  })
})