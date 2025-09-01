import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { apiUsageService } from '@/services/usage/APIUsageService'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@/services/usage/APIUsageService')
jest.mock('@supabase/supabase-js')

const mockApiUsageService = apiUsageService as jest.Mocked<typeof apiUsageService>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('/api/usage', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    }
    mockCreateClient.mockReturnValue(mockSupabase)
    jest.clearAllMocks()
  })

  describe('GET /api/usage', () => {
    it('should return usage statistics for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockStatistics = {
        totalRequests: 100,
        totalCostUnits: 50,
        aiAnalysisRequests: 20,
        searchRequests: 30,
        uploadRequests: 10,
        averageRequestsPerDay: 10,
        topEndpoints: [
          { endpoint: '/api/test', count: 50, percentage: 50 }
        ]
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.getUserUsageStatistics.mockResolvedValue(mockStatistics)

      const request = new NextRequest('http://localhost/api/usage', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.statistics).toEqual(mockStatistics)
      expect(mockApiUsageService.getUserUsageStatistics).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined
      )
    })

    it('should include rate limits when requested', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockStatistics = {
        totalRequests: 100,
        totalCostUnits: 50,
        aiAnalysisRequests: 20,
        searchRequests: 30,
        uploadRequests: 10,
        averageRequestsPerDay: 10,
        topEndpoints: []
      }
      const mockRateLimits = [
        {
          id: 'limit-1',
          userId: 'user-123',
          limitType: 'daily' as const,
          maxRequests: 1000,
          maxCostUnits: 500,
          currentRequests: 100,
          currentCostUnits: 50,
          windowStart: new Date(),
          isActive: true
        }
      ]

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.getUserUsageStatistics.mockResolvedValue(mockStatistics)
      mockApiUsageService.getUserRateLimits.mockResolvedValue(mockRateLimits)

      const request = new NextRequest('http://localhost/api/usage?includeRateLimits=true', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.statistics).toEqual(mockStatistics)
      expect(data.rateLimits).toEqual(mockRateLimits)
      expect(mockApiUsageService.getUserRateLimits).toHaveBeenCalledWith('user-123')
    })

    it('should handle date range parameters', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const startDate = '2024-01-01T00:00:00Z'
      const endDate = '2024-01-31T23:59:59Z'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.getUserUsageStatistics.mockResolvedValue({
        totalRequests: 50,
        totalCostUnits: 25,
        aiAnalysisRequests: 10,
        searchRequests: 15,
        uploadRequests: 5,
        averageRequestsPerDay: 5,
        topEndpoints: []
      })

      const request = new NextRequest(
        `http://localhost/api/usage?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { 'authorization': 'Bearer valid-token' }
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockApiUsageService.getUserUsageStatistics).toHaveBeenCalledWith(
        'user-123',
        new Date(startDate),
        new Date(endDate)
      )
      expect(data.period.startDate).toBe(startDate)
      expect(data.period.endDate).toBe(endDate)
    })

    it('should return 401 for missing authorization header', async () => {
      const request = new NextRequest('http://localhost/api/usage')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    it('should return 401 for invalid token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      })

      const request = new NextRequest('http://localhost/api/usage', {
        headers: { 'authorization': 'Bearer invalid-token' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid authentication token')
    })

    it('should handle service errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.getUserUsageStatistics.mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/usage', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to get usage statistics')
    })
  })

  describe('POST /api/usage/track', () => {
    it('should track usage for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.trackUsage.mockResolvedValue()

      const requestBody = {
        endpoint: '/api/test',
        method: 'GET',
        provider: 'openai',
        costUnits: 5,
        requestSize: 1024,
        responseSize: 2048
      }

      const request = new NextRequest('http://localhost/api/usage/track', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockApiUsageService.trackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET',
        provider: 'openai',
        costUnits: 5,
        requestSize: 1024,
        responseSize: 2048,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      })
    })

    it('should return 400 for missing required fields', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const requestBody = {
        endpoint: '/api/test'
        // missing method
      }

      const request = new NextRequest('http://localhost/api/usage/track', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields: endpoint, method')
    })

    it('should return 401 for unauthenticated request', async () => {
      const request = new NextRequest('http://localhost/api/usage/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: '/api/test', method: 'GET' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Missing or invalid authorization header')
    })

    it('should handle tracking errors', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockApiUsageService.trackUsage.mockRejectedValue(new Error('Tracking failed'))

      const requestBody = {
        endpoint: '/api/test',
        method: 'GET'
      }

      const request = new NextRequest('http://localhost/api/usage/track', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track usage')
    })
  })
})