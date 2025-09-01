import { useState, useEffect, useCallback } from 'react'

interface HealthStatus {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: string
  error?: string
  metadata?: Record<string, any>
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthStatus[]
  timestamp: string
  uptime: number
}

interface ResourceMetrics {
  timestamp: string
  memory: {
    used: number
    total: number
    percentage: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpu: {
    user: number
    system: number
    percentage: number
    loadAverage: number[]
  }
  process: {
    uptime: number
    pid: number
    version: string
    activeHandles: number
    activeRequests: number
  }
  eventLoop: {
    delay: number
    utilization: number
  }
}

interface ResourceAlert {
  id: string
  type: 'memory' | 'cpu' | 'eventloop' | 'process'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: string
}

interface DetailedHealth {
  system: SystemHealth
  resources: {
    current: ResourceMetrics | null
    alerts: ResourceAlert[]
    summary: {
      average: Partial<ResourceMetrics>
      peak: Partial<ResourceMetrics>
      alertCount: number
    }
  }
  recovery: {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    actionStats: Record<string, { attempts: number; successes: number }>
  }
  timestamp: string
}

interface UseHealthMonitoringOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  detailed?: boolean
}

export function useHealthMonitoring(options: UseHealthMonitoringOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    detailed = false
  } = options

  const [healthData, setHealthData] = useState<SystemHealth | DetailedHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealthData = useCallback(async () => {
    try {
      setLoading(true)
      const endpoint = detailed ? '/api/health/detailed' : '/api/health'
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setHealthData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
      console.error('Health data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [detailed])

  useEffect(() => {
    fetchHealthData()
  }, [fetchHealthData])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchHealthData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchHealthData])

  return {
    healthData,
    loading,
    error,
    refetch: fetchHealthData
  }
}

export function useResourceMetrics(options: { limit?: number; timeRange?: number } = {}) {
  const [resourceData, setResourceData] = useState<{
    current: ResourceMetrics | null
    history: ResourceMetrics[]
    alerts: ResourceAlert[]
    summary: any
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResourceData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.timeRange) params.append('timeRange', options.timeRange.toString())
      
      const response = await fetch(`/api/health/resources?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setResourceData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resource data')
      console.error('Resource data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [options.limit, options.timeRange])

  useEffect(() => {
    fetchResourceData()
  }, [fetchResourceData])

  return {
    resourceData,
    loading,
    error,
    refetch: fetchResourceData
  }
}

export function useRecoveryStats(actionId?: string) {
  const [recoveryData, setRecoveryData] = useState<{
    stats: {
      totalAttempts: number
      successfulAttempts: number
      failedAttempts: number
      actionStats: Record<string, { attempts: number; successes: number }>
    }
    history: any
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecoveryData = useCallback(async () => {
    try {
      setLoading(true)
      const params = actionId ? `?actionId=${actionId}` : ''
      const response = await fetch(`/api/health/recovery${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setRecoveryData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recovery data')
      console.error('Recovery data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [actionId])

  useEffect(() => {
    fetchRecoveryData()
  }, [fetchRecoveryData])

  return {
    recoveryData,
    loading,
    error,
    refetch: fetchRecoveryData
  }
}

// Utility hook for checking if system is healthy
export function useSystemHealthStatus() {
  const { healthData, loading, error } = useHealthMonitoring({ detailed: false })
  
  const isHealthy = healthData && 'overall' in healthData ? healthData.overall === 'healthy' : false
  const isDegraded = healthData && 'overall' in healthData ? healthData.overall === 'degraded' : false
  const isUnhealthy = healthData && 'overall' in healthData ? healthData.overall === 'unhealthy' : false
  
  return {
    isHealthy,
    isDegraded,
    isUnhealthy,
    status: healthData && 'overall' in healthData ? healthData.overall : 'unknown',
    loading,
    error
  }
}