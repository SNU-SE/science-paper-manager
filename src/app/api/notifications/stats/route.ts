import { NextRequest, NextResponse } from 'next/server'
import { getNotificationService } from '@/services/notifications/NotificationService'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/notifications/stats - Get user's notification statistics
 */
export async function GET(request: NextRequest) {
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