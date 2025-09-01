import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getNotificationService } from '@/services/notifications/NotificationService'

/**
 * POST /api/notifications/mark-all-read - Mark all notifications as read
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

    const notificationService = getNotificationService()
    const updatedCount = await notificationService.markAllAsRead(user.id)

    return NextResponse.json({
      success: true,
      updatedCount
    })
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}