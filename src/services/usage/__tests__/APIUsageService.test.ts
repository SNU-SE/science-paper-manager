import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
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
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
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
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { afterEach } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { APIUsageService } from '../APIUsageService'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

describe('APIUsageService', () => {
  let service: APIUsageService
  let mockSupabase: any

  beforeEach(() => {
    // Create a mock query builder that supports method chaining
    const createMockQueryBuilder = () => {
      const builder = {
        insert: jest.fn().mockReturnValue(builder),
        select: jest.fn().mockReturnValue(builder),
        update: jest.fn().mockReturnValue(builder),
        upsert: jest.fn().mockReturnValue(builder),
        eq: jest.fn().mockReturnValue(builder),
        gte: jest.fn().mockReturnValue(builder),
        lte: jest.fn().mockReturnValue(builder),
        order: jest.fn().mockReturnValue(builder),
        single: jest.fn().mockReturnValue(builder),
      }
      return builder
    }

    mockSupabase = {
      from: jest.fn().mockImplementation(() => createMockQueryBuilder()),
      rpc: jest.fn()
    }

    const { createClient } = require('@supabase/supabase-js')
    createClient.mockReturnValue(mockSupabase)
    
    service = new APIUsageService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('trackUsage', () => {
    it('should track API usage successfully', async () => {
      const mockQueryBuilder = mockSupabase.from()
      mockQueryBuilder.insert.mockResolvedValue({ error: null })
      mockSupabase.rpc.mockResolvedValue({ error: null })

      const usage = {
        userId: 'user-123',
        endpoint: '/api/ai-analysis',
        method: 'POST',
        provider: 'openai',
        costUnits: 10,
        requestSize: 1024,
        responseSize: 2048,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      }

      await expect(service.trackUsage(usage)).resolves.not.toThrow()

      expect(mockSupabase.from).toHaveBeenCalledWith('api_usage_tracking')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: usage.userId,
        endpoint: usage.endpoint,
        method: usage.method,
        provider: usage.provider,
        cost_units: usage.costUnits,
        request_size: usage.requestSize,
        response_size: usage.responseSize,
        ip_address: usage.ipAddress,
        user_agent: usage.userAgent
      })
    })

    it('should handle tracking errors gracefully', async () => {
      const mockQueryBuilder = mockSupabase.from()
      mockQueryBuilder.insert.mockResolvedValue({ error: new Error('Database error') })

      const usage = {
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET'
      }

      // Should not throw error to avoid breaking main request
      await expect(service.trackUsage(usage)).resolves.not.toThrow()
    })
  })

  describe('checkRateLimit', () => {
    it('should check rate limits successfully', async () => {
      const mockRateLimitResult = {
        allowed: true
      }

      mockSupabase.rpc.mockResolvedValue({ data: mockRateLimitResult, error: null })

      const result = await service.checkRateLimit('user-123', '/api/test', 1)

      expect(result).toEqual({ allowed: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
        p_user_id: 'user-123',
        p_endpoint: '/api/test',
        p_cost_units: 1
      })
    })

    it('should return rate limit exceeded info', async () => {
      const mockRateLimitResult = {
        allowed: false,
        limit_type: 'daily',
        max_requests: 1000,
        current_requests: 1000,
        max_cost_units: 500,
        current_cost_units: 450,
        window_start: '2024-01-01T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValue({ data: mockRateLimitResult, error: null })

      const result = await service.checkRateLimit('user-123', '/api/ai-analysis', 10)

      expect(result.allowed).toBe(false)
      expect(result.limitType).toBe('daily')
      expect(result.maxRequests).toBe(1000)
      expect(result.currentRequests).toBe(1000)
      expect(result.resetTime).toBeInstanceOf(Date)
    })

    it('should default to allowing request on error', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: new Error('Database error') })

      const result = await service.checkRateLimit('user-123', '/api/test', 1)

      expect(result).toEqual({ allowed: true })
    })
  })

  describe('getUserUsageStatistics', () => {
    it('should get user usage statistics', async () => {
      const mockSummaryData = [
        {
          total_requests: 100,
          total_cost_units: 50,
          ai_analysis_requests: 20,
          search_requests: 30,
          upload_requests: 10
        },
        {
          total_requests: 150,
          total_cost_units: 75,
          ai_analysis_requests: 30,
          search_requests: 40,
          upload_requests: 15
        }
      ]

      const mockEndpointData = [
        { endpoint: '/api/ai-analysis' },
        { endpoint: '/api/ai-analysis' },
        { endpoint: '/api/search' },
        { endpoint: '/api/upload' }
      ]

      mockSupabase.select.mockResolvedValueOnce({ data: mockSummaryData, error: null })
      mockSupabase.select.mockResolvedValueOnce({ data: mockEndpointData, error: null })

      const result = await service.getUserUsageStatistics('user-123')

      expect(result.totalRequests).toBe(250)
      expect(result.totalCostUnits).toBe(125)
      expect(result.aiAnalysisRequests).toBe(50)
      expect(result.searchRequests).toBe(70)
      expect(result.uploadRequests).toBe(25)
      expect(result.topEndpoints).toHaveLength(3)
      expect(result.topEndpoints[0].endpoint).toBe('/api/ai-analysis')
      expect(result.topEndpoints[0].count).toBe(2)
    })

    it('should handle empty data gracefully', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null })

      const result = await service.getUserUsageStatistics('user-123')

      expect(result.totalRequests).toBe(0)
      expect(result.totalCostUnits).toBe(0)
      expect(result.topEndpoints).toHaveLength(0)
    })
  })

  describe('getUserRateLimits', () => {
    it('should get user rate limits', async () => {
      const mockRateLimits = [
        {
          id: 'limit-1',
          user_id: 'user-123',
          limit_type: 'daily',
          endpoint_pattern: null,
          max_requests: 1000,
          max_cost_units: 500,
          current_requests: 100,
          current_cost_units: 50,
          window_start: '2024-01-01T00:00:00Z',
          is_active: true
        },
        {
          id: 'limit-2',
          user_id: 'user-123',
          limit_type: 'hourly',
          endpoint_pattern: '%ai-analysis%',
          max_requests: 50,
          max_cost_units: 100,
          current_requests: 10,
          current_cost_units: 20,
          window_start: '2024-01-01T10:00:00Z',
          is_active: true
        }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockRateLimits, error: null })

      const result = await service.getUserRateLimits('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].limitType).toBe('daily')
      expect(result[0].endpointPattern).toBeNull()
      expect(result[1].limitType).toBe('hourly')
      expect(result[1].endpointPattern).toBe('%ai-analysis%')
    })
  })

  describe('getSuspiciousActivity', () => {
    it('should get suspicious activity for user', async () => {
      const mockActivity = [
        {
          id: 'activity-1',
          user_id: 'user-123',
          activity_type: 'rate_limit_exceeded',
          severity: 'medium',
          description: 'Rate limit exceeded',
          metadata: { endpoint: '/api/test' },
          is_resolved: false,
          created_at: '2024-01-01T12:00:00Z',
          resolved_at: null,
          resolved_by: null
        }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockActivity, error: null })

      const result = await service.getSuspiciousActivity('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].activityType).toBe('rate_limit_exceeded')
      expect(result[0].severity).toBe('medium')
      expect(result[0].isResolved).toBe(false)
      expect(result[0].createdAt).toBeInstanceOf(Date)
    })

    it('should get all suspicious activity for admin', async () => {
      const mockActivity = [
        {
          id: 'activity-1',
          user_id: 'user-123',
          activity_type: 'burst_requests',
          severity: 'high',
          description: 'Too many requests',
          metadata: {},
          is_resolved: false,
          created_at: '2024-01-01T12:00:00Z',
          resolved_at: null,
          resolved_by: null
        }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockActivity, error: null })

      const result = await service.getSuspiciousActivity()

      expect(result).toHaveLength(1)
      expect(mockSupabase.eq).not.toHaveBeenCalledWith('user_id', expect.anything())
    })
  })

  describe('updateUserRateLimit', () => {
    it('should update user rate limit', async () => {
      mockSupabase.upsert = jest.fn().mockResolvedValue({ error: null })

      await service.updateUserRateLimit('user-123', 'daily', null, 2000, 1000)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_rate_limits')
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        limit_type: 'daily',
        endpoint_pattern: null,
        max_requests: 2000,
        max_cost_units: 1000,
        updated_at: expect.any(String)
      }, {
        onConflict: 'user_id,limit_type,endpoint_pattern'
      })
    })
  })

  describe('getSystemUsageStatistics', () => {
    it('should get system-wide usage statistics', async () => {
      const mockUsageData = [
        { user_id: 'user-1', endpoint: '/api/test', cost_units: 1 },
        { user_id: 'user-1', endpoint: '/api/test', cost_units: 2 },
        { user_id: 'user-2', endpoint: '/api/search', cost_units: 1 },
        { user_id: 'user-2', endpoint: '/api/search', cost_units: 1 }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockUsageData, error: null })

      const result = await service.getSystemUsageStatistics()

      expect(result.totalUsers).toBe(2)
      expect(result.totalRequests).toBe(4)
      expect(result.totalCostUnits).toBe(5)
      expect(result.averageRequestsPerUser).toBe(2)
      expect(result.topUsers).toHaveLength(2)
      expect(result.topEndpoints).toHaveLength(2)
    })
  })

  describe('resolveSuspiciousActivity', () => {
    it('should resolve suspicious activity', async () => {
      mockSupabase.update = jest.fn().mockResolvedValue({ error: null })

      await service.resolveSuspiciousActivity('activity-1', 'admin-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('suspicious_activity_log')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_resolved: true,
        resolved_at: expect.any(String),
        resolved_by: 'admin-123'
      })
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'activity-1')
    })
  })
})