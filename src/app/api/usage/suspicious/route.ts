import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiUsageService } from '@/services/usage/APIUsageService'

/**
 * GET /api/usage/suspicious - Get suspicious activity
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

    const isAdmin = !profileError && profile?.role === 'admin'

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeResolved = searchParams.get('includeResolved') === 'true'
    const targetUserId = searchParams.get('userId')

    // Non-admin users can only see their own suspicious activity
    const userId = isAdmin ? targetUserId : user.id

    // Get suspicious activity
    const activities = await apiUsageService.getSuspiciousActivity(userId, includeResolved)

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error getting suspicious activity:', error)
    return NextResponse.json(
      { error: 'Failed to get suspicious activity' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/usage/suspicious/[id]/resolve - Resolve suspicious activity (admin only)
 */
export async function PUT(request: NextRequest) {
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
    const { activityId } = body

    if (!activityId) {
      return NextResponse.json(
        { error: 'Missing required field: activityId' },
        { status: 400 }
      )
    }

    // Resolve the suspicious activity
    await apiUsageService.resolveSuspiciousActivity(activityId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resolving suspicious activity:', error)
    return NextResponse.json(
      { error: 'Failed to resolve suspicious activity' },
      { status: 500 }
    )
  }
}