import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getNotificationService } from '@/services/notifications/NotificationService'

/**
 * GET /api/notifications/settings - Get user's notification settings
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

    const notificationService = getNotificationService()
    const settings = await notificationService.getUserNotificationSettings(user.id)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Failed to get notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to get notification settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/settings - Update user's notification settings
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

    const body = await request.json()
    const { type, enabled, deliveryMethod } = body

    if (!type || enabled === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: type, enabled' },
        { status: 400 }
      )
    }

    const validTypes = [
      'ai_analysis_complete',
      'ai_analysis_failed',
      'new_paper_added',
      'system_update',
      'security_alert',
      'backup_complete'
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    const validDeliveryMethods = ['web', 'email', 'push']
    const method = deliveryMethod || 'web'

    if (!validDeliveryMethods.includes(method)) {
      return NextResponse.json(
        { error: 'Invalid delivery method' },
        { status: 400 }
      )
    }

    const notificationService = getNotificationService()
    const success = await notificationService.updateNotificationSettings(
      user.id,
      type,
      enabled,
      method
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update notification settings:', error)
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    )
  }
}