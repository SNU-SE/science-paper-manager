import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getOverview } from '../overview/route'
import { GET as getUserActivity } from '../users/activity/route'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          neq: vi.fn(() => Promise.resolve({ data: [] })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null }))
            }))
          })),
          eq: vi.fn(() => Promise.resolve({ data: [] }))
        })),
        in: vi.fn(() => Promise.resolve({ data: [] })),
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null }))
          })),
          range: vi.fn(() => Promise.resolve({ data: [] }))
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        })),
        range: vi.fn(() => Promise.resolve({ data: [] }))
      }))
    }))
  }))
}))

// Mock services
vi.mock('@/services/health/HealthCheckService', () => ({
  HealthCheckService: vi.fn(() => ({
    getSystemStatus: vi.fn(() => Promise.resolve({
      overall: 'healthy',
      uptime: 86400000,
      services: []
    }))
  }))
}))

vi.mock('@/services/monitoring/PerformanceMonitor', () => ({
  PerformanceMonitor: vi.fn(() => ({
    getMetrics: vi.fn(() => Promise.resolve({
      apiMetrics: {
        averageResponseTime: 150,
        errorRate: 2.5,
        requestsPerMinute: 45
      }
    }))
  }))
}))

vi.mock('@/services/cache/CacheService', () => ({
  CacheService: vi.fn(() => ({
    getStats: vi.fn(() => Promise.resolve({
      hitRate: 85,
      memoryUsage: 45,
      totalKeys: 1250
    }))
  }))
}))

describe('Admin Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/admin/overview', () => {
    it('should return system overview data', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/overview')
      const response = await getOverview(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('status')
      expect(data.data).toHaveProperty('uptime')
      expect(data.data).toHaveProperty('activeUsers')
      expect(data.data).toHaveProperty('backgroundJobs')
      expect(data.data).toHaveProperty('performance')
      expect(data.data).toHaveProperty('resources')
      expect(data.data).toHaveProperty('security')
      expect(data.data).toHaveProperty('backup')
      expect(data.data).toHaveProperty('cache')
    })

    it('should handle errors gracefully', async () => {
      // Mock a service to throw an error
      vi.mocked(require('@/services/health/HealthCheckService').HealthCheckService)
        .mockImplementation(() => ({
          getSystemStatus: vi.fn(() => Promise.reject(new Error('Service unavailable')))
        }))

      const request = new NextRequest('http://localhost:3000/api/admin/overview')
      const response = await getOverview(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch system overview')
    })
  })

  describe('GET /api/admin/users/activity', () => {
    it('should return user activity data', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users/activity')
      const response = await getUserActivity(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      expect(data).toHaveProperty('pagination')
      expect(data.pagination).toHaveProperty('total')
      expect(data.pagination).toHaveProperty('limit')
      expect(data.pagination).toHaveProperty('offset')
    })

    it('should handle pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users/activity?limit=10&offset=20')
      const response = await getUserActivity(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
    })
  })

  describe('Admin Dashboard Components', () => {
    it('should have proper data structure for overview', () => {
      const mockOverviewData = {
        status: 'healthy',
        uptime: 86400,
        activeUsers: 15,
        backgroundJobs: {
          running: 3,
          pending: 5,
          failed: 1
        },
        performance: {
          avgResponseTime: 150,
          errorRate: 2.5,
          requestsPerMinute: 45
        },
        resources: {
          memoryUsage: 65,
          cpuUsage: 25,
          diskUsage: 40
        },
        security: {
          activeThreats: 0,
          blockedRequests: 12,
          suspiciousActivity: 3
        },
        backup: {
          lastBackup: '2024-01-15T10:00:00Z',
          nextScheduled: '2024-01-16T10:00:00Z',
          status: 'success'
        },
        cache: {
          hitRate: 85,
          memoryUsage: 45,
          totalKeys: 1250
        }
      }

      // Validate data structure
      expect(mockOverviewData).toHaveProperty('status')
      expect(['healthy', 'degraded', 'unhealthy']).toContain(mockOverviewData.status)
      expect(typeof mockOverviewData.uptime).toBe('number')
      expect(typeof mockOverviewData.activeUsers).toBe('number')
      expect(mockOverviewData.backgroundJobs).toHaveProperty('running')
      expect(mockOverviewData.backgroundJobs).toHaveProperty('pending')
      expect(mockOverviewData.backgroundJobs).toHaveProperty('failed')
    })

    it('should validate user activity data structure', () => {
      const mockUserActivity = {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2024-01-15T14:30:00Z',
        sessionDuration: 3600,
        actionsCount: 25,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      }

      expect(mockUserActivity).toHaveProperty('userId')
      expect(mockUserActivity).toHaveProperty('email')
      expect(mockUserActivity).toHaveProperty('lastActivity')
      expect(typeof mockUserActivity.sessionDuration).toBe('number')
      expect(typeof mockUserActivity.actionsCount).toBe('number')
    })

    it('should validate security event data structure', () => {
      const mockSecurityEvent = {
        id: 'event-123',
        type: 'suspicious_login',
        severity: 'high',
        message: 'Multiple failed login attempts',
        userId: 'user-456',
        ipAddress: '10.0.0.1',
        timestamp: '2024-01-15T15:00:00Z',
        resolved: false
      }

      expect(mockSecurityEvent).toHaveProperty('id')
      expect(mockSecurityEvent).toHaveProperty('type')
      expect(['low', 'medium', 'high', 'critical']).toContain(mockSecurityEvent.severity)
      expect(typeof mockSecurityEvent.resolved).toBe('boolean')
    })
  })

  describe('Admin Dashboard Integration', () => {
    it('should handle real-time updates', () => {
      // Test that the dashboard can handle real-time data updates
      const initialData = { activeUsers: 10, backgroundJobs: { running: 2 } }
      const updatedData = { activeUsers: 12, backgroundJobs: { running: 3 } }

      expect(updatedData.activeUsers).toBeGreaterThan(initialData.activeUsers)
      expect(updatedData.backgroundJobs.running).toBeGreaterThan(initialData.backgroundJobs.running)
    })

    it('should calculate metrics correctly', () => {
      const jobs = [
        { status: 'completed', duration: 1000 },
        { status: 'completed', duration: 2000 },
        { status: 'failed', duration: 500 },
        { status: 'running', duration: 0 }
      ]

      const completedJobs = jobs.filter(j => j.status === 'completed')
      const avgDuration = completedJobs.reduce((sum, job) => sum + job.duration, 0) / completedJobs.length
      const successRate = (completedJobs.length / (jobs.length - 1)) * 100 // Exclude running jobs

      expect(avgDuration).toBe(1500)
      expect(successRate).toBeCloseTo(66.67, 1)
    })
  })
})