import { NextRequest, NextResponse } from 'next/server'
import { createRateLimitMiddleware, createUsageTrackingMiddleware } from '../rateLimitMiddleware'
import { apiUsageService } from '@/services/usage/APIUsageService'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@/services/usage/APIUsageService')
jest.mock('@supabase/supabase-js')

const mockApiUsageService = apiUsageService as jest.Mocked<typeof apiUsageService>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('rateLimitMiddleware', () => {
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

  describe('createRateLimitMiddleware', () => {
    it('should skip rate limiting for excluded paths', async () => {
      const middleware = createRateLimitMiddleware({
        skipPaths: ['/api/health']
      })

      const request = new NextRequest('http://localhost/api/health')
      const result = await middleware(request, {})

      expect(result).toBeUndefined()
      expect(mockApiUsageService.checkRateLimit).not.toHaveBeenCalled()
    })

    it('should skip rate limiting for excluded methods', async () => {
      const middleware = createRateLimitMiddleware({
        skipMethods: ['OPTIONS']
      })

      const request = new NextRequest('http://localhost/api/test', { method: 'OPTIONS' })
      const result = await middleware(request, {})

      expect(result).toBeUndefined()
      expect(mockApiUsageService.checkRateLimit).not.toHaveBeenCalled()
    })

    it('should skip rate limiting for unauthenticated requests', async () => {
      const middleware = createRateLimitMiddleware()
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const request = new NextRequest('http://localhost/api/test')
      const result = await middleware(request, {})

      expect(result).toBeUndefined()
      expect(mockApiUsageService.checkRateLimit).not.toHaveBeenCalled()
    })

    it('should allow request when rate limit is not exceeded', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: true
      })

      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const result = await middleware(request, {})

      expect(result).toBeUndefined()
      expect(mockApiUsageService.checkRateLimit).toHaveBeenCalledWith(
        'user-123',
        '/api/test',
        1 // default cost
      )
    })

    it('should block request when rate limit is exceeded', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: false,
        limitType: 'daily',
        maxRequests: 1000,
        currentRequests: 1000,
        maxCostUnits: 500,
        currentCostUnits: 450,
        resetTime: new Date('2024-01-02T00:00:00Z')
      })

      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const result = await middleware(request, {})

      expect(result).toBeInstanceOf(NextResponse)
      expect(result?.status).toBe(429)

      const responseBody = await result?.json()
      expect(responseBody.error).toBe('Rate limit exceeded')
      expect(responseBody.details.limitType).toBe('daily')
    })

    it('should use custom cost calculator', async () => {
      const customCostCalculator = jest.fn().mockReturnValue(5)
      const middleware = createRateLimitMiddleware({
        costCalculator: customCostCalculator
      })
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: true
      })

      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      await middleware(request, {})

      expect(customCostCalculator).toHaveBeenCalledWith(request)
      expect(mockApiUsageService.checkRateLimit).toHaveBeenCalledWith(
        'user-123',
        '/api/test',
        5
      )
    })

    it('should use custom rate limit exceeded handler', async () => {
      const customHandler = jest.fn().mockReturnValue(
        NextResponse.json({ custom: 'error' }, { status: 429 })
      )
      const middleware = createRateLimitMiddleware({
        onRateLimitExceeded: customHandler
      })
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: false,
        limitType: 'daily'
      })

      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      const result = await middleware(request, {})

      expect(customHandler).toHaveBeenCalledWith(request, expect.objectContaining({
        allowed: false,
        limitType: 'daily'
      }))

      const responseBody = await result?.json()
      expect(responseBody.custom).toBe('error')
    })

    it('should handle errors gracefully', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth error'))

      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'authorization': 'Bearer invalid-token' }
      })

      const result = await middleware(request, {})

      // Should continue on error to avoid breaking the request
      expect(result).toBeUndefined()
    })
  })

  describe('createUsageTrackingMiddleware', () => {
    it('should track usage for successful requests', async () => {
      const middleware = createUsageTrackingMiddleware()

      const trackingInfo = {
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET',
        costUnits: 1,
        requestSize: 100,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      }

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-usage-tracking': JSON.stringify(trackingInfo)
        }
      })

      const response = NextResponse.json({ success: true }, { status: 200 })

      const result = await middleware(request, response)

      expect(mockApiUsageService.trackUsage).toHaveBeenCalledWith({
        ...trackingInfo,
        responseSize: expect.any(Number)
      })

      expect(result.status).toBe(200)
    })

    it('should not track usage for failed requests', async () => {
      const middleware = createUsageTrackingMiddleware()

      const trackingInfo = {
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET',
        costUnits: 1
      }

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-usage-tracking': JSON.stringify(trackingInfo)
        }
      })

      const response = NextResponse.json({ error: 'Bad request' }, { status: 400 })

      const result = await middleware(request, response)

      expect(mockApiUsageService.trackUsage).not.toHaveBeenCalled()
      expect(result.status).toBe(400)
    })

    it('should handle missing tracking header', async () => {
      const middleware = createUsageTrackingMiddleware()

      const request = new NextRequest('http://localhost/api/test')
      const response = NextResponse.json({ success: true }, { status: 200 })

      const result = await middleware(request, response)

      expect(mockApiUsageService.trackUsage).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('should handle tracking errors gracefully', async () => {
      const middleware = createUsageTrackingMiddleware()

      mockApiUsageService.trackUsage.mockRejectedValue(new Error('Tracking error'))

      const trackingInfo = {
        userId: 'user-123',
        endpoint: '/api/test',
        method: 'GET'
      }

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-usage-tracking': JSON.stringify(trackingInfo)
        }
      })

      const response = NextResponse.json({ success: true }, { status: 200 })

      const result = await middleware(request, response)

      // Should not throw error and return original response
      expect(result.status).toBe(200)
    })
  })

  describe('default cost calculator', () => {
    it('should assign higher cost to AI analysis endpoints', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: true
      })

      const request = new NextRequest('http://localhost/api/ai-analysis/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      await middleware(request, {})

      expect(mockApiUsageService.checkRateLimit).toHaveBeenCalledWith(
        'user-123',
        '/api/ai-analysis/test',
        10 // AI analysis cost
      )
    })

    it('should assign moderate cost to search endpoints', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: true
      })

      const request = new NextRequest('http://localhost/api/search', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      await middleware(request, {})

      expect(mockApiUsageService.checkRateLimit).toHaveBeenCalledWith(
        'user-123',
        '/api/search',
        3 // Search cost
      )
    })

    it('should assign default cost to other endpoints', async () => {
      const middleware = createRateLimitMiddleware()
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockApiUsageService.checkRateLimit.mockResolvedValue({
        allowed: true
      })

      const request = new NextRequest('http://localhost/api/papers', {
        headers: { 'authorization': 'Bearer valid-token' }
      })

      await middleware(request, {})

      expect(mockApiUsageService.checkRateLimit).toHaveBeenCalledWith(
        'user-123',
        '/api/papers',
        1 // Default cost
      )
    })
  })
})