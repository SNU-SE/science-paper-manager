import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { apiUsageService } from '@/services/usage/APIUsageService'

/**
 * GET /api/usage - Get user's usage statistics
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
        // Get user from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
    const includeRateLimits = searchParams.get('includeRateLimits') === 'true'

    // Get usage statistics
    const statistics = await apiUsageService.getUserUsageStatistics(user.id, startDate, endDate)

    // Get rate limits if requested
    let rateLimits = undefined
    if (includeRateLimits) {
      rateLimits = await apiUsageService.getUserRateLimits(user.id)
    }

    return NextResponse.json({
      statistics,
      rateLimits,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }
    })
  } catch (error) {
    console.error('Error getting usage statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get usage statistics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/usage/track - Manually track API usage (for testing)
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
        // Get user from request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { endpoint, method, provider, costUnits, requestSize, responseSize } = body

    if (!endpoint || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, method' },
        { status: 400 }
      )
    }

    // Track the usage
    await apiUsageService.trackUsage({
      userId: user.id,
      endpoint,
      method,
      provider,
      costUnits,
      requestSize,
      responseSize,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.ip,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking usage:', error)
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    )
  }
}