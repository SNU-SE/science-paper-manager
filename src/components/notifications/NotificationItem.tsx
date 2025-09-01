'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Shield,
  Database,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Notification, NotificationType } from '@/services/notifications/NotificationService'

interface NotificationItemProps {
  notification: Notification
  isSelected?: boolean
  onClick: () => void
  onDelete: () => void
}

const notificationIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  ai_analysis_complete: CheckCircle,
  ai_analysis_failed: XCircle,
  new_paper_added: Bell,
  system_update: Info,
  security_alert: Shield,
  backup_complete: Database
}

const notificationColors: Record<NotificationType, string> = {
  ai_analysis_complete: 'text-green-600',
  ai_analysis_failed: 'text-red-600',
  new_paper_added: 'text-blue-600',
  system_update: 'text-purple-600',
  security_alert: 'text-orange-600',
  backup_complete: 'text-gray-600'
}

const priorityColors: Record<string, string> = {
  low: 'border-l-gray-300',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500'
}

export function NotificationItem({ 
  notification, 
  isSelected = false, 
  onClick, 
  onDelete 
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type] || Bell
  const iconColor = notificationColors[notification.type] || 'text-gray-600'
  const priorityColor = priorityColors[notification.priority] || 'border-l-gray-300'
  
  const isUnread = !notification.readAt
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg border-l-4 cursor-pointer transition-all duration-200 hover:bg-muted/50',
        priorityColor,
        isSelected && 'bg-muted',
        isUnread && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                'text-sm font-medium truncate',
                isUnread && 'font-semibold'
              )}>
                {notification.title}
              </h4>
              
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {notification.message}
              </p>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {isUnread && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDeleteClick}
                title="Delete notification"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className="text-xs px-1.5 py-0.5"
              >
                {notification.type.replace(/_/g, ' ')}
              </Badge>
              
              {notification.priority !== 'medium' && (
                <Badge 
                  variant={notification.priority === 'urgent' ? 'destructive' : 'secondary'}
                  className="text-xs px-1.5 py-0.5"
                >
                  {notification.priority}
                </Badge>
              )}
            </div>
            
            <span className="text-xs text-muted-foreground">
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
      
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </div>
  )
}