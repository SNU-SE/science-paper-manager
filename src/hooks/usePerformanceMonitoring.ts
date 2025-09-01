import { useState, useEffect, useCallback } from 'react'

interface PerformanceMetrics {
  apiMetrics: {
    averageResponseTime: number
    requestsPerMinute: number
    errorRate: number
    slowestEndpoints: Array<{
      endpoint: string
      averageResponseTime: number
      requestCount: number
      errorRate: number
    }>
  }
  databaseMetrics: {
    averageQueryTime: number
    slowestQueries: Array<{
      queryHash: string
      queryType: string
      averageExecutionTime: number
      executionCount: number
      tableName?: string
    }>
    connectionPoolStatus: {
      totalConnections: number
      activeConnections: number
      idleConnections: number
      waitingConnections: number
    }
  }
  userMetrics: {
    activeUsers: number
    mostUsedFeatures: Array<{
      feature: string
      usageCount: number
      uniqueUsers: number
    }>
    userSessions: Array<{
      sessionId: string
      userId: string
      duration: number
      activityCount: number
    }>
  }
  systemMetrics: {
    memoryUsage: number
    cpuUsage: number
    diskUsage: number
    uptime: number
  }
}

interface Alert {
  type: string
  message: string
  value: number
  threshold: number
}

interface DashboardData {
  recent: PerformanceMetrics
  daily: PerformanceMetrics
  slowQueries: Array<{
    queryHash: string
    queryType: string
    averageExecutionTime: number
    executionCount: number
    tableName?: string
  }>
  errorRates: Array<{
    endpoint: string
    errorCount: number
    errors: Record<string, number>
  }>
  activeUsers: number
  alerts: Alert[]
  timestamp: string
}

export function usePerformanceMonitoring(autoRefresh = true, refreshInterval = 30000) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (timeRange = '1h') => {
    try {
      setLoading(true)
      const response = await fetch(`/api/monitoring?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics')
      }

      const metricsData = await response.json()
      setData(metricsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const trackUserActivity = useCallback(async (
    action: string,
    feature: string,
    metadata?: Record<string, any>
  ) => {
    try {
      await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            action,
            feature,
            metadata,
            sessionId: getSessionId()
          }
        })
      })
    } catch (error) {
      console.error('Failed to track user activity:', error)
    }
  }, [])

  const trackCustomEvent = useCallback(async (
    eventName: string,
    eventData?: Record<string, any>
  ) => {
    try {
      await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          type: 'custom_event',
          data: {
            eventName,
            eventData
          }
        })
      })
    } catch (error) {
      console.error('Failed to track custom event:', error)
    }
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchDashboardData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchDashboardData])

  return {
    data,
    loading,
    error,
    fetchMetrics,
    fetchDashboardData,
    trackUserActivity,
    trackCustomEvent,
    refresh: fetchDashboardData
  }
}

export function usePerformanceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }

      const alertsData = await response.json()
      setAlerts(alertsData.currentAlerts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          action: 'acknowledge',
          alertId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert')
      }

      // Remove acknowledged alert from local state
      setAlerts(prev => prev.filter(alert => alert.type !== alertId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({
          action: 'dismiss',
          alertId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss alert')
      }

      // Remove dismissed alert from local state
      setAlerts(prev => prev.filter(alert => alert.type !== alertId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return {
    alerts,
    loading,
    error,
    fetchAlerts,
    acknowledgeAlert,
    dismissAlert
  }
}

// Client-side performance tracking
export function useClientPerformanceTracking() {
  const trackPageLoad = useCallback((pageName: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart
        const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
        const firstPaint = performance.getEntriesByName('first-paint')[0]?.startTime || 0
        const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0

        // Send metrics to server
        fetch('/api/monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
          },
          body: JSON.stringify({
            type: 'user_activity',
            data: {
              action: 'page_load',
              feature: 'navigation',
              metadata: {
                pageName,
                loadTime,
                domContentLoaded,
                firstPaint,
                firstContentfulPaint
              }
            }
          })
        }).catch(error => {
          console.error('Failed to track page load:', error)
        })
      }
    }
  }, [])

  const trackUserInteraction = useCallback((element: string, action: string) => {
    fetch('/api/monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
      },
      body: JSON.stringify({
        type: 'user_activity',
        data: {
          action,
          feature: 'ui_interaction',
          metadata: {
            element,
            timestamp: Date.now()
          }
        }
      })
    }).catch(error => {
      console.error('Failed to track user interaction:', error)
    })
  }, [])

  return {
    trackPageLoad,
    trackUserInteraction
  }
}

// Helper functions
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('performance_session_id')
  if (!sessionId) {
    sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem('performance_session_id', sessionId)
  }
  return sessionId
}