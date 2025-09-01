import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { securityService } from '@/services/security/SecurityService'
import { securityMiddleware } from '@/middleware/securityMiddleware'

/**
 * Get user's security activity log
 * GET /api/security/activity
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  // Apply security middleware
  const middleware = securityMiddleware({ 
    logAccess: true, 
    checkSuspiciousActivity: true 
  })
  
  return middleware(request, {}, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')
      const riskLevel = searchParams.get('riskLevel')
      const action = searchParams.get('action')

      // Get user ID from session
      const sessionToken = request.cookies.get('session-token')?.value
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }

      const userId = validation.userId

      // Build query
      let query = supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (riskLevel) {
        query = query.eq('risk_level', riskLevel)
      }

      if (action) {
        query = query.ilike('action', `%${action}%`)
      }

      const { data: activities, error } = await query

      if (error) {
        throw error
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (riskLevel) {
        countQuery = countQuery.eq('risk_level', riskLevel)
      }

      if (action) {
        countQuery = countQuery.ilike('action', `%${action}%`)
      }

      const { count } = await countQuery

      return NextResponse.json({
        activities: activities || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      })
    } catch (error) {
      console.error('Security activity retrieval failed:', error)
      return NextResponse.json(
        { error: 'Failed to retrieve security activity' },
        { status: 500 }
      )
    }
  })
}

/**
 * Analyze user's security patterns
 * POST /api/security/activity/analyze
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  // Apply security middleware
  const middleware = securityMiddleware({ 
    requireCSRF: true, 
    logAccess: true, 
    checkSuspiciousActivity: true 
  })
  
  return middleware(request, {}, async () => {
    try {
      const { action, metadata } = await request.json()

      // Get user ID from session
      const sessionToken = request.cookies.get('session-token')?.value
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }

      const userId = validation.userId

      // Perform suspicious activity detection
      const assessment = await securityService.detectSuspiciousActivity(
        userId, 
        action || 'manual_analysis', 
        {
          ...metadata,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent'),
          fingerprint
        }
      )

      return NextResponse.json({
        assessment,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Security analysis failed:', error)
      return NextResponse.json(
        { error: 'Failed to analyze security patterns' },
        { status: 500 }
      )
    }
  })
}

/**
 * Get security statistics for user
 * GET /api/security/activity/stats
 */
export async function stats(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    // Get user ID from session
    const sessionToken = request.cookies.get('session-token')?.value
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session required' },
        { status: 401 }
      )
    }

    const fingerprint = securityService.generateSessionFingerprint(request)
    const validation = await securityService.validateSession(sessionToken, fingerprint)

    if (!validation.isValid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const userId = validation.userId

    // Get activity statistics
    const { data: riskLevelStats } = await supabase
      .from('security_logs')
      .select('risk_level')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    const { data: actionStats } = await supabase
      .from('security_logs')
      .select('action')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

    const { data: recentActivity } = await supabase
      .from('security_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate statistics
    const riskLevelCounts = (riskLevelStats || []).reduce((acc: any, log: any) => {
      acc[log.risk_level] = (acc[log.risk_level] || 0) + 1
      return acc
    }, {})

    const actionCounts = (actionStats || []).reduce((acc: any, log: any) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    }, {})

    // Check account status
    const { data: securityStatus } = await supabase
      .from('user_security_status')
      .select('*')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      riskLevelDistribution: riskLevelCounts,
      topActions: Object.entries(actionCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10),
      recentActivity: recentActivity || [],
      accountStatus: {
        isLocked: securityStatus?.is_locked || false,
        lockReason: securityStatus?.lock_reason,
        lockedAt: securityStatus?.locked_at,
        lockExpiresAt: securityStatus?.lock_expires_at,
        failedLoginAttempts: securityStatus?.failed_login_attempts || 0
      },
      summary: {
        totalEvents: (riskLevelStats || []).length,
        highRiskEvents: riskLevelCounts.high || 0,
        criticalEvents: riskLevelCounts.critical || 0,
        recentEvents: (actionStats || []).length
      }
    })
  } catch (error) {
    console.error('Security statistics retrieval failed:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve security statistics' },
      { status: 500 }
    )
  }
}