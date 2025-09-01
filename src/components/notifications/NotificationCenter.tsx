'use client'

import React, { useState, useEffect } from 'react'
import { Bell, Settings, X, Check, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationItem } from './NotificationItem'
import { NotificationSettings } from './NotificationSettings'
import { Notification } from '@/services/notifications/NotificationService'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore
  } = useNotifications()

  if (!isOpen) return null

  const handleNotificationClick = async (notification: Notification) => {
    setSelectedNotification(notification)
    
    if (!notification.readAt) {
      await markAsRead(notification.id)
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId)
    if (selectedNotification?.id === notificationId) {
      setSelectedNotification(null)
    }
  }

  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notification Settings</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <NotificationSettings onClose={() => setShowSettings(false)} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex">
        {/* Notification List */}
        <div className="w-1/2 border-r">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <ScrollArea className="h-[calc(80vh-120px)]">
            <div className="p-4 space-y-2">
              {loading && notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isSelected={selectedNotification?.id === notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      onDelete={() => handleDeleteNotification(notification.id)}
                    />
                  ))}
                  
                  {hasMore && (
                    <div className="text-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMore}
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Notification Detail */}
        <div className="w-1/2">
          {selectedNotification ? (
            <div className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedNotification.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!selectedNotification.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(selectedNotification.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteNotification(selectedNotification.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <Separator />
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {new Date(selectedNotification.createdAt).toLocaleString()}
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    {selectedNotification.message}
                  </div>
                  
                  {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Additional Information</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(selectedNotification.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select a notification to view details
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}