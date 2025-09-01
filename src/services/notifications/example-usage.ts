/**
 * Example usage of the Notification System
 * 
 * This file demonstrates how to integrate and use the real-time notification system
 * in your application.
 */

import { getNotificationService } from './NotificationService'
import { getWebSocketServer } from '@/lib/websocket-server'

// Example 1: Sending notifications from background jobs
export async function sendAIAnalysisCompleteNotification(
  userId: string, 
  paperId: string, 
  analysisResults: any
) {
  const notificationService = getNotificationService()
  
  await notificationService.sendNotification(userId, {
    type: 'ai_analysis_complete',
    title: 'AI Analysis Complete',
    message: `Your AI analysis for paper "${analysisResults.title}" is ready to view.`,
    data: {
      paperId,
      analysisId: analysisResults.id,
      providers: analysisResults.providers,
      completedAt: new Date().toISOString()
    },
    priority: 'medium'
  })
}

// Example 2: Sending system-wide notifications
export async function sendSystemMaintenanceNotification() {
  const notificationService = getNotificationService()
  
  // This would typically get all user IDs from the database
  const userIds = await getAllUserIds()
  
  for (const userId of userIds) {
    await notificationService.sendNotification(userId, {
      type: 'system_update',
      title: 'Scheduled Maintenance',
      message: 'The system will undergo maintenance tonight from 2:00 AM to 4:00 AM UTC. Some features may be temporarily unavailable.',
      data: {
        maintenanceStart: '2024-01-15T02:00:00Z',
        maintenanceEnd: '2024-01-15T04:00:00Z',
        affectedServices: ['AI Analysis', 'File Upload']
      },
      priority: 'high'
    })
  }
}

// Example 3: Sending security alerts
export async function sendSecurityAlert(userId: string, alertType: string, details: any) {
  const notificationService = getNotificationService()
  
  await notificationService.sendNotification(userId, {
    type: 'security_alert',
    title: 'Security Alert',
    message: `Suspicious activity detected: ${alertType}. Please review your account security.`,
    data: {
      alertType,
      timestamp: new Date().toISOString(),
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      action: details.action
    },
    priority: 'urgent'
  })
}

// Example 4: Integration with background job completion
export async function onBackgroundJobComplete(jobId: string, userId: string, result: any) {
  const notificationService = getNotificationService()
  
  if (result.success) {
    await notificationService.sendNotification(userId, {
      type: 'ai_analysis_complete',
      title: 'Background Job Complete',
      message: `Your ${result.jobType} job has completed successfully.`,
      data: {
        jobId,
        jobType: result.jobType,
        duration: result.duration,
        result: result.data
      },
      priority: 'medium'
    })
  } else {
    await notificationService.sendNotification(userId, {
      type: 'ai_analysis_failed',
      title: 'Background Job Failed',
      message: `Your ${result.jobType} job encountered an error: ${result.error}`,
      data: {
        jobId,
        jobType: result.jobType,
        error: result.error,
        retryable: result.retryable
      },
      priority: 'high'
    })
  }
}

// Example 5: Real-time notification broadcasting
export function broadcastSystemStatus(status: 'online' | 'maintenance' | 'degraded') {
  const wsServer = getWebSocketServer()
  
  if (wsServer) {
    wsServer.broadcast({
      type: 'notification',
      data: {
        id: `system-status-${Date.now()}`,
        type: 'system_update',
        title: 'System Status Update',
        message: `System status changed to: ${status}`,
        priority: status === 'maintenance' ? 'high' : 'medium',
        createdAt: new Date().toISOString()
      }
    })
  }
}

// Example 6: Notification cleanup job (run periodically)
export async function cleanupNotificationsJob() {
  const notificationService = getNotificationService()
  
  try {
    const deletedCount = await notificationService.cleanupExpiredNotifications()
    console.log(`Cleaned up ${deletedCount} expired notifications`)
    
    // Optionally send admin notification about cleanup
    if (deletedCount > 0) {
      await notificationService.sendNotification('admin-user-id', {
        type: 'backup_complete',
        title: 'Notification Cleanup Complete',
        message: `Successfully cleaned up ${deletedCount} expired notifications.`,
        data: {
          deletedCount,
          cleanupTime: new Date().toISOString()
        },
        priority: 'low'
      })
    }
  } catch (error) {
    console.error('Notification cleanup failed:', error)
    
    // Send error notification to admin
    await notificationService.sendNotification('admin-user-id', {
      type: 'security_alert',
      title: 'Notification Cleanup Failed',
      message: `Notification cleanup job failed: ${error.message}`,
      data: {
        error: error.message,
        timestamp: new Date().toISOString()
      },
      priority: 'high'
    })
  }
}

// Example 7: User preference management
export async function updateUserNotificationPreferences(
  userId: string, 
  preferences: Record<string, boolean>
) {
  const notificationService = getNotificationService()
  
  for (const [type, enabled] of Object.entries(preferences)) {
    await notificationService.updateNotificationSettings(
      userId,
      type as any,
      enabled
    )
  }
  
  // Send confirmation
  await notificationService.sendNotification(userId, {
    type: 'system_update',
    title: 'Notification Preferences Updated',
    message: 'Your notification preferences have been successfully updated.',
    data: {
      updatedPreferences: preferences,
      updatedAt: new Date().toISOString()
    },
    priority: 'low'
  })
}

// Helper function (would be implemented based on your user management system)
async function getAllUserIds(): Promise<string[]> {
  // This would typically query your user database
  // For example, using Supabase:
  // const { data } = await supabase.from('users').select('id')
  // return data.map(user => user.id)
  
  return [] // Placeholder
}

// Example 8: Integration with React components
/*
// In your React component:
import { NotificationBell } from '@/components/notifications'
import { useNotifications } from '@/hooks/useNotifications'

export function AppHeader() {
  const { unreadCount } = useNotifications()
  
  return (
    <header className="flex items-center justify-between p-4">
      <h1>Science Paper Manager</h1>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <span>Welcome back!</span>
      </div>
    </header>
  )
}
*/

// Example 9: Server-side integration (in your Next.js API routes)
/*
// In your API route:
import { getNotificationService } from '@/services/notifications/NotificationService'

export async function POST(request: NextRequest) {
  // ... your API logic ...
  
  // Send notification after successful operation
  const notificationService = getNotificationService()
  await notificationService.sendNotification(userId, {
    type: 'new_paper_added',
    title: 'New Paper Added',
    message: `Successfully added "${paperTitle}" to your library.`,
    data: { paperId, title: paperTitle },
    priority: 'medium'
  })
  
  return NextResponse.json({ success: true })
}
*/

// Example 10: WebSocket server integration (in your server setup)
/*
// In your server.ts or similar:
import { createServer } from 'http'
import { initializeWebSocketServer } from '@/lib/websocket-server'

const server = createServer(app)
initializeWebSocketServer(server)

server.listen(3000, () => {
  console.log('Server running with WebSocket support')
})
*/