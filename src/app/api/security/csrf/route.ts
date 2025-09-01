import { NextRequest, NextResponse } from 'next/server'
import { securityService } from '@/services/security/SecurityService'

/**
 * Generate CSRF token
 * POST /api/security/csrf
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 401 }
      )
    }

    // Validate session first
    const fingerprint = securityService.generateSessionFingerprint(request)
    const validation = await securityService.validateSession(sessionToken, fingerprint)

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Generate CSRF token using session ID
    const sessionId = sessionToken.substring(0, 16)
    const tokenData = securityService.generateCSRFToken(sessionId)
    
    // Store the token
    await securityService.storeCSRFToken(tokenData)

    // Log CSRF token generation
    if (validation.userId) {
      await securityService.logSecurityEvent(validation.userId, 'csrf_token_generated', 'low', {
        sessionId,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
    }

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

/**
 * Validate CSRF token
 * GET /api/security/csrf
 */
export async function GET(request: NextRequest) {
  try {
    const csrfToken = request.headers.get('x-csrf-token')
    const sessionId = request.headers.get('x-session-id')

    if (!csrfToken || !sessionId) {
      return NextResponse.json(
        { error: 'CSRF token and session ID required' },
        { status: 400 }
      )
    }

    const isValid = await securityService.validateCSRFToken(csrfToken, sessionId)

    return NextResponse.json({
      valid: isValid
    })
  } catch (error) {
    console.error('CSRF token validation failed:', error)
    return NextResponse.json(
      { error: 'CSRF token validation failed' },
      { status: 500 }
    )
  }
}