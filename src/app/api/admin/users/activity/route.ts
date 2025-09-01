import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get active user sessions with user details
    const { data: userSessions, error } = await supabase
      .from('user_sessions')
      .select(`
        user_id,
        last_activity,
        session_duration,
        actions_count,
        ip_address,
        user_agent,
        users!inner(email, created_at)
      `)
      .gte('last_activity', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Transform the data for the frontend
    const userActivity = userSessions?.map(session => ({
      userId: session.user_id,
      email: session.users.email,
      lastActivity: session.last_activity,
      sessionDuration: session.session_duration || 0,
      actionsCount: session.actions_count || 0,
      ipAddress: session.ip_address || 'Unknown',
      userAgent: session.user_agent || 'Unknown'
    })) || []

    // Get total count for pagination
    const { count } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      success: true,
      data: userActivity,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('User activity fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch user activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get detailed user activity for a specific user
export async function POST(request: NextRequest) {
  try {
    const { userId, timeRange } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const startTime = timeRange?.start 
      ? new Date(timeRange.start)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default: last 7 days

    const endTime = timeRange?.end 
      ? new Date(timeRange.end)
      : new Date()

    // Get user's activity logs
    const { data: activityLogs, error: logsError } = await supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString())
      .order('created_at', { ascending: false })

    if (logsError) {
      throw logsError
    }

    // Get user's API usage
    const { data: apiUsage, error: usageError } = await supabase
      .from('api_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString())

    if (usageError) {
      throw usageError
    }

    // Get user's background jobs
    const { data: backgroundJobs, error: jobsError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString())
      .order('created_at', { ascending: false })

    if (jobsError) {
      throw jobsError
    }

    // Calculate activity statistics
    const activityStats = {
      totalActions: activityLogs?.length || 0,
      apiCalls: apiUsage?.length || 0,
      backgroundJobs: backgroundJobs?.length || 0,
      mostUsedFeatures: activityLogs?.reduce((acc, log) => {
        const feature = log.action_type
        acc[feature] = (acc[feature] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      dailyActivity: activityLogs?.reduce((acc, log) => {
        const date = new Date(log.created_at).toDateString()
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        timeRange: { start: startTime, end: endTime },
        activityLogs: activityLogs || [],
        apiUsage: apiUsage || [],
        backgroundJobs: backgroundJobs || [],
        statistics: activityStats
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Detailed user activity fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch detailed user activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}