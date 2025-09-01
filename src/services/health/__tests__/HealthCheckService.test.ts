import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { HealthCheckService, HealthCheckConfig } from '../HealthCheckService'

// Mock dependencies
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

// Mock fetch for external API checks
global.fetch = jest.fn()

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService
  let config: HealthCheckConfig

  beforeEach(() => {
    config = {
      database: {
        enabled: true,
        timeout: 5000,
        criticalQueries: ['SELECT 1']
      },
      redis: {
        enabled: true,
        timeout: 3000
      },
      externalAPIs: {
        enabled: true,
        endpoints: [
          {
            name: 'test-api',
            url: 'https://api.test.com/health',
            timeout: 5000,
            critical: true
          }
        ]
      },
      system: {
        enabled: true,
        memoryThreshold: 80,
        cpuThreshold: 80
      }
    }

    healthCheckService = new HealthCheckService(config)
    
    // Reset mocks
    jest.clearAllMocks()
  })

  describe('performHealthCheck', () => {
    it('should perform complete health check successfully', async () => {
      // Mock successful fetch response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()

      expect(result).toHaveProperty('overall')
      expect(result).toHaveProperty('services')
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('uptime')
      expect(result.services).toHaveLength(4) // database, redis, external API, system
    })

    it('should handle database connection failure', async () => {
      // Mock database error
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: null, error: new Error('Connection failed') }))
        }))
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()
      const dbService = result.services.find(s => s.service === 'database')

      expect(dbService?.status).toBe('unhealthy')
      expect(dbService?.error).toContain('Connection failed')
    })

    it('should handle Redis connection failure', async () => {
      // Mock Redis error by overriding the mock implementation
      const Redis = require('ioredis')
      Redis.mockImplementationOnce(() => ({
        set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: jest.fn(),
        del: jest.fn(),
        info: jest.fn(),
        disconnect: jest.fn()
      }))

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()
      const redisService = result.services.find(s => s.service === 'redis')

      expect(redisService?.status).toBe('unhealthy')
      expect(redisService?.error).toContain('Redis connection failed')
    })

    it('should handle external API failure', async () => {
      // Mock API failure
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await healthCheckService.performHealthCheck()
      const apiService = result.services.find(s => s.service === 'external_api_test-api')

      expect(apiService?.status).toBe('unhealthy')
      expect(apiService?.error).toContain('Network error')
    })

    it('should determine overall health correctly', async () => {
      // Mock all services as healthy
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()
      expect(result.overall).toBe('healthy')
    })

    it('should mark system as unhealthy when critical service fails', async () => {
      // Mock database failure (critical service)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: null, error: new Error('DB down') }))
        }))
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()
      expect(result.overall).toBe('unhealthy')
    })
  })

  describe('getServiceStatus', () => {
    it('should return specific service status', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      await healthCheckService.performHealthCheck()
      const dbStatus = await healthCheckService.getServiceStatus('database')

      expect(dbStatus).toBeTruthy()
      expect(dbStatus?.service).toBe('database')
    })

    it('should return null for non-existent service', async () => {
      const status = await healthCheckService.getServiceStatus('non-existent')
      expect(status).toBeNull()
    })
  })

  describe('getLastHealthCheck', () => {
    it('should return last health check result', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      const result = await healthCheckService.performHealthCheck()
      const lastCheck = healthCheckService.getLastHealthCheck()

      expect(lastCheck).toEqual(result)
    })

    it('should return null when no health check performed', () => {
      const lastCheck = healthCheckService.getLastHealthCheck()
      expect(lastCheck).toBeNull()
    })
  })
})