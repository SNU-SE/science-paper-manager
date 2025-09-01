import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const severity = searchParams.get('severity')
    const resolved = searchParams.get('resolved')
    const timeRange = searchParams.get('timeRange') || '24h'

    // Calculate time range
    let startTime: Date
    switch (timeRange) {
      case '1h':
        startTime = new Date(Date.now() - 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
    }

    // Build query
    let query = supabase
      .from('security_events')
      .select('*')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity)
    }

    if (resolved !== null) {
      query = query.eq('resolved', resolved === 'true')
    }

    const { data: securityEvents, error } = await query

    if (error) {
      throw error
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startTime.toISOString())

    if (severity) {
      countQuery = countQuery.eq('severity', severity)
    }

    if (resolved !== null) {
      countQuery = countQuery.eq('resolved', resolved === 'true')
    }

    const { count } = await countQuery

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('security_events')
      .select('severity, resolved, event_type')
      .gte('created_at', startTime.toISOString())

    const summary = {
      total: summaryData?.length || 0,
      bySeverity: summaryData?.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      byType: summaryData?.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {},
      resolved: summaryData?.filter(e => e.resolved).length || 0,
      unresolved: summaryData?.filter(e => !e.resolved).length || 0
    }

    return NextResponse.json({
      success: true,
      data: securityEvents || [],
      summary,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      filters: {
        severity,
        resolved,
        timeRange
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Security events fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch security events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Create a new security event
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    const eventData = await request.json()

    const {
      event_type,
      severity = 'medium',
      message,
      user_id,
      ip_address,
      user_agent,
      metadata = {}
    } = eventData

    if (!event_type || !message) {
      return NextResponse.json(
        { success: false, error: 'Event type and message are required' },
        { status: 400 }
      )
    }

    const { data: securityEvent, error } = await supabase
      .from('security_events')
      .insert({
        event_type,
        severity,
        message,
        user_id,
        ip_address,
        user_agent,
        metadata,
        resolved: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // If it's a critical event, trigger immediate notifications
    if (severity === 'critical') {
      // TODO: Implement immediate notification logic
      console.log('Critical security event created:', securityEvent)
    }

    return NextResponse.json({
      success: true,
      data: securityEvent,
      message: 'Security event created successfully'
    })

  } catch (error) {
    console.error('Security event creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create security event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}