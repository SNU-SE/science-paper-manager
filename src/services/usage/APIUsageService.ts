import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export interface APIUsageRecord {
  id?: string
  userId: string
  endpoint: string
  method: string
  provider?: string
  costUnits?: number
  requestSize?: number
  responseSize?: number
  ipAddress?: string
  userAgent?: string
  createdAt?: Date
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

export interface UserRateLimit {
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

export class APIUsageService {
  private supabase: ReturnType<typeof createClient<Database>>

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Track API usage for a user
   */
  async trackUsage(usage: APIUsageRecord): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_usage_tracking')
        .insert({
          user_id: usage.userId,
          endpoint: usage.endpoint,
          method: usage.method,
          provider: usage.provider,
          cost_units: usage.costUnits || 1,
          request_size: usage.requestSize,
          response_size: usage.responseSize,
          ip_address: usage.ipAddress,
          user_agent: usage.userAgent
        })

      if (error) {
        console.error('Failed to track API usage:', error)
        throw error
      }

      // Check for suspicious activity patterns
      await this.checkSuspiciousActivity(usage.userId)
    } catch (error) {
      console.error('Error tracking API usage:', error)
      // Don't throw error to avoid breaking the main request
    }
  }

  /**
   * Check rate limits for a user and endpoint
   */
  async checkRateLimit(
    userId: string, 
    endpoint: string, 
    costUnits: number = 1
  ): Promise<RateLimitInfo> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_rate_limit', {
          p_user_id: userId,
          p_endpoint: endpoint,
          p_cost_units: costUnits
        })

      if (error) {
        console.error('Failed to check rate limit:', error)
        // Default to allowing the request if check fails
        return { allowed: true }
      }

      const result = data as any
      
      if (!result.allowed) {
        // Log rate limit exceeded
        await this.logSuspiciousActivity(
          userId,
          'rate_limit_exceeded',
          'medium',
          `Rate limit exceeded for endpoint ${endpoint}`,
          {
            endpoint,
            limitType: result.limit_type,
            maxRequests: result.max_requests,
            currentRequests: result.current_requests,
            maxCostUnits: result.max_cost_units,
            currentCostUnits: result.current_cost_units
          }
        )
      }

      return {
        allowed: result.allowed,
        limitType: result.limit_type,
        maxRequests: result.max_requests,
        currentRequests: result.current_requests,
        maxCostUnits: result.max_cost_units,
        currentCostUnits: result.current_cost_units,
        windowStart: result.window_start ? new Date(result.window_start) : undefined,
        endpointPattern: result.endpoint_pattern,
        resetTime: this.calculateResetTime(result.limit_type, result.window_start)
      }
    } catch (error) {
      console.error('Error checking rate limit:', error)
      // Default to allowing the request if check fails
      return { allowed: true }
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStatistics(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<UsageStatistics> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const end = endDate || new Date()

    try {
      // Get daily summary data
      const { data: summaryData, error: summaryError } = await this.supabase
        .from('daily_usage_summary')
        .select('*')
        .eq('user_id', userId)
        .gte('date', start.toISOString().split('T')[0])
        .lte('date', end.toISOString().split('T')[0])

      if (summaryError) throw summaryError

      // Get detailed endpoint statistics
      const { data: endpointData, error: endpointError } = await this.supabase
        .from('api_usage_tracking')
        .select('endpoint')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (endpointError) throw endpointError

      // Calculate statistics
      const totalRequests = summaryData?.reduce((sum, day) => sum + day.total_requests, 0) || 0
      const totalCostUnits = summaryData?.reduce((sum, day) => sum + day.total_cost_units, 0) || 0
      const aiAnalysisRequests = summaryData?.reduce((sum, day) => sum + day.ai_analysis_requests, 0) || 0
      const searchRequests = summaryData?.reduce((sum, day) => sum + day.search_requests, 0) || 0
      const uploadRequests = summaryData?.reduce((sum, day) => sum + day.upload_requests, 0) || 0

      const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
      const averageRequestsPerDay = totalRequests / dayCount

      // Calculate top endpoints
      const endpointCounts = endpointData?.reduce((acc, record) => {
        acc[record.endpoint] = (acc[record.endpoint] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      const topEndpoints = Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({
          endpoint,
          count,
          percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0
        }))

      return {
        totalRequests,
        totalCostUnits,
        aiAnalysisRequests,
        searchRequests,
        uploadRequests,
        averageRequestsPerDay,
        topEndpoints
      }
    } catch (error) {
      console.error('Error getting usage statistics:', error)
      throw error
    }
  }

  /**
   * Get user rate limits
   */
  async getUserRateLimits(userId: string): Promise<UserRateLimit[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('limit_type')

      if (error) throw error

      return data?.map(limit => ({
        id: limit.id,
        userId: limit.user_id,
        limitType: limit.limit_type as 'daily' | 'hourly' | 'monthly',
        endpointPattern: limit.endpoint_pattern,
        maxRequests: limit.max_requests,
        maxCostUnits: limit.max_cost_units,
        currentRequests: limit.current_requests,
        currentCostUnits: limit.current_cost_units,
        windowStart: new Date(limit.window_start),
        isActive: limit.is_active
      })) || []
    } catch (error) {
      console.error('Error getting user rate limits:', error)
      throw error
    }
  }

  /**
   * Update user rate limits (admin only)
   */
  async updateUserRateLimit(
    userId: string,
    limitType: 'daily' | 'hourly' | 'monthly',
    endpointPattern: string | null,
    maxRequests: number,
    maxCostUnits: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_rate_limits')
        .upsert({
          user_id: userId,
          limit_type: limitType,
          endpoint_pattern: endpointPattern,
          max_requests: maxRequests,
          max_cost_units: maxCostUnits,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,limit_type,endpoint_pattern'
        })

      if (error) throw error
    } catch (error) {
      console.error('Error updating user rate limit:', error)
      throw error
    }
  }

  /**
   * Get suspicious activity for a user or all users (admin)
   */
  async getSuspiciousActivity(
    userId?: string,
    includeResolved: boolean = false
  ): Promise<SuspiciousActivity[]> {
    try {
      let query = this.supabase
        .from('suspicious_activity_log')
        .select('*')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (!includeResolved) {
        query = query.eq('is_resolved', false)
      }

      const { data, error } = await query

      if (error) throw error

      return data?.map(activity => ({
        id: activity.id,
        userId: activity.user_id,
        activityType: activity.activity_type,
        severity: activity.severity as 'low' | 'medium' | 'high' | 'critical',
        description: activity.description,
        metadata: activity.metadata || {},
        isResolved: activity.is_resolved,
        createdAt: new Date(activity.created_at),
        resolvedAt: activity.resolved_at ? new Date(activity.resolved_at) : undefined,
        resolvedBy: activity.resolved_by
      })) || []
    } catch (error) {
      console.error('Error getting suspicious activity:', error)
      throw error
    }
  }

  /**
   * Resolve suspicious activity (admin only)
   */
  async resolveSuspiciousActivity(activityId: string, resolvedBy: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('suspicious_activity_log')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', activityId)

      if (error) throw error
    } catch (error) {
      console.error('Error resolving suspicious activity:', error)
      throw error
    }
  }

  /**
   * Get system-wide usage statistics (admin only)
   */
  async getSystemUsageStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalUsers: number
    totalRequests: number
    totalCostUnits: number
    averageRequestsPerUser: number
    topUsers: Array<{
      userId: string
      requests: number
      costUnits: number
    }>
    topEndpoints: Array<{
      endpoint: string
      requests: number
      percentage: number
    }>
  }> {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const end = endDate || new Date()

    try {
      // Get aggregated data
      const { data: usageData, error: usageError } = await this.supabase
        .from('api_usage_tracking')
        .select('user_id, endpoint, cost_units')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (usageError) throw usageError

      const totalRequests = usageData?.length || 0
      const totalCostUnits = usageData?.reduce((sum, record) => sum + (record.cost_units || 1), 0) || 0
      const uniqueUsers = new Set(usageData?.map(record => record.user_id)).size

      // Calculate top users
      const userStats = usageData?.reduce((acc, record) => {
        if (!acc[record.user_id]) {
          acc[record.user_id] = { requests: 0, costUnits: 0 }
        }
        acc[record.user_id].requests += 1
        acc[record.user_id].costUnits += record.cost_units || 1
        return acc
      }, {} as Record<string, { requests: number; costUnits: number }>) || {}

      const topUsers = Object.entries(userStats)
        .sort(([, a], [, b]) => b.requests - a.requests)
        .slice(0, 10)
        .map(([userId, stats]) => ({
          userId,
          requests: stats.requests,
          costUnits: stats.costUnits
        }))

      // Calculate top endpoints
      const endpointStats = usageData?.reduce((acc, record) => {
        acc[record.endpoint] = (acc[record.endpoint] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      const topEndpoints = Object.entries(endpointStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, requests]) => ({
          endpoint,
          requests,
          percentage: totalRequests > 0 ? (requests / totalRequests) * 100 : 0
        }))

      return {
        totalUsers: uniqueUsers,
        totalRequests,
        totalCostUnits,
        averageRequestsPerUser: uniqueUsers > 0 ? totalRequests / uniqueUsers : 0,
        topUsers,
        topEndpoints
      }
    } catch (error) {
      console.error('Error getting system usage statistics:', error)
      throw error
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(userId: string): Promise<void> {
    try {
      await this.supabase.rpc('detect_suspicious_activity', {
        p_user_id: userId
      })
    } catch (error) {
      console.error('Error checking suspicious activity:', error)
    }
  }

  /**
   * Log suspicious activity
   */
  private async logSuspiciousActivity(
    userId: string,
    activityType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('suspicious_activity_log')
        .insert({
          user_id: userId,
          activity_type: activityType,
          severity,
          description,
          metadata
        })

      if (error) {
        console.error('Failed to log suspicious activity:', error)
      }
    } catch (error) {
      console.error('Error logging suspicious activity:', error)
    }
  }

  /**
   * Calculate reset time for rate limits
   */
  private calculateResetTime(limitType: string, windowStart: string): Date | undefined {
    if (!windowStart) return undefined

    const start = new Date(windowStart)
    
    switch (limitType) {
      case 'hourly':
        return new Date(start.getTime() + 60 * 60 * 1000) // +1 hour
      case 'daily':
        return new Date(start.getTime() + 24 * 60 * 60 * 1000) // +1 day
      case 'monthly':
        const nextMonth = new Date(start)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth
      default:
        return undefined
    }
  }
}

export const apiUsageService = new APIUsageService()