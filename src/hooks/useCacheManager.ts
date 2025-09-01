'use client'

import { useState, useEffect, useCallback } from 'react'

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  localHits: number
  redisHits: number
  totalKeys: number
  memoryUsage: number
}

interface CacheMetrics {
  hitRate: number
  missRate: number
  localHitRate: number
  redisHitRate: number
  averageResponseTime: number
  memoryEfficiency: number
  keyDistribution: Record<string, number>
  hotKeys: Array<{ key: string; accessCount: number }>
  recommendations: string[]
}

interface CacheAlert {
  type: 'performance' | 'memory' | 'error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
}

interface CacheOverview {
  stats: CacheStats
  metrics: CacheMetrics
  health: {
    status: 'healthy' | 'unhealthy'
    metrics: any
    recommendations: string[]
  }
  score: number
}

interface UseCacheManagerReturn {
  overview: CacheOverview | null
  alerts: CacheAlert[]
  loading: boolean
  error: string | null
  refreshData: () => Promise<void>
  clearCache: () => Promise<boolean>
  optimizeCache: () => Promise<boolean>
  invalidatePattern: (pattern: string) => Promise<boolean>
  invalidateTags: (tags: string[]) => Promise<boolean>
  getCacheValue: (key: string) => Promise<any>
  setCacheValue: (key: string, value: any, options?: any) => Promise<boolean>
  deleteCacheKey: (key: string) => Promise<boolean>
}

export function useCacheManager(): UseCacheManagerReturn {
  const [overview, setOverview] = useState<CacheOverview | null>(null)
  const [alerts, setAlerts] = useState<CacheAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    try {
      setError(null)
      
      const [overviewResponse, alertsResponse] = await Promise.all([
        fetch('/api/cache'),
        fetch('/api/cache?action=alerts&limit=50')
      ])

      if (!overviewResponse.ok) {
        throw new Error(`Failed to fetch cache overview: ${overviewResponse.statusText}`)
      }

      if (!alertsResponse.ok) {
        throw new Error(`Failed to fetch cache alerts: ${alertsResponse.statusText}`)
      }

      const overviewData = await overviewResponse.json()
      const alertsData = await alertsResponse.json()

      if (!overviewData.success) {
        throw new Error(overviewData.error || 'Failed to fetch cache overview')
      }

      if (!alertsData.success) {
        throw new Error(alertsData.error || 'Failed to fetch cache alerts')
      }

      setOverview(overviewData.data)
      setAlerts(alertsData.data.map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp)
      })))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to refresh cache data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to clear cache')
      }

      await refreshData()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache'
      setError(errorMessage)
      console.error('Cache clear error:', err)
      return false
    }
  }, [refreshData])

  const optimizeCache = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'optimize' })
      })

      if (!response.ok) {
        throw new Error(`Failed to optimize cache: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to optimize cache')
      }

      await refreshData()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to optimize cache'
      setError(errorMessage)
      console.error('Cache optimization error:', err)
      return false
    }
  }, [refreshData])

  const invalidatePattern = useCallback(async (pattern: string): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'invalidate-pattern',
          pattern 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to invalidate pattern: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to invalidate pattern')
      }

      await refreshData()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invalidate pattern'
      setError(errorMessage)
      console.error('Pattern invalidation error:', err)
      return false
    }
  }, [refreshData])

  const invalidateTags = useCallback(async (tags: string[]): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'invalidate-tags',
          tags 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to invalidate tags: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to invalidate tags')
      }

      await refreshData()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invalidate tags'
      setError(errorMessage)
      console.error('Tag invalidation error:', err)
      return false
    }
  }, [refreshData])

  const getCacheValue = useCallback(async (key: string): Promise<any> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'get',
          key 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get cache value: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get cache value')
      }

      return data.data.value
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get cache value'
      setError(errorMessage)
      console.error('Cache get error:', err)
      return null
    }
  }, [])

  const setCacheValue = useCallback(async (
    key: string, 
    value: any, 
    options?: any
  ): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'set',
          key,
          value,
          options 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to set cache value: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to set cache value')
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set cache value'
      setError(errorMessage)
      console.error('Cache set error:', err)
      return false
    }
  }, [])

  const deleteCacheKey = useCallback(async (key: string): Promise<boolean> => {
    try {
      setError(null)
      
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'delete',
          key 
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to delete cache key: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete cache key')
      }

      await refreshData()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete cache key'
      setError(errorMessage)
      console.error('Cache delete error:', err)
      return false
    }
  }, [refreshData])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  return {
    overview,
    alerts,
    loading,
    error,
    refreshData,
    clearCache,
    optimizeCache,
    invalidatePattern,
    invalidateTags,
    getCacheValue,
    setCacheValue,
    deleteCacheKey
  }
}

export default useCacheManager