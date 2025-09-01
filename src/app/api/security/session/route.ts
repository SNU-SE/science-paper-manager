import { NextRequest, NextResponse } from 'next/server'
import { securityService } from '@/services/security/SecurityService'
import { securityMiddleware } from '@/middleware/securityMiddleware'

/**
 * Create new session
 * POST /api/security/session
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, credentials } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if account is locked
    const isLocked = await securityService.isAccountLocked(userId)
    if (isLocked) {
      await securityService.logSecurityEvent(userId, 'login_attempt_locked_account', 'high', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent')
      })
      
      return NextResponse.json(
        { error: 'Account is temporarily locked due to suspicious activity' },
        { status: 423 }
      )
    }

    // Generate session fingerprint
    const fingerprint = securityService.generateSessionFingerprint(request)
    
    // Create new session
    const sessionToken = await securityService.createSession(userId, fingerprint)
    
    // Log successful login
    await securityService.logSecurityEvent(userId, 'login_success', 'low', {
      fingerprint,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent')
    })

    // Set secure cookie
    const response = NextResponse.json({
      success: true,
      sessionId: sessionToken.substring(0, 16) // Return partial token as session ID
    })

    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Session creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

/**
 * Validate current session
 * GET /api/security/session
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session token found' },
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

    return NextResponse.json({
      valid: true,
      userId: validation.userId,
      expiresAt: validation.expiresAt,
      needsRefresh: validation.needsRefresh
    })
  } catch (error) {
    console.error('Session validation failed:', error)
    return NextResponse.json(
      { error: 'Session validation failed' },
      { status: 500 }
    )
  }
}

/**
 * Invalidate session (logout)
 * DELETE /api/security/session
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value
    
    if (sessionToken) {
      await securityService.invalidateSession(sessionToken)
      
      // Log logout
      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)
      
      if (validation.userId) {
        await securityService.logSecurityEvent(validation.userId, 'logout', 'low', {
          fingerprint,
          ip: request.headers.get('x-forwarded-for') || 'unknown'
        })
      }
    }

    const response = NextResponse.json({ success: true })
    
    // Clear session cookie
    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Session invalidation failed:', error)
    return NextResponse.json(
      { error: 'Failed to invalidate session' },
      { status: 500 }
    )
  }
}