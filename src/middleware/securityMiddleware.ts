import { NextRequest, NextResponse } from 'next/server'
import { securityService } from '@/services/security/SecurityService'

export interface SecurityMiddlewareOptions {
  requireCSRF?: boolean
  logAccess?: boolean
  checkSuspiciousActivity?: boolean
  rateLimitRequests?: boolean
}

/**
 * Security middleware for API routes
 * Implements CSRF protection, access logging, and suspicious activity detection
 */
export function securityMiddleware(options: SecurityMiddlewareOptions = {}) {
  return async function middleware(
    request: NextRequest,
    context: { params?: any },
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const {
      requireCSRF = false,
      logAccess = true,
      checkSuspiciousActivity = true,
      rateLimitRequests = false
    } = options

    try {
      const startTime = Date.now()
      const userId = await extractUserIdFromRequest(request)
      const fingerprint = securityService.generateSessionFingerprint(request)
      const action = `${request.method} ${request.nextUrl.pathname}`

      // Check if account is locked
      if (userId && await securityService.isAccountLocked(userId)) {
        return NextResponse.json(
          { error: 'Account is temporarily locked due to suspicious activity' },
          { status: 423 } // Locked
        )
      }

      // CSRF Protection for state-changing operations
      if (requireCSRF && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const csrfToken = request.headers.get('x-csrf-token')
        const sessionId = request.headers.get('x-session-id')

        if (!csrfToken || !sessionId) {
          await logSecurityEvent(userId, 'csrf_token_missing', 'medium', {
            action,
            ip: getClientIP(request),
            userAgent: request.headers.get('user-agent')
          })
          
          return NextResponse.json(
            { error: 'CSRF token required' },
            { status: 403 }
          )
        }

        const isValidCSRF = await securityService.validateCSRFToken(csrfToken, sessionId)
        if (!isValidCSRF) {
          await logSecurityEvent(userId, 'csrf_token_invalid', 'high', {
            action,
            csrfToken: csrfToken.substring(0, 8) + '...',
            sessionId,
            ip: getClientIP(request),
            userAgent: request.headers.get('user-agent')
          })
          
          return NextResponse.json(
            { error: 'Invalid CSRF token' },
            { status: 403 }
          )
        }
      }

      // Rate limiting (basic implementation)
      if (rateLimitRequests && userId) {
        const isRateLimited = await checkRateLimit(userId, action)
        if (isRateLimited) {
          await logSecurityEvent(userId, 'rate_limit_exceeded', 'medium', {
            action,
            ip: getClientIP(request)
          })
          
          return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429 }
          )
        }
      }

      // Execute the actual request
      const response = await next()
      const duration = Date.now() - startTime

      // Log access if enabled
      if (logAccess) {
        await logSecurityEvent(userId, action, 'low', {
          method: request.method,
          path: request.nextUrl.pathname,
          statusCode: response.status,
          duration,
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent'),
          fingerprint
        })
      }

      // Check for suspicious activity
      if (checkSuspiciousActivity && userId) {
        const assessment = await securityService.detectSuspiciousActivity(userId, action, {
          method: request.method,
          path: request.nextUrl.pathname,
          statusCode: response.status,
          duration,
          ip: getClientIP(request),
          userAgent: request.headers.get('user-agent'),
          fingerprint
        })

        // Add security headers to response if suspicious activity detected
        if (assessment.suspiciousActivity) {
          response.headers.set('X-Security-Warning', 'Suspicious activity detected')
          response.headers.set('X-Risk-Level', assessment.riskLevel)
        }
      }

      // Add security headers
      addSecurityHeaders(response)

      return response
    } catch (error) {
      console.error('Security middleware error:', error)
      
      // Log the error but don't block the request
      if (logAccess) {
        await logSecurityEvent(null, 'security_middleware_error', 'high', {
          error: error instanceof Error ? error.message : 'Unknown error',
          action: `${request.method} ${request.nextUrl.pathname}`,
          ip: getClientIP(request)
        })
      }

      // Continue with the request
      return await next()
    }
  }
}

/**
 * Extract user ID from request (from session, JWT, etc.)
 */
async function extractUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // Try to get from Authorization header (JWT)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Decode JWT to get user ID (simplified - in production use proper JWT library)
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || payload.user_id || null
    }

    // Try to get from session cookie
    const sessionToken = request.cookies.get('session-token')?.value
    if (sessionToken) {
      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)
      return validation.isValid ? validation.userId || null : null
    }

    return null
  } catch (error) {
    console.error('Failed to extract user ID from request:', error)
    return null
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || remoteAddr || 'unknown'
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Enable XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy (basic)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  )
  
  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

/**
 * Basic rate limiting check
 */
async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  try {
    // This is a simplified rate limiting implementation
    // In production, you might want to use Redis or a dedicated rate limiting service
    
    const key = `rate_limit:${userId}:${action}`
    const windowMs = 60 * 1000 // 1 minute window
    const maxRequests = 100 // Max 100 requests per minute
    
    // For now, we'll use a simple in-memory store
    // In production, use Redis or similar
    const now = Date.now()
    const windowStart = now - windowMs
    
    // This would be implemented with Redis in production
    // For now, return false (no rate limiting)
    return false
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return false
  }
}

/**
 * Log security events
 */
async function logSecurityEvent(
  userId: string | null,
  action: string,
  riskLevel: string,
  metadata: any
): Promise<void> {
  try {
    if (userId) {
      await securityService.logSecurityEvent(userId, action, riskLevel, metadata)
    } else {
      // Log anonymous events to a separate system or with null user_id
      console.log('Anonymous security event:', { action, riskLevel, metadata })
    }
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

/**
 * Session validation middleware
 */
export function sessionValidationMiddleware() {
  return async function middleware(
    request: NextRequest,
    context: { params?: any },
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      const sessionToken = request.cookies.get('session-token')?.value
      
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session token required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401 }
        )
      }

      // Add user ID to request headers for downstream use
      const response = await next()
      response.headers.set('X-User-ID', validation.userId || '')
      
      // If session needs refresh, add header
      if (validation.needsRefresh) {
        response.headers.set('X-Session-Refresh-Required', 'true')
      }

      return response
    } catch (error) {
      console.error('Session validation middleware error:', error)
      return NextResponse.json(
        { error: 'Session validation failed' },
        { status: 500 }
      )
    }
  }
}

/**
 * CSRF token generation endpoint middleware
 */
export function csrfTokenMiddleware() {
  return async function middleware(
    request: NextRequest,
    context: { params?: any },
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      const sessionId = request.headers.get('x-session-id')
      
      if (!sessionId) {
        return NextResponse.json(
          { error: 'Session ID required' },
          { status: 400 }
        )
      }

      const tokenData = securityService.generateCSRFToken(sessionId)
      await securityService.storeCSRFToken(tokenData)

      return NextResponse.json({
        csrfToken: tokenData.token,
        expiresAt: tokenData.expiresAt
      })
    } catch (error) {
      console.error('CSRF token generation failed:', error)
      return NextResponse.json(
        { error: 'Failed to generate CSRF token' },
        { status: 500 }
      )
    }
  }
}