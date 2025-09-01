import { GET, HEAD } from '../route'
import { NextRequest } from 'next/server'

// Mock the health service
jest.mock('@/services/health', () => ({
  getHealthService: jest.fn(() => ({
    getSystemHealth: jest.fn()
  }))
}))

describe('/api/health', () => {
  let mockHealthService: any

  beforeEach(() => {
    const { getHealthService } = require('@/services/health')
    mockHealthService = getHealthService()
    jest.clearAllMocks()
  })

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const mockHealthData = {
        overall: 'healthy',
        services: [
          {
            service: 'database',
            status: 'healthy',
            responseTime: 50,
            lastCheck: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString(),
        uptime: 3600000
      }

      mockHealthService.getSystemHealth.mockResolvedValue(mockHealthData)

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overall).toBe('healthy')
      expect(data.services).toHaveLength(1)
    })

    it('should return degraded status with 200', async () => {
      const mockHealthData = {
        overall: 'degraded',
        services: [
          {
            service: 'database',
            status: 'degraded',
            responseTime: 1500,
            lastCheck: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString(),
        uptime: 3600000
      }

      mockHealthService.getSystemHealth.mockResolvedValue(mockHealthData)

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overall).toBe('degraded')
    })

    it('should return unhealthy status with 503', async () => {
      const mockHealthData = {
        overall: 'unhealthy',
        services: [
          {
            service: 'database',
            status: 'unhealthy',
            responseTime: 5000,
            lastCheck: new Date().toISOString(),
            error: 'Connection timeout'
          }
        ],
        timestamp: new Date().toISOString(),
        uptime: 3600000
      }

      mockHealthService.getSystemHealth.mockResolvedValue(mockHealthData)

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.overall).toBe('unhealthy')
    })

    it('should handle health service errors', async () => {
      mockHealthService.getSystemHealth.mockRejectedValue(new Error('Service unavailable'))

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.overall).toBe('unhealthy')
      expect(data.error).toBe('Service unavailable')
    })
  })

  describe('HEAD /api/health', () => {
    it('should return 200 for healthy system', async () => {
      const mockHealthData = {
        overall: 'healthy',
        services: [],
        timestamp: new Date().toISOString(),
        uptime: 3600000
      }

      mockHealthService.getSystemHealth.mockResolvedValue(mockHealthData)

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await HEAD(request)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('')
    })

    it('should return 503 for unhealthy system', async () => {
      const mockHealthData = {
        overall: 'unhealthy',
        services: [],
        timestamp: new Date().toISOString(),
        uptime: 3600000
      }

      mockHealthService.getSystemHealth.mockResolvedValue(mockHealthData)

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await HEAD(request)

      expect(response.status).toBe(503)
      expect(await response.text()).toBe('')
    })

    it('should return 503 on service error', async () => {
      mockHealthService.getSystemHealth.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/health')
      const response = await HEAD(request)

      expect(response.status).toBe(503)
      expect(await response.text()).toBe('')
    })
  })
})