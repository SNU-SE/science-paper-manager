import Redis from 'ioredis'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { 
  Notification, 
  NotificationType, 
  NotificationSettings, 
  NotificationDeliveryLog, 
  NotificationStats 
} from '@/types/notifications'

// Re-export types for backward compatibility
export type {
  Notification,
  NotificationType,
  NotificationSettings,
  NotificationDeliveryLog,
  NotificationStats
} from '@/types/notifications'

/**
 * Enhanced service for managing user notifications with database persistence and real-time delivery
 */
export class NotificationService {
  private redis: Redis
  private supabase: SupabaseClient<Database>

  constructor(supabase: SupabaseClient<Database>, redisUrl?: string) {
    this.supabase = supabase
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    })
  }

  /**
   * Send a notification to a user with database persistence and real-time delivery
   */
  async sendNotification(
    userId: string, 
    notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'readAt' | 'expiresAt'>
  ): Promise<string> {
    try {
      // Check if user has this notification type enabled
      const settings = await this.getUserNotificationSettings(userId)
      const typeSettings = settings.find(s => s.type === notification.type && s.deliveryMethod === 'web')
      
      if (!typeSettings?.enabled) {
        console.log(`Notification type ${notification.type} disabled for user ${userId}`)
        return ''
      }

      // Create notification in database
      const { data: dbNotification, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data || {},
          priority: notification.priority || 'medium'
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      const fullNotification: Notification = {
        id: dbNotification.id,
        userId: dbNotification.user_id,
        type: dbNotification.type,
        title: dbNotification.title,
        message: dbNotification.message,
        data: dbNotification.data,
        priority: dbNotification.priority,
        createdAt: dbNotification.created_at,
        readAt: dbNotification.read_at,
        expiresAt: dbNotification.expires_at
      }

      // Cache notification in Redis for quick access
      await this.redis.setex(
        `notification:${dbNotification.id}`, 
        86400 * 7, 
        JSON.stringify(fullNotification)
      )

      // Add to user's notification list in Redis
      const userNotificationsKey = `user:${userId}:notifications`
      await this.redis.lpush(userNotificationsKey, dbNotification.id)
      await this.redis.expire(userNotificationsKey, 86400 * 7)

      // Publish to real-time notification channel
      await this.redis.publish(`notifications:${userId}`, JSON.stringify(fullNotification))

      // Log delivery attempt
      await this.logNotificationDelivery(dbNotification.id, 'web', 'sent')

      console.log(`Notification sent to user ${userId}: ${notification.title}`)
      return dbNotification.id
    } catch (error) {
      console.error('Failed to send notification:', error)
      throw error
    }
  }

  /**
   * Get user's notifications from database with Redis caching
   */
  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    try {
      // Try Redis cache first
      const cacheKey = `user:${userId}:notifications:${limit}:${offset}`
      const cachedData = await this.redis.get(cacheKey)
      
      if (cachedData) {
        return JSON.parse(cachedData)
      }

      // Fetch from database
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      const formattedNotifications: Notification[] = notifications.map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        priority: n.priority,
        createdAt: n.created_at,
        readAt: n.read_at,
        expiresAt: n.expires_at
      }))

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(formattedNotifications))

      return formattedNotifications
    } catch (error) {
      console.error('Failed to get user notifications:', error)
      throw error
    }
  }

  /**
   * Mark notification as read in database and cache
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Use database function for atomic operation
      const { data, error } = await this.supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId,
          p_user_id: userId
        })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      if (data) {
        // Update Redis cache
        const cachedNotification = await this.redis.get(`notification:${notificationId}`)
        if (cachedNotification) {
          const notification: Notification = JSON.parse(cachedNotification)
          notification.readAt = new Date().toISOString()
          
          const ttl = await this.redis.ttl(`notification:${notificationId}`)
          if (ttl > 0) {
            await this.redis.setex(`notification:${notificationId}`, ttl, JSON.stringify(notification))
          }
        }

        // Invalidate user notifications cache
        await this.invalidateUserNotificationsCache(userId)
        
        // Publish read status update
        await this.redis.publish(`notifications:${userId}:read`, JSON.stringify({
          notificationId,
          readAt: new Date().toISOString()
        }))
      }

      return data || false
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      throw error
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      // Use database function for atomic operation
      const { data: updatedCount, error } = await this.supabase
        .rpc('mark_all_notifications_read', {
          p_user_id: userId
        })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      // Invalidate all user notification caches
      await this.invalidateUserNotificationsCache(userId)

      // Publish bulk read status update
      await this.redis.publish(`notifications:${userId}:read_all`, JSON.stringify({
        updatedCount,
        readAt: new Date().toISOString()
      }))

      return updatedCount || 0
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
      throw error
    }
  }

  /**
   * Delete a notification from database and cache
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Delete from database (RLS will ensure user can only delete their own)
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      // Remove from Redis cache
      await this.redis.del(`notification:${notificationId}`)

      // Remove from user's notification list
      const userNotificationsKey = `user:${userId}:notifications`
      await this.redis.lrem(userNotificationsKey, 1, notificationId)

      // Invalidate user notifications cache
      await this.invalidateUserNotificationsCache(userId)

      // Publish deletion event
      await this.redis.publish(`notifications:${userId}:deleted`, JSON.stringify({
        notificationId,
        deletedAt: new Date().toISOString()
      }))

      return true
    } catch (error) {
      console.error('Failed to delete notification:', error)
      throw error
    }
  }

  /**
   * Get unread notification count for user using database function
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // Try Redis cache first
      const cacheKey = `user:${userId}:unread_count`
      const cachedCount = await this.redis.get(cacheKey)
      
      if (cachedCount !== null) {
        return parseInt(cachedCount, 10)
      }

      // Use database function for accurate count
      const { data: count, error } = await this.supabase
        .rpc('get_unread_notification_count', {
          p_user_id: userId
        })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, count.toString())

      return count || 0
    } catch (error) {
      console.error('Failed to get unread count:', error)
      return 0
    }
  }

  /**
   * Subscribe to real-time notifications for a user
   */
  subscribeToUserNotifications(userId: string, callback: (notification: Notification) => void): () => void {
    const subscriber = new Redis(this.redis.options)
    const channel = `notifications:${userId}`

    subscriber.subscribe(channel)
    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const notification: Notification = JSON.parse(message)
          callback(notification)
        } catch (error) {
          console.error('Failed to parse notification message:', error)
        }
      }
    })

    // Return unsubscribe function
    return () => {
      subscriber.unsubscribe(channel)
      subscriber.quit()
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<void> {
    try {
      // This would typically be run as a scheduled job
      console.log('Cleaning up expired notifications...')
      
      // Redis TTL handles most cleanup automatically
      // Additional cleanup logic could be added here if needed
    } catch (error) {
      console.error('Failed to cleanup expired notifications:', error)
    }
  }

  /**
   * Get comprehensive notification statistics
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const cacheKey = `user:${userId}:stats`
      const cachedStats = await this.redis.get(cacheKey)
      
      if (cachedStats) {
        return JSON.parse(cachedStats)
      }

      // Get notifications from database for accurate stats
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('type, priority, read_at')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      const stats: NotificationStats = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read_at).length,
        byType: {} as Record<NotificationType, number>,
        byPriority: {}
      }

      // Count by type and priority
      for (const notification of notifications) {
        stats.byType[notification.type as NotificationType] = 
          (stats.byType[notification.type as NotificationType] || 0) + 1
        
        stats.byPriority[notification.priority] = 
          (stats.byPriority[notification.priority] || 0) + 1
      }

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(stats))

      return stats
    } catch (error) {
      console.error('Failed to get notification stats:', error)
      return { 
        total: 0, 
        unread: 0, 
        byType: {} as Record<NotificationType, number>,
        byPriority: {}
      }
    }
  }

  /**
   * Get user's notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<NotificationSettings[]> {
    try {
      const cacheKey = `user:${userId}:settings`
      const cachedSettings = await this.redis.get(cacheKey)
      
      if (cachedSettings) {
        return JSON.parse(cachedSettings)
      }

      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      const formattedSettings: NotificationSettings[] = settings.map(s => ({
        id: s.id,
        userId: s.user_id,
        type: s.type,
        enabled: s.enabled,
        deliveryMethod: s.delivery_method,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }))

      // Cache for 10 minutes
      await this.redis.setex(cacheKey, 600, JSON.stringify(formattedSettings))

      return formattedSettings
    } catch (error) {
      console.error('Failed to get notification settings:', error)
      return []
    }
  }

  /**
   * Update user's notification settings
   */
  async updateNotificationSettings(
    userId: string, 
    type: NotificationType, 
    enabled: boolean, 
    deliveryMethod: 'web' | 'email' | 'push' = 'web'
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          type,
          enabled,
          delivery_method: deliveryMethod,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,type,delivery_method'
        })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      // Invalidate settings cache
      await this.redis.del(`user:${userId}:settings`)

      // Publish settings update
      await this.redis.publish(`notifications:${userId}:settings_updated`, JSON.stringify({
        type,
        enabled,
        deliveryMethod,
        updatedAt: new Date().toISOString()
      }))

      return true
    } catch (error) {
      console.error('Failed to update notification settings:', error)
      throw error
    }
  }

  /**
   * Log notification delivery attempt
   */
  private async logNotificationDelivery(
    notificationId: string, 
    deliveryMethod: string, 
    status: 'pending' | 'sent' | 'failed' | 'delivered',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('notification_delivery_log')
        .insert({
          notification_id: notificationId,
          delivery_method: deliveryMethod,
          status,
          error_message: errorMessage,
          delivered_at: status === 'delivered' ? new Date().toISOString() : null
        })
    } catch (error) {
      console.error('Failed to log notification delivery:', error)
      // Don't throw - logging failure shouldn't break notification sending
    }
  }

  /**
   * Invalidate user notifications cache
   */
  private async invalidateUserNotificationsCache(userId: string): Promise<void> {
    try {
      const pattern = `user:${userId}:notifications:*`
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }

      // Also invalidate related caches
      await this.redis.del(`user:${userId}:unread_count`)
      await this.redis.del(`user:${userId}:stats`)
    } catch (error) {
      console.error('Failed to invalidate cache:', error)
    }
  }

  /**
   * Clean up expired notifications (run as scheduled job)
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const { data: deletedCount, error } = await this.supabase
        .rpc('cleanup_expired_notifications')

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      console.log(`Cleaned up ${deletedCount} expired notifications`)
      return deletedCount || 0
    } catch (error) {
      console.error('Failed to cleanup expired notifications:', error)
      return 0
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

export function createNotificationService(supabase: SupabaseClient<Database>, redisUrl?: string): NotificationService {
  return new NotificationService(supabase, redisUrl)
}

export function getNotificationService(redisUrl?: string): NotificationService | null {
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return null
  }
  return new NotificationService(supabase, redisUrl)
}