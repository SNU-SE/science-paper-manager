// Shared notification types (client and server safe)
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  createdAt: string
  readAt?: string
  expiresAt: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export type NotificationType = 
  | 'ai_analysis_complete'
  | 'ai_analysis_failed'
  | 'new_paper_added'
  | 'system_update'
  | 'security_alert'
  | 'backup_complete'

export interface NotificationSettings {
  id: string
  userId: string
  type: NotificationType
  enabled: boolean
  deliveryMethod: 'web' | 'email' | 'push'
  createdAt: string
  updatedAt: string
}

export interface NotificationDeliveryLog {
  id: string
  notificationId: string
  deliveryMethod: string
  status: 'pending' | 'sent' | 'failed' | 'delivered'
  errorMessage?: string
  deliveredAt?: string
  createdAt: string
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<NotificationType, number>
  byPriority: Record<string, number>
}