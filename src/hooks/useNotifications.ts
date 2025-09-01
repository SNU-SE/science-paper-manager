'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { 
  Notification, 
  NotificationStats,
  NotificationSettings 
} from '@/services/notifications/NotificationService'

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  stats: NotificationStats | null
  settings: NotificationSettings[]
  loading: boolean
  error: string | null
  hasMore: boolean
  
  // Actions
  loadNotifications: (offset?: number) => Promise<void>
  loadMore: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  updateSettings: (type: string, enabled: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [settings, setSettings] = useState<NotificationSettings[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const getAuthToken = useCallback(() => {
    return localStorage.getItem('auth_token')
  }, [])

  const apiCall = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken()
    if (!token) {
      throw new Error('No authentication token')
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return response.json()
  }, [getAuthToken])

  const loadNotifications = useCallback(async (newOffset = 0) => {
    try {
      setLoading(true)
      setError(null)

      const data = await apiCall(`/api/notifications?limit=20&offset=${newOffset}`)
      
      if (newOffset === 0) {
        setNotifications(data.notifications)
      } else {
        setNotifications(prev => [...prev, ...data.notifications])
      }
      
      setHasMore(data.pagination.hasMore)
      setOffset(newOffset + data.notifications.length)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications'
      setError(errorMessage)
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    await loadNotifications(offset)
  }, [hasMore, loading, offset, loadNotifications])

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiCall('/api/notifications/stats')
      setUnreadCount(data.unreadCount)
      setStats(data)
    } catch (err) {
      console.error('Failed to load unread count:', err)
    }
  }, [apiCall])

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiCall('/api/notifications/settings')
      setSettings(data.settings)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }, [apiCall])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiCall(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'mark_read' })
      })

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, readAt: new Date().toISOString() }
          : n
      ))
      
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as read'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  const markAllAsRead = useCallback(async () => {
    try {
      const data = await apiCall('/api/notifications/mark-all-read', {
        method: 'POST'
      })

      // Update local state
      setNotifications(prev => prev.map(n => 
        !n.readAt ? { ...n, readAt: new Date().toISOString() } : n
      ))
      
      setUnreadCount(0)
      
      toast({
        title: 'Success',
        description: `Marked ${data.updatedCount} notifications as read`
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark all as read'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await apiCall(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      })

      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      
      if (deletedNotification && !deletedNotification.readAt) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      toast({
        title: 'Success',
        description: 'Notification deleted'
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete notification'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }, [apiCall, toast, notifications])

  const updateSettings = useCallback(async (type: string, enabled: boolean) => {
    try {
      await apiCall('/api/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({ type, enabled, deliveryMethod: 'web' })
      })

      // Update local state
      setSettings(prev => prev.map(s => 
        s.type === type && s.deliveryMethod === 'web'
          ? { ...s, enabled }
          : s
      ))
      
      toast({
        title: 'Settings Updated',
        description: `${type.replace(/_/g, ' ')} notifications ${enabled ? 'enabled' : 'disabled'}`
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }, [apiCall, toast])

  const refresh = useCallback(async () => {
    await Promise.all([
      loadNotifications(0),
      loadUnreadCount(),
      loadSettings()
    ])
  }, [loadNotifications, loadUnreadCount, loadSettings])

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    const token = getAuthToken()
    if (!token) return

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications?token=${token}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          switch (message.type) {
            case 'notification':
              // Add new notification to the list
              setNotifications(prev => [message.data, ...prev])
              setUnreadCount(prev => prev + 1)
              
              // Show toast for high priority notifications
              if (message.data.priority === 'high' || message.data.priority === 'urgent') {
                toast({
                  title: message.data.title,
                  description: message.data.message,
                  variant: message.data.priority === 'urgent' ? 'destructive' : 'default'
                })
              }
              break

            case 'read':
              // Update read status
              setNotifications(prev => prev.map(n => 
                n.id === message.data.notificationId 
                  ? { ...n, readAt: message.data.readAt }
                  : n
              ))
              setUnreadCount(prev => Math.max(0, prev - 1))
              break

            case 'read_all':
              // Mark all as read
              setNotifications(prev => prev.map(n => 
                !n.readAt ? { ...n, readAt: message.data.readAt } : n
              ))
              setUnreadCount(0)
              break

            case 'deleted':
              // Remove deleted notification
              setNotifications(prev => prev.filter(n => n.id !== message.data.notificationId))
              break

            case 'heartbeat':
              // Handle heartbeat
              if (message.data.ping) {
                ws.send(JSON.stringify({ type: 'heartbeat', data: { pong: true } }))
              }
              break
          }
        } catch (err) {
          console.error('Failed to handle WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        wsRef.current = null
        
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (err) {
      console.error('Failed to connect WebSocket:', err)
    }
  }, [getAuthToken, toast])

  // Initialize
  useEffect(() => {
    refresh()
    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [refresh, connectWebSocket])

  return {
    notifications,
    unreadCount,
    stats,
    settings,
    loading,
    error,
    hasMore,
    loadNotifications,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateSettings,
    refresh
  }
}