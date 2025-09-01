import { APIUsageService } from '../APIUsageService'
import { createRateLimitMiddleware } from '@/middleware/rateLimitMiddleware'
import { NextRequest } from 'next/server'

// Mock Supabase for integration testing
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }))
}))

describe('API Usage Tracking Integration', () => {
  let service: APIUsageService
  let mockSupabase: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Create fresh service instance
    service = new APIUsageService()
    
    // Get the mocked supabase instance
    const { createClient } = require('@supabase/supabase-js')
    mockSupabase = createClient()
  })

  describe('Complete Usage Tracking Workflow', () => {
    it('should track usage through the complete workflow', async () => {
      // Mock successful database operations
      mockSupabase.insert.mockResolvedValue({ error: null })
      mockSupabase.rpc.mockResolvedValue({ error: null })

      // 1. Track initial usage
      await service.trackUsage({
        userId: 'user-123',
        endpoint: '/api/ai-analysis',
        method: 'POST',
        provider: 'openai',
        costUnits: 10,
        requestSize: 1024,
        responseSize: 2048,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      })

      // Verify tracking was called
      expect(mockSupabase.from).toHaveBeenCalledWith('api_usage_tracking')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        endpoint: '/api/ai-analysis',
        method: 'POST',
        provider: 'openai',
        cost_units: 10,
        request_size: 1024,
        response_size: 2048,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0'
      })

      // Verify suspicious activity check was called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('detect_suspicious_activity', {
        p_user_id: 'user-123'
      })
    })

    it('should handle rate limiting workflow', async () => {
      // Mock rate limit check - first allow, then deny
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: { allowed: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            allowed: false,
            limit_type: 'daily',
            max_requests: 1000,
            current_requests: 1000,
            max_cost_units: 500,
            current_cost_units: 450
          },
          error: null
        })

      // 1. First request should be allowed
      const result1 = await service.checkRateLimit('user-123', '/api/ai-analysis', 10)
      expect(result1.allowed).toBe(true)

      // 2. Second request should be denied
      const result2 = await service.checkRateLimit('user-123', '/api/ai-analysis', 10)
      expect(result2.allowed).toBe(false)
      expect(result2.limitType).toBe('daily')
      expect(result2.maxRequests).toBe(1000)
      expect(result2.currentRequests).toBe(1000)
    })

    it('should generate usage statistics correctly', async () => {
      // Mock database responses for statistics
      const mockSummaryData = [
        {
          total_requests: 100,
          total_cost_units: 200,
          ai_analysis_requests: 50,
          search_requests: 30,
          upload_requests: 20
        },
        {
          total_requests: 150,
          total_cost_units: 300,
          ai_analysis_requests: 75,
          search_requests: 45,
          upload_requests: 30
        }
      ]

      const mockEndpointData = [
        { endpoint: '/api/ai-analysis' },
        { endpoint: '/api/ai-analysis' },
        { endpoint: '/api/ai-analysis' },
        { endpoint: '/api/search' },
        { endpoint: '/api/search' },
        { endpoint: '/api/upload' }
      ]

      mockSupabase.select
        .mockResolvedValueOnce({ data: mockSummaryData, error: null })
        .mockResolvedValueOnce({ data: mockEndpointData, error: null })

      const statistics = await service.getUserUsageStatistics('user-123')

      expect(statistics.totalRequests).toBe(250)
      expect(statistics.totalCostUnits).toBe(500)
      expect(statistics.aiAnalysisRequests).toBe(125)
      expect(statistics.searchRequests).toBe(75)
      expect(statistics.uploadRequests).toBe(50)
      expect(statistics.topEndpoints).toHaveLength(3)
      expect(statistics.topEndpoints[0].endpoint).toBe('/api/ai-analysis')
      expect(statistics.topEndpoints[0].count).toBe(3)
      expect(statistics.topEndpoints[0].percentage).toBeCloseTo(50, 1)
    })

    it('should detect and log suspicious activity', async () => {
      // Mock suspicious activity detection
      mockSupabase.insert.mockResolvedValue({ error: null })
      mockSupabase.rpc.mockResolvedValue({ error: null })

      // Track multiple rapid requests to trigger suspicious activity
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(service.trackUsage({
          userId: 'user-123',
          endpoint: '/api/ai-analysis',
          method: 'POST',
          costUnits: 10
        }))
      }

      await Promise.all(promises)

      // Verify suspicious activity detection was called for each request
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(10)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('detect_suspicious_activity', {
        p_user_id: 'user-123'
      })
    })

    it('should handle admin operations correctly', async () => {
      // Mock admin operations
      mockSupabase.select.mockResolvedValue({
        data: [
          { user_id: 'user-1', endpoint: '/api/test', cost_units: 1 },
          { user_id: 'user-2', endpoint: '/api/search', cost_units: 2 },
          { user_id: 'user-1', endpoint: '/api/ai-analysis', cost_units: 10 }
        ],
        error: null
      })

      const systemStats = await service.getSystemUsageStatistics()

      expect(systemStats.totalUsers).toBe(2)
      expect(systemStats.totalRequests).toBe(3)
      expect(systemStats.totalCostUnits).toBe(13)
      expect(systemStats.averageRequestsPerUser).toBe(1.5)
      expect(systemStats.topUsers).toHaveLength(2)
      expect(systemStats.topEndpoints).toHaveLength(3)
    })

    it('should update rate limits correctly', async () => {
      mockSupabase.upsert.mockResolvedValue({ error: null })

      await service.updateUserRateLimit(
        'user-123',
        'daily',
        '%ai-analysis%',
        500,
        1000
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('user_rate_limits')
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        limit_type: 'daily',
        endpoint_pattern: '%ai-analysis%',
        max_requests: 500,
        max_cost_units: 1000,
        updated_at: expect.any(String)
      }, {
        onConflict: 'user_id,limit_type,endpoint_pattern'
      })
    })

    it('should resolve suspicious activity', async () => {
      mockSupabase.update.mockResolvedValue({ error: null })

      await service.resolveSuspiciousActivity('activity-123', 'admin-456')

      expect(mockSupabase.from).toHaveBeenCalledWith('suspicious_activity_log')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_resolved: true,
        resolved_at: expect.any(String),
        resolved_by: 'admin-456'
      })
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'activity-123')
    })
  })

  describe('Rate Limiting Middleware Integration', () => {
    it('should integrate with rate limiting middleware', async () => {
      const middleware = createRateLimitMiddleware()

      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock rate limit check - allow request
      mockSupabase.rpc.mockResolvedValue({
        data: { allowed: true },
        error: null
      })

      const request = new NextRequest('http://localhost/api/ai-analysis', {
        method: 'POST',
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const result = await middleware(request, {})

      // Should not block the request
      expect(result).toBeUndefined()

      // Should have checked rate limit with correct parameters
      expect(mockSupabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
        p_user_id: 'user-123',
        p_endpoint: '/api/ai-analysis',
        p_cost_units: 10 // AI analysis cost
      })
    })

    it('should block requests when rate limit exceeded', async () => {
      const middleware = createRateLimitMiddleware()

      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock rate limit check - deny request
      mockSupabase.rpc.mockResolvedValue({
        data: {
          allowed: false,
          limit_type: 'daily',
          max_requests: 50,
          current_requests: 50,
          max_cost_units: 100,
          current_cost_units: 95,
          window_start: '2024-01-01T00:00:00Z'
        },
        error: null
      })

      const request = new NextRequest('http://localhost/api/ai-analysis', {
        method: 'POST',
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const result = await middleware(request, {})

      // Should block the request
      expect(result).toBeDefined()
      expect(result?.status).toBe(429)

      const responseBody = await result?.json()
      expect(responseBody.error).toBe('Rate limit exceeded')
      expect(responseBody.details.limitType).toBe('daily')
      expect(responseBody.details.maxRequests).toBe(50)
      expect(responseBody.details.currentRequests).toBe(50)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.insert.mockResolvedValue({
        error: new Error('Database connection failed')
      })

      // Should not throw error
      await expect(service.trackUsage({
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET'
      })).resolves.not.toThrow()
    })

    it('should handle rate limit check errors gracefully', async () => {
      // Mock rate limit check error
      mockSupabase.rpc.mockResolvedValue({
        error: new Error('Rate limit check failed')
      })

      const result = await service.checkRateLimit('user-123', '/api/test', 1)

      // Should default to allowing the request
      expect(result.allowed).toBe(true)
    })

    it('should handle statistics query errors', async () => {
      // Mock statistics query error
      mockSupabase.select.mockResolvedValue({
        error: new Error('Statistics query failed')
      })

      await expect(service.getUserUsageStatistics('user-123'))
        .rejects.toThrow('Statistics query failed')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent usage tracking', async () => {
      mockSupabase.insert.mockResolvedValue({ error: null })
      mockSupabase.rpc.mockResolvedValue({ error: null })

      // Simulate concurrent requests
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(service.trackUsage({
          userId: `user-${i % 10}`, // 10 different users
          endpoint: '/api/test',
          method: 'GET',
          costUnits: 1
        }))
      }

      // All requests should complete without errors
      await expect(Promise.all(promises)).resolves.not.toThrow()

      // Should have made 100 insert calls
      expect(mockSupabase.insert).toHaveBeenCalledTimes(100)
    })

    it('should handle large statistics queries efficiently', async () => {
      // Mock large dataset
      const largeSummaryData = Array.from({ length: 365 }, (_, i) => ({
        total_requests: Math.floor(Math.random() * 100),
        total_cost_units: Math.floor(Math.random() * 50),
        ai_analysis_requests: Math.floor(Math.random() * 20),
        search_requests: Math.floor(Math.random() * 30),
        upload_requests: Math.floor(Math.random() * 10)
      }))

      const largeEndpointData = Array.from({ length: 10000 }, (_, i) => ({
        endpoint: `/api/endpoint-${i % 50}`
      }))

      mockSupabase.select
        .mockResolvedValueOnce({ data: largeSummaryData, error: null })
        .mockResolvedValueOnce({ data: largeEndpointData, error: null })

      const startTime = Date.now()
      const statistics = await service.getUserUsageStatistics('user-123')
      const endTime = Date.now()

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000)

      // Should aggregate data correctly
      expect(statistics.totalRequests).toBeGreaterThan(0)
      expect(statistics.topEndpoints.length).toBeLessThanOrEqual(10)
    })
  })
})