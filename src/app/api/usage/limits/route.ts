import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { apiUsageService } from '@/services/usage/APIUsageService'

/**
 * GET /api/usage/limits - Get user's rate limits
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

    // Get user's rate limits
    const rateLimits = await apiUsageService.getUserRateLimits(user.id)

    return NextResponse.json({ rateLimits })
  } catch (error) {
    console.error('Error getting rate limits:', error)
    return NextResponse.json(
      { error: 'Failed to get rate limits' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/usage/limits - Update user's rate limits (admin only)
 */
export async function PUT(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      targetUserId, 
      limitType, 
      endpointPattern, 
      maxRequests, 
      maxCostUnits 
    } = body

    if (!targetUserId || !limitType || !maxRequests || !maxCostUnits) {
      return NextResponse.json(
        { error: 'Missing required fields: targetUserId, limitType, maxRequests, maxCostUnits' },
        { status: 400 }
      )
    }

    if (!['daily', 'hourly', 'monthly'].includes(limitType)) {
      return NextResponse.json(
        { error: 'Invalid limitType. Must be daily, hourly, or monthly' },
        { status: 400 }
      )
    }

    // Update the rate limit
    await apiUsageService.updateUserRateLimit(
      targetUserId,
      limitType,
      endpointPattern || null,
      maxRequests,
      maxCostUnits
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating rate limits:', error)
    return NextResponse.json(
      { error: 'Failed to update rate limits' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/usage/limits/check - Check rate limit for specific endpoint
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
    const { endpoint, costUnits = 1 } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing required field: endpoint' },
        { status: 400 }
      )
    }

    // Check rate limit
    const limitInfo = await apiUsageService.checkRateLimit(user.id, endpoint, costUnits)

    return NextResponse.json({ limitInfo })
  } catch (error) {
    console.error('Error checking rate limit:', error)
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    )
  }
}