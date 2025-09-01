import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'

export interface UsageStatistics {
  totalRequests: number
  totalCostUnits: number
  aiAnalysisRequests: number
  searchRequests: number
  uploadRequests: number
  averageRequestsPerDay: number
  topEndpoints: Array<{
    endpoint: string
    count: number
    percentage: number
  }>
}

export interface RateLimit {
  id: string
  userId: string
  limitType: 'daily' | 'hourly' | 'monthly'
  endpointPattern?: string
  maxRequests: number
  maxCostUnits: number
  currentRequests: number
  currentCostUnits: number
  windowStart: Date
  isActive: boolean
}

export interface SuspiciousActivity {
  id: string
  userId: string
  activityType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metadata: Record<string, any>
  isResolved: boolean
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
}

export interface RateLimitInfo {
  allowed: boolean
  limitType?: string
  maxRequests?: number
  currentRequests?: number
  maxCostUnits?: number
  currentCostUnits?: number
  windowStart?: Date
  endpointPattern?: string
  resetTime?: Date
}

export function useAPIUsage() {
  const { user, getAccessToken } = useAuth()
  const [statistics, setStatistics] = useState<UsageStatistics | null>(null)
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([])
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Get usage statistics for the current user
   */
  const getUsageStatistics = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    includeRateLimits: boolean = true
  ) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate.toISOString())
      if (endDate) params.append('endDate', endDate.toISOString())
      if (includeRateLimits) params.append('includeRateLimits', 'true')

      const response = await fetch(`/api/usage?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get usage statistics')
      }

      const data = await response.json()
      setStatistics(data.statistics)
      if (data.rateLimits) {
        setRateLimits(data.rateLimits.map((limit: any) => ({
          ...limit,
          windowStart: new Date(limit.windowStart)
        })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  /**
   * Get rate limits for the current user
   */
  const getRateLimits = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/limits', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get rate limits')
      }

      const data = await response.json()
      setRateLimits(data.rateLimits.map((limit: any) => ({
        ...limit,
        windowStart: new Date(limit.windowStart)
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  /**
   * Check rate limit for a specific endpoint
   */
  const checkRateLimit = useCallback(async (
    endpoint: string,
    costUnits: number = 1
  ): Promise<RateLimitInfo | null> => {
    if (!user) return null

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/limits/check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint, costUnits })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to check rate limit')
      }

      const data = await response.json()
      return {
        ...data.limitInfo,
        windowStart: data.limitInfo.windowStart ? new Date(data.limitInfo.windowStart) : undefined,
        resetTime: data.limitInfo.resetTime ? new Date(data.limitInfo.resetTime) : undefined
      }
    } catch (err) {
      console.error('Error checking rate limit:', err)
      return null
    }
  }, [user, getAccessToken])

  /**
   * Get suspicious activity for the current user
   */
  const getSuspiciousActivity = useCallback(async (includeResolved: boolean = false) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const params = new URLSearchParams()
      if (includeResolved) params.append('includeResolved', 'true')

      const response = await fetch(`/api/usage/suspicious?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get suspicious activity')
      }

      const data = await response.json()
      setSuspiciousActivity(data.activities.map((activity: any) => ({
        ...activity,
        createdAt: new Date(activity.createdAt),
        resolvedAt: activity.resolvedAt ? new Date(activity.resolvedAt) : undefined
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  /**
   * Manually track API usage (for testing)
   */
  const trackUsage = useCallback(async (
    endpoint: string,
    method: string,
    provider?: string,
    costUnits?: number,
    requestSize?: number,
    responseSize?: number
  ) => {
    if (!user) return

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/track', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint,
          method,
          provider,
          costUnits,
          requestSize,
          responseSize
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to track usage')
      }

      // Refresh statistics after tracking
      await getUsageStatistics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [user, getAccessToken, getUsageStatistics])

  /**
   * Get remaining requests for a specific limit type
   */
  const getRemainingRequests = useCallback((limitType: 'daily' | 'hourly' | 'monthly') => {
    const limit = rateLimits.find(l => l.limitType === limitType && !l.endpointPattern)
    if (!limit) return null

    return {
      remaining: Math.max(0, limit.maxRequests - limit.currentRequests),
      total: limit.maxRequests,
      percentage: limit.maxRequests > 0 ? (limit.currentRequests / limit.maxRequests) * 100 : 0,
      resetTime: new Date(limit.windowStart.getTime() + (
        limitType === 'hourly' ? 60 * 60 * 1000 :
        limitType === 'daily' ? 24 * 60 * 60 * 1000 :
        30 * 24 * 60 * 60 * 1000 // monthly
      ))
    }
  }, [rateLimits])

  /**
   * Get remaining cost units for a specific limit type
   */
  const getRemainingCostUnits = useCallback((limitType: 'daily' | 'hourly' | 'monthly') => {
    const limit = rateLimits.find(l => l.limitType === limitType && !l.endpointPattern)
    if (!limit) return null

    return {
      remaining: Math.max(0, limit.maxCostUnits - limit.currentCostUnits),
      total: limit.maxCostUnits,
      percentage: limit.maxCostUnits > 0 ? (limit.currentCostUnits / limit.maxCostUnits) * 100 : 0,
      resetTime: new Date(limit.windowStart.getTime() + (
        limitType === 'hourly' ? 60 * 60 * 1000 :
        limitType === 'daily' ? 24 * 60 * 60 * 1000 :
        30 * 24 * 60 * 60 * 1000 // monthly
      ))
    }
  }, [rateLimits])

  // Load initial data when user changes
  useEffect(() => {
    if (user) {
      getUsageStatistics()
      getSuspiciousActivity()
    }
  }, [user, getUsageStatistics, getSuspiciousActivity])

  return {
    statistics,
    rateLimits,
    suspiciousActivity,
    loading,
    error,
    getUsageStatistics,
    getRateLimits,
    checkRateLimit,
    getSuspiciousActivity,
    trackUsage,
    getRemainingRequests,
    getRemainingCostUnits,
    refresh: () => {
      getUsageStatistics()
      getSuspiciousActivity()
    }
  }
}

export default useAPIUsage