/**
 * Client-safe notification service factory
 * This file should not directly import any server-only dependencies like ioredis
 */

// Re-export types for backward compatibility
export type {
  Notification,
  NotificationType,
  NotificationSettings,
  NotificationDeliveryLog,
  NotificationStats
} from '@/types/notifications'

// Server-side factory functions (using dynamic imports to prevent bundling)
export async function createNotificationService(supabase: any, redisUrl?: string) {
  if (typeof window !== 'undefined') {
    throw new Error('NotificationService can only be created on the server side')
  }
  
  const serverServices = await import('@/lib/server')
  return serverServices.createNotificationService(supabase, redisUrl)
}

export async function getNotificationService(redisUrl?: string) {
  if (typeof window !== 'undefined') {
    throw new Error('NotificationService can only be used on the server side')  
  }
  
  const serverServices = await import('@/lib/server')
  return serverServices.getNotificationService(redisUrl)
}

// Legacy export for backward compatibility - will throw error if used on client
export const NotificationService = {
  async create(supabase: any, redisUrl?: string) {
    return createNotificationService(supabase, redisUrl)
  }
}