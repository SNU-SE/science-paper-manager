/**
 * Server-only services factory
 * WARNING: This file should NEVER be imported on the client-side
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NotificationService } from './services/NotificationService'
import { WebSocketNotificationServer } from './services/WebSocketNotificationServer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createNotificationService(supabase: SupabaseClient<Database>, redisUrl?: string) {
  return new NotificationService(supabase, redisUrl)
}

export async function getNotificationService(redisUrl?: string) {
  if (typeof window !== 'undefined') {
    throw new Error('getNotificationService can only be called on the server side')
  }
  
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return null
  }
  return new NotificationService(supabase, redisUrl)
}

export function createWebSocketNotificationServer(httpServer: any, notificationService: NotificationService) {
  return new WebSocketNotificationServer(httpServer, notificationService)
}

export { NotificationService, WebSocketNotificationServer }

// Re-export types only
export type { 
  Notification, 
  NotificationType, 
  NotificationSettings,
  NotificationStats,
  NotificationDeliveryLog 
} from '@/types/notifications'