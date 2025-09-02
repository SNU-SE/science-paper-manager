// Server-side exports
export { NotificationService, createNotificationService, getNotificationService } from './NotificationService'

// Client-safe type exports
export type { 
  Notification, 
  NotificationType, 
  NotificationSettings,
  NotificationStats,
  NotificationDeliveryLog 
} from '@/types/notifications'