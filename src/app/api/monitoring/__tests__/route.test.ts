import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
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
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
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
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock global Request and Response
global.Request = jest.fn()
global.Response = jest.fn()

// Mock the performance monitor
jest.mock('@/services/monitoring/PerformanceMonitor', () => ({
  performanceMonitor: {
    getMetrics: jest.fn(() => ({
      apiMetrics: {
        averageResponseTime: 500,
        requestsPerMinute: 100,
        errorRate: 2,
        slowestEndpoints: [
          {
            endpoint: '/api/papers',
            averageResponseTime: 800,
            requestCount: 50,
            errorRate: 1
          }
        ]
      },
      databaseMetrics: {
        averageQueryTime: 200,
        slowestQueries: [
          {
            queryHash: 'abc123',
            queryType: 'SELECT',
            averageExecutionTime: 300,
            executionCount: 25,
            tableName: 'papers'
          }
        ],
        connectionPoolStatus: {
          totalConnections: 20,
          activeConnections: 5,
          idleConnections: 15,
          waitingConnections: 0
        }
      },
      userMetrics: {
        activeUsers: 50,
        mostUsedFeatures: [
          {
            feature: 'papers',
            usageCount: 100,
            uniqueUsers: 25
          }
        ],
        userSessions: []
      },
      systemMetrics: {
        memoryUsage: 256,
        cpuUsage: 1000,
        diskUsage: 0,
        uptime: 3600
      }
    })),
    getDashboardData: jest.fn(() => ({
      recent: {
        apiMetrics: {
          averageResponseTime: 500,
          requestsPerMinute: 100,
          errorRate: 2,
          slowestEndpoints: []
        }
      },
      daily: {
        apiMetrics: {
          averageResponseTime: 450,
          requestsPerMinute: 95,
          errorRate: 1.5,
          slowestEndpoints: []
        }
      },
      slowQueries: [],
      errorRates: [],
      activeUsers: 50,
      alerts: [],
      timestamp: new Date().toISOString()
    })),
    trackUserActivity: jest.fn(),
    trackSystemMetric: jest.fn()
  }
}))

// Mock performance middleware
jest.mock('@/middleware/performanceMiddleware', () => ({
  checkPerformanceThresholds: jest.fn(() => ({
    alerts: [
      {
        type: 'slow_api_response',
        message: 'API response time exceeded threshold',
        value: 1200,
        threshold: 1000
      }
    ]
  }))
}))

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn((token) => {
        if (token === 'valid-admin-token') {
          return {
            data: { user: { id: 'admin-user-id', email: 'admin@admin.com' } },
            error: null
          }
        }
        if (token === 'valid-user-token') {
          return {
            data: { user: { id: 'regular-user-id', email: 'user@example.com' } },
            error: null
          }
        }
        return {
          data: { user: null },
          error: new Error('Invalid token')
        }
      })
    }
  }))
}))

describe('/api/monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return performance metrics for admin users', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        headers: {
          'authorization': 'Bearer valid-admin-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('metrics')
      expect(data).toHaveProperty('alerts')
      expect(data).toHaveProperty('timeRange')
      expect(data).toHaveProperty('timestamp')

      expect(data.metrics).toHaveProperty('apiMetrics')
      expect(data.metrics).toHaveProperty('databaseMetrics')
      expect(data.metrics).toHaveProperty('userMetrics')
      expect(data.metrics).toHaveProperty('systemMetrics')
    })

    it('should return dashboard data when type=dashboard', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring?type=dashboard', {
        headers: {
          'authorization': 'Bearer valid-admin-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('recent')
      expect(data).toHaveProperty('daily')
      expect(data).toHaveProperty('slowQueries')
      expect(data).toHaveProperty('errorRates')
      expect(data).toHaveProperty('activeUsers')
      expect(data).toHaveProperty('alerts')
      expect(data).toHaveProperty('timestamp')
    })

    it('should handle different time ranges', async () => {
      const timeRanges = ['1h', '24h', '7d', '30d']

      for (const timeRange of timeRanges) {
        const request = new NextRequest(`http://localhost:3000/api/monitoring?timeRange=${timeRange}`, {
          headers: {
            'authorization': 'Bearer valid-admin-token'
          }
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.timeRange.start).toBeDefined()
        expect(data.timeRange.end).toBeDefined()
      }
    })

    it('should return 401 for unauthenticated requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid tokens', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        headers: {
          'authorization': 'Bearer invalid-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 for non-admin users', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        headers: {
          'authorization': 'Bearer valid-user-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('POST', () => {
    it('should track user activity successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            action: 'paper_upload',
            feature: 'papers',
            metadata: { fileSize: 1024 },
            sessionId: 'test-session-id'
          }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should track system metrics successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'system_metric',
          data: {
            metricType: 'memory',
            metricName: 'heap_used',
            value: 104857600,
            unit: 'bytes',
            metadata: { process: 'main' }
          }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should track custom events successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'custom_event',
          data: {
            eventName: 'feature_used',
            eventData: { feature: 'ai_analysis', duration: 5000 }
          }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for invalid metric types', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'invalid_type',
          data: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid metric type')
    })

    it('should return 401 for unauthenticated POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user_activity',
          data: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('error handling', () => {
    it('should handle performance monitor errors gracefully', async () => {
      const { performanceMonitor } = require('@/services/monitoring/PerformanceMonitor')
      performanceMonitor.getMetrics.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        headers: {
          'authorization': 'Bearer valid-admin-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle tracking errors gracefully in POST', async () => {
      const { performanceMonitor } = require('@/services/monitoring/PerformanceMonitor')
      performanceMonitor.trackUserActivity.mockRejectedValue(new Error('Tracking failed'))

      const request = new NextRequest('http://localhost:3000/api/monitoring', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            action: 'test',
            feature: 'test'
          }
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})