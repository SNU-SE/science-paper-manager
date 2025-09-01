import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiUsageService } from '@/services/usage/APIUsageService'

/**
 * GET /api/usage/admin - Get system-wide usage statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    // Get system-wide usage statistics
    const statistics = await apiUsageService.getSystemUsageStatistics(startDate, endDate)

    // Get recent suspicious activity
    const suspiciousActivity = await apiUsageService.getSuspiciousActivity(undefined, false)

    return NextResponse.json({
      statistics,
      suspiciousActivity: suspiciousActivity.slice(0, 10), // Latest 10 activities
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }
    })
  } catch (error) {
    console.error('Error getting admin usage statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get usage statistics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/usage/admin/user-stats - Get detailed statistics for a specific user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
    const { targetUserId, startDate, endDate } = body

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Missing required field: targetUserId' },
        { status: 400 }
      )
    }

    const start = startDate ? new Date(startDate) : undefined
    const end = endDate ? new Date(endDate) : undefined

    // Get user statistics
    const statistics = await apiUsageService.getUserUsageStatistics(targetUserId, start, end)
    const rateLimits = await apiUsageService.getUserRateLimits(targetUserId)
    const suspiciousActivity = await apiUsageService.getSuspiciousActivity(targetUserId, true)

    // Get user profile information
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('email, full_name, role, created_at')
      .eq('user_id', targetUserId)
      .single()

    return NextResponse.json({
      user: userProfile || { user_id: targetUserId },
      statistics,
      rateLimits,
      suspiciousActivity,
      period: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      }
    })
  } catch (error) {
    console.error('Error getting user statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get user statistics' },
      { status: 500 }
    )
  }
}