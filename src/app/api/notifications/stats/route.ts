import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getNotificationService } from '@/services/notifications/NotificationService'

/**
 * GET /api/notifications/stats - Get user's notification statistics
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
    
    // Get comprehensive stats
    const [stats, unreadCount] = await Promise.all([
      notificationService.getNotificationStats(user.id),
      notificationService.getUnreadCount(user.id)
    ])

    return NextResponse.json({
      ...stats,
      unreadCount // Ensure we have the most up-to-date unread count
    })
  } catch (error) {
    console.error('Failed to get notification stats:', error)
    return NextResponse.json(
      { error: 'Failed to get notification stats' },
      { status: 500 }
    )
  }
}