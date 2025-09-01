import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getNotificationService } from '@/services/notifications/NotificationService'

/**
 * GET /api/notifications - Get user's notifications
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
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const notificationService = getNotificationService()
    const notifications = await notificationService.getUserNotifications(user.id, limit, offset)

    return NextResponse.json({
      notifications,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit
      }
    })
  } catch (error) {
    console.error('Failed to get notifications:', error)
    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications - Send a notification (admin only)
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
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin (you may need to adjust this based on your user roles system)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, type, title, message, data, priority } = body

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, message' },
        { status: 400 }
      )
    }

    const notificationService = getNotificationService()
    const notificationId = await notificationService.sendNotification(userId, {
      type,
      title,
      message,
      data,
      priority: priority || 'medium'
    })

    return NextResponse.json({
      success: true,
      notificationId
    })
  } catch (error) {
    console.error('Failed to send notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}