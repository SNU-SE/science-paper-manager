import { NextRequest, NextResponse } from 'next/server'
import { createAPIUsageService } from '@/services/usage/APIUsageService'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export interface RateLimitConfig {
  skipPaths?: string[]
  skipMethods?: string[]
  costCalculator?: (req: NextRequest) => number
  onRateLimitExceeded?: (req: NextRequest, limitInfo: any) => NextResponse
}

/**
 * Rate limiting middleware for API routes
 */
export function createRateLimitMiddleware(config: RateLimitConfig = {}) {
  const {
    skipPaths = ['/api/health', '/api/auth'],
    skipMethods = ['OPTIONS'],
    costCalculator = defaultCostCalculator,
    onRateLimitExceeded = defaultRateLimitHandler
  } = config

  return async function rateLimitMiddleware(
    req: NextRequest,
    context: { params?: any }
  ): Promise<NextResponse | void> {
    // Create service instances
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      // If Supabase is not available, skip rate limiting
      return
    }
    const apiUsageService = createAPIUsageService(supabase)

    // Skip rate limiting for certain paths and methods
    const pathname = req.nextUrl.pathname
    const method = req.method

    if (skipMethods.includes(method) || skipPaths.some(path => pathname.startsWith(path))) {
      return
    }

    try {
      // Get user ID from request
      const userId = await getUserIdFromRequest(req)
      if (!userId) {
        // Skip rate limiting for unauthenticated requests
        return
      }

      // Calculate cost for this request
      const costUnits = costCalculator(req)

      // Check rate limits
      const limitInfo = await apiUsageService.checkRateLimit(userId, pathname, costUnits)

      if (!limitInfo.allowed) {
        return onRateLimitExceeded(req, limitInfo)
      }

      // Track the usage (will be done after successful request)
      // Store tracking info in request headers for later use
      const trackingInfo = {
        userId,
        endpoint: pathname,
        method,
        costUnits,
        requestSize: getRequestSize(req),
        ipAddress: getClientIP(req),
        userAgent: req.headers.get('user-agent') || undefined
      }

      // Add tracking info to request headers for use in response tracking
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-usage-tracking', JSON.stringify(trackingInfo))

      // Create new request with tracking headers
      const newRequest = new NextRequest(req.url, {
        method: req.method,
        headers: requestHeaders,
        body: req.body
      })

      // Continue to next middleware/handler
      return
    } catch (error) {
      console.error('Rate limiting middleware error:', error)
      // Continue on error to avoid breaking the request
      return
    }
  }
}

/**
 * Response tracking middleware to record successful API usage
 */
export function createUsageTrackingMiddleware() {
  return async function usageTrackingMiddleware(
    req: NextRequest,
    response: NextResponse
  ): Promise<NextResponse> {
    try {
      const trackingInfoHeader = req.headers.get('x-usage-tracking')
      if (!trackingInfoHeader) {
        return response
      }

      const trackingInfo = JSON.parse(trackingInfoHeader)
      
      // Only track successful requests (2xx status codes)
      if (response.status >= 200 && response.status < 300) {
        const supabase = createServerSupabaseClient()
        if (supabase) {
          const apiUsageService = createAPIUsageService(supabase)
          
          // Add response size to tracking info
          const responseSize = getResponseSize(response)
          
          await apiUsageService.trackUsage({
            ...trackingInfo,
            responseSize
          })
        }
      }

      // Remove tracking header from response
      const responseHeaders = new Headers(response.headers)
      responseHeaders.delete('x-usage-tracking')

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    } catch (error) {
      console.error('Usage tracking middleware error:', error)
      return response
    }
  }
}

/**
 * Default cost calculator - assigns different costs based on endpoint
 */
function defaultCostCalculator(req: NextRequest): number {
  const pathname = req.nextUrl.pathname
  const method = req.method

  // AI analysis endpoints are more expensive
  if (pathname.includes('/ai-analysis')) {
    return 10
  }

  // Search endpoints have moderate cost
  if (pathname.includes('/search') || pathname.includes('/rag')) {
    return 3
  }

  // Upload endpoints have higher cost
  if (pathname.includes('/upload') && method === 'POST') {
    return 5
  }

  // Background job endpoints
  if (pathname.includes('/jobs')) {
    return 2
  }

  // Default cost for other endpoints
  return 1
}

/**
 * Default rate limit exceeded handler
 */
function defaultRateLimitHandler(req: NextRequest, limitInfo: any): NextResponse {
  const resetTime = limitInfo.resetTime ? new Date(limitInfo.resetTime).toISOString() : undefined

  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: `You have exceeded your ${limitInfo.limitType} rate limit`,
      details: {
        limitType: limitInfo.limitType,
        maxRequests: limitInfo.maxRequests,
        currentRequests: limitInfo.currentRequests,
        maxCostUnits: limitInfo.maxCostUnits,
        currentCostUnits: limitInfo.currentCostUnits,
        resetTime,
        retryAfter: resetTime ? Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000) : undefined
      }
    },
    { 
      status: 429,
      headers: {
        'Retry-After': resetTime ? Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000).toString() : '3600',
        'X-RateLimit-Limit': limitInfo.maxRequests?.toString() || '0',
        'X-RateLimit-Remaining': Math.max(0, (limitInfo.maxRequests || 0) - (limitInfo.currentRequests || 0)).toString(),
        'X-RateLimit-Reset': resetTime || new Date(Date.now() + 3600000).toISOString()
      }
    }
  )
}

/**
 * Extract user ID from request (from JWT token or session)
 */
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return null
    }

    // Try to get user from Authorization header
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return user.id
      }
    }

    // Try to get user from session cookie
    const sessionCookie = req.cookies.get('sb-access-token')
    if (sessionCookie) {
      const { data: { user }, error } = await supabase.auth.getUser(sessionCookie.value)
      if (!error && user) {
        return user.id
      }
    }

    return null
  } catch (error) {
    console.error('Error extracting user ID from request:', error)
    return null
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(req: NextRequest): string | undefined {
  // Check various headers for client IP
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return req.ip || undefined
}

/**
 * Estimate request size in bytes
 */
function getRequestSize(req: NextRequest): number | undefined {
  try {
    const contentLength = req.headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }

    // Estimate based on headers and URL
    const headersSize = Array.from(req.headers.entries())
      .reduce((size, [key, value]) => size + key.length + value.length + 4, 0) // +4 for ': ' and '\r\n'
    
    const urlSize = req.url.length
    
    return headersSize + urlSize
  } catch (error) {
    return undefined
  }
}

/**
 * Estimate response size in bytes
 */
function getResponseSize(response: NextResponse): number | undefined {
  try {
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }

    // Estimate based on headers
    const headersSize = Array.from(response.headers.entries())
      .reduce((size, [key, value]) => size + key.length + value.length + 4, 0)
    
    return headersSize
  } catch (error) {
    return undefined
  }
}

// Export pre-configured middleware instances
export const rateLimitMiddleware = createRateLimitMiddleware()
export const usageTrackingMiddleware = createUsageTrackingMiddleware()