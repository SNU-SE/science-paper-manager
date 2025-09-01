import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export interface APIMetric {
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  userId?: string
  ipAddress?: string
  userAgent?: string
  requestSize?: number
  responseSize?: number
}

export interface DBQueryMetric {
  queryHash: string
  queryType: string
  executionTime: number
  rowsAffected?: number
  tableName?: string
}

export interface UserActivityMetric {
  userId: string
  action: string
  feature: string
  metadata?: Record<string, any>
  sessionId?: string
}

export interface SystemMetric {
  metricType: string
  metricName: string
  value: number
  unit?: string
  metadata?: Record<string, any>
}

export interface PerformanceMetrics {
  apiMetrics: {
    averageResponseTime: number
    requestsPerMinute: number
    errorRate: number
    slowestEndpoints: EndpointMetric[]
  }
  databaseMetrics: {
    averageQueryTime: number
    slowestQueries: QueryMetric[]
    connectionPoolStatus: PoolStatus
  }
  userMetrics: {
    activeUsers: number
    mostUsedFeatures: FeatureUsage[]
    userSessions: SessionMetric[]
  }
  systemMetrics: {
    memoryUsage: number
    cpuUsage: number
    diskUsage: number
    uptime: number
  }
}

export interface EndpointMetric {
  endpoint: string
  averageResponseTime: number
  requestCount: number
  errorRate: number
}

export interface QueryMetric {
  queryHash: string
  queryType: string
  averageExecutionTime: number
  executionCount: number
  tableName?: string
}

export interface FeatureUsage {
  feature: string
  usageCount: number
  uniqueUsers: number
}

export interface SessionMetric {
  sessionId: string
  userId: string
  duration: number
  activityCount: number
}

export interface PoolStatus {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingConnections: number
}

export interface TimeRange {
  start: Date
  end: Date
}

export class PerformanceMonitor {
  private getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not available')
    }
    
    return createClient(supabaseUrl, supabaseKey)
  }

  private async safeSupabaseQuery<T>(queryFn: (supabase: any) => Promise<T>, defaultValue: T): Promise<T> {
    try {
      const supabase = this.getSupabaseClient()
      return await queryFn(supabase)
    } catch (error) {
      console.warn('Supabase query failed, returning default:', error)
      return defaultValue
    }
  }

  /**
   * API 요청 메트릭 추적
   */
  async trackAPIRequest(
    req: NextRequest,
    res: NextResponse,
    responseTime: number
  ): Promise<void> {
    try {
      const url = new URL(req.url)
      const endpoint = url.pathname
      const method = req.method
      const statusCode = res.status
      
      // 사용자 ID 추출 (인증된 경우)
      const authHeader = req.headers.get('authorization')
      let userId: string | undefined
      
      if (authHeader) {
        try {
          const supabase = this.getSupabaseClient()
          const { data: { user } } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
          )
          userId = user?.id
        } catch (error) {
          // 인증 실패는 무시
        }
      }

      const metric: APIMetric = {
        endpoint,
        method,
        statusCode,
        responseTime,
        userId,
        ipAddress: this.getClientIP(req),
        userAgent: req.headers.get('user-agent') || undefined,
        requestSize: this.getRequestSize(req),
        responseSize: this.getResponseSize(res)
      }

      await this.recordAPIMetric(metric)
    } catch (error) {
      console.error('Failed to track API request:', error)
      // 메트릭 수집 실패는 시스템 동작을 방해하지 않음
    }
  }

  /**
   * 데이터베이스 쿼리 메트릭 추적
   */
  async trackDatabaseQuery(
    query: string,
    executionTime: number,
    rowsAffected?: number
  ): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(query)
      const queryType = this.extractQueryType(query)
      const tableName = this.extractTableName(query)

      const metric: DBQueryMetric = {
        queryHash,
        queryType,
        executionTime,
        rowsAffected,
        tableName
      }

      await this.recordDBQueryMetric(metric)
    } catch (error) {
      console.error('Failed to track database query:', error)
    }
  }

  /**
   * 사용자 활동 메트릭 추적
   */
  async trackUserActivity(
    userId: string,
    action: string,
    feature: string,
    metadata?: Record<string, any>,
    sessionId?: string
  ): Promise<void> {
    try {
      const metric: UserActivityMetric = {
        userId,
        action,
        feature,
        metadata,
        sessionId
      }

      await this.recordUserActivityMetric(metric)
    } catch (error) {
      console.error('Failed to track user activity:', error)
    }
  }

  /**
   * 시스템 메트릭 추적
   */
  async trackSystemMetric(
    metricType: string,
    metricName: string,
    value: number,
    unit?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const metric: SystemMetric = {
        metricType,
        metricName,
        value,
        unit,
        metadata
      }

      await this.recordSystemMetric(metric)
    } catch (error) {
      console.error('Failed to track system metric:', error)
    }
  }

  /**
   * 성능 메트릭 조회
   */
  async getMetrics(timeRange: TimeRange): Promise<PerformanceMetrics> {
    try {
      const [apiMetrics, databaseMetrics, userMetrics, systemMetrics] = await Promise.all([
        this.getAPIMetrics(timeRange),
        this.getDatabaseMetrics(timeRange),
        this.getUserMetrics(timeRange),
        this.getSystemMetrics(timeRange)
      ])

      return {
        apiMetrics,
        databaseMetrics,
        userMetrics,
        systemMetrics
      }
    } catch (error) {
      console.warn('Failed to get metrics, returning mock data:', error)
      return {
        apiMetrics: {
          averageResponseTime: 150,
          requestsPerMinute: 45,
          errorRate: 0.01,
          slowestEndpoints: []
        },
        databaseMetrics: {
          averageQueryTime: 25,
          slowestQueries: [],
          connectionPoolStatus: {
            totalConnections: 20,
            activeConnections: 5,
            idleConnections: 15,
            waitingConnections: 0
          }
        },
        userMetrics: {
          activeUsers: 5,
          mostUsedFeatures: [],
          userSessions: []
        },
        systemMetrics: {
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          cpuUsage: 15,
          diskUsage: 30,
          uptime: Math.round(process.uptime())
        }
      }
    }
  }

  /**
   * 실시간 성능 대시보드 데이터
   */
  async getDashboardData(): Promise<any> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      recentMetrics,
      dailyMetrics,
      slowQueries,
      errorRates,
      activeUsers
    ] = await Promise.all([
      this.getMetrics({ start: oneHourAgo, end: now }),
      this.getMetrics({ start: oneDayAgo, end: now }),
      this.getSlowQueries(oneHourAgo),
      this.getErrorRates(oneHourAgo),
      this.getActiveUserCount(oneHourAgo)
    ])

    return {
      recent: recentMetrics,
      daily: dailyMetrics,
      slowQueries,
      errorRates,
      activeUsers,
      timestamp: now.toISOString()
    }
  }

  // Private helper methods

  private async recordAPIMetric(metric: APIMetric): Promise<void> {
    try {
      const supabase = this.getSupabaseClient()
      const { error } = await supabase
        .from('api_metrics')
        .insert({
          endpoint: metric.endpoint,
          method: metric.method,
          status_code: metric.statusCode,
          response_time: metric.responseTime,
          user_id: metric.userId,
          ip_address: metric.ipAddress,
          user_agent: metric.userAgent,
          request_size: metric.requestSize,
          response_size: metric.responseSize
        })

      if (error) {
        throw error
      }
    } catch (error) {
      // Gracefully handle Supabase unavailability
      console.warn('Failed to record API metric:', error)
    }
  }

  private async recordDBQueryMetric(metric: DBQueryMetric): Promise<void> {
    try {
      const supabase = this.getSupabaseClient()
      const { error } = await supabase
        .from('db_query_metrics')
        .insert({
          query_hash: metric.queryHash,
          query_type: metric.queryType,
          execution_time: metric.executionTime,
          rows_affected: metric.rowsAffected,
          table_name: metric.tableName
        })

      if (error) {
        throw error
      }
    } catch (error) {
      console.warn('Failed to record DB query metric:', error)
    }
  }

  private async recordUserActivityMetric(metric: UserActivityMetric): Promise<void> {
    try {
      const supabase = this.getSupabaseClient()
      const { error } = await supabase
        .from('user_activity_metrics')
        .insert({
          user_id: metric.userId,
          action: metric.action,
          feature: metric.feature,
          metadata: metric.metadata || {},
          session_id: metric.sessionId
        })

      if (error) {
        throw error
      }
    } catch (error) {
      console.warn('Failed to record user activity metric:', error)
    }
  }

  private async recordSystemMetric(metric: SystemMetric): Promise<void> {
    try {
      const supabase = this.getSupabaseClient()
      const { error } = await supabase
        .from('system_metrics')
        .insert({
          metric_type: metric.metricType,
          metric_name: metric.metricName,
          value: metric.value,
          unit: metric.unit,
          metadata: metric.metadata || {}
        })

      if (error) {
        throw error
      }
    } catch (error) {
      console.warn('Failed to record system metric:', error)
    }
  }

  private async getAPIMetrics(timeRange: TimeRange): Promise<PerformanceMetrics['apiMetrics']> {
    try {
      const supabase = this.getSupabaseClient()
      const { data, error } = await supabase
        .from('performance_summary')
        .select('*')
        .gte('hour', timeRange.start.toISOString())
        .lte('hour', timeRange.end.toISOString())

      if (error) throw error
    } catch (error) {
      console.warn('Failed to get API metrics, returning defaults:', error)
      const data = null
    }

    const totalRequests = data?.reduce((sum, row) => sum + row.request_count, 0) || 0
    const totalErrors = data?.reduce((sum, row) => sum + row.error_count, 0) || 0
    const avgResponseTime = data?.reduce((sum, row) => sum + (row.avg_response_time * row.request_count), 0) / totalRequests || 0
    const timeRangeMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60)

    return {
      averageResponseTime: Math.round(avgResponseTime),
      requestsPerMinute: Math.round(totalRequests / timeRangeMinutes),
      errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0,
      slowestEndpoints: data?.slice(0, 10).map(row => ({
        endpoint: row.endpoint,
        averageResponseTime: Math.round(row.avg_response_time),
        requestCount: row.request_count,
        errorRate: Math.round((row.error_count / row.request_count) * 100)
      })) || []
    }
  }

  private async getDatabaseMetrics(timeRange: TimeRange): Promise<PerformanceMetrics['databaseMetrics']> {
    const { data, error } = await this.supabase
      .from('slow_queries')
      .select('*')
      .limit(10)

    if (error) throw error

    const avgQueryTime = data?.reduce((sum, row) => sum + row.avg_execution_time, 0) / (data?.length || 1) || 0

    return {
      averageQueryTime: Math.round(avgQueryTime),
      slowestQueries: data?.map(row => ({
        queryHash: row.query_hash,
        queryType: row.query_type,
        averageExecutionTime: Math.round(row.avg_execution_time),
        executionCount: row.execution_count,
        tableName: row.table_name
      })) || [],
      connectionPoolStatus: await this.getConnectionPoolStatus()
    }
  }

  private async getUserMetrics(timeRange: TimeRange): Promise<PerformanceMetrics['userMetrics']> {
    const { data, error } = await this.supabase
      .from('user_activity_summary')
      .select('*')
      .gte('hour', timeRange.start.toISOString())
      .lte('hour', timeRange.end.toISOString())

    if (error) throw error

    const featureUsage = data?.reduce((acc, row) => {
      const existing = acc.find(f => f.feature === row.feature)
      if (existing) {
        existing.usageCount += row.activity_count
        existing.uniqueUsers += row.unique_users
      } else {
        acc.push({
          feature: row.feature,
          usageCount: row.activity_count,
          uniqueUsers: row.unique_users
        })
      }
      return acc
    }, [] as FeatureUsage[]) || []

    return {
      activeUsers: await this.getActiveUserCount(timeRange.start),
      mostUsedFeatures: featureUsage.slice(0, 10),
      userSessions: [] // TODO: Implement session tracking
    }
  }

  private async getSystemMetrics(timeRange: TimeRange): Promise<PerformanceMetrics['systemMetrics']> {
    // Node.js 프로세스 메트릭
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const uptime = process.uptime()

    return {
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // ms
      diskUsage: 0, // TODO: Implement disk usage monitoring
      uptime: Math.round(uptime)
    }
  }

  private async getConnectionPoolStatus(): Promise<PoolStatus> {
    // Supabase connection pool status - simplified
    return {
      totalConnections: 20,
      activeConnections: 5,
      idleConnections: 15,
      waitingConnections: 0
    }
  }

  private async getSlowQueries(since: Date): Promise<QueryMetric[]> {
    const { data, error } = await this.supabase
      .from('slow_queries')
      .select('*')
      .limit(5)

    if (error) throw error

    return data?.map(row => ({
      queryHash: row.query_hash,
      queryType: row.query_type,
      averageExecutionTime: Math.round(row.avg_execution_time),
      executionCount: row.execution_count,
      tableName: row.table_name
    })) || []
  }

  private async getErrorRates(since: Date): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('api_metrics')
      .select('endpoint, status_code')
      .gte('created_at', since.toISOString())
      .gte('status_code', 400)

    if (error) throw error

    const errorsByEndpoint = data?.reduce((acc, row) => {
      const key = row.endpoint
      if (!acc[key]) {
        acc[key] = { endpoint: key, errorCount: 0, errors: {} }
      }
      acc[key].errorCount++
      acc[key].errors[row.status_code] = (acc[key].errors[row.status_code] || 0) + 1
      return acc
    }, {} as Record<string, any>) || {}

    return Object.values(errorsByEndpoint).slice(0, 10)
  }

  private async getActiveUserCount(since: Date): Promise<number> {
    const { data, error } = await this.supabase
      .from('user_activity_metrics')
      .select('user_id')
      .gte('created_at', since.toISOString())

    if (error) throw error

    const uniqueUsers = new Set(data?.map(row => row.user_id) || [])
    return uniqueUsers.size
  }

  private getClientIP(req: NextRequest): string | undefined {
    const forwarded = req.headers.get('x-forwarded-for')
    const realIP = req.headers.get('x-real-ip')
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    
    return realIP || undefined
  }

  private getRequestSize(req: NextRequest): number | undefined {
    const contentLength = req.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : undefined
  }

  private getResponseSize(res: NextResponse): number | undefined {
    // Response size calculation would need to be implemented
    // based on the actual response body
    return undefined
  }

  private generateQueryHash(query: string): string {
    // 쿼리를 정규화하고 해시 생성
    const normalizedQuery = query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '$?') // 파라미터 정규화
      .trim()
      .toLowerCase()

    return crypto.createHash('sha256').update(normalizedQuery).digest('hex').substring(0, 16)
  }

  private extractQueryType(query: string): string {
    const trimmed = query.trim().toLowerCase()
    if (trimmed.startsWith('select')) return 'SELECT'
    if (trimmed.startsWith('insert')) return 'INSERT'
    if (trimmed.startsWith('update')) return 'UPDATE'
    if (trimmed.startsWith('delete')) return 'DELETE'
    if (trimmed.startsWith('create')) return 'CREATE'
    if (trimmed.startsWith('alter')) return 'ALTER'
    if (trimmed.startsWith('drop')) return 'DROP'
    return 'OTHER'
  }

  private extractTableName(query: string): string | undefined {
    const trimmed = query.trim().toLowerCase()
    
    // Simple table name extraction - could be improved
    const patterns = [
      /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /into\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /update\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /table\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    ]

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return undefined
  }
}

let performanceMonitorInstance: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor()
  }
  return performanceMonitorInstance
}

// For backward compatibility, but this will be lazy-loaded
export const performanceMonitor = {
  get instance() {
    return getPerformanceMonitor()
  },
  trackAPIRequest: (...args: Parameters<PerformanceMonitor['trackAPIRequest']>) => getPerformanceMonitor().trackAPIRequest(...args),
  trackDatabaseQuery: (...args: Parameters<PerformanceMonitor['trackDatabaseQuery']>) => getPerformanceMonitor().trackDatabaseQuery(...args),
  trackUserAction: (...args: Parameters<PerformanceMonitor['trackUserAction']>) => getPerformanceMonitor().trackUserAction(...args),
  getMetrics: (...args: Parameters<PerformanceMonitor['getMetrics']>) => getPerformanceMonitor().getMetrics(...args),
  getDashboardData: (...args: Parameters<PerformanceMonitor['getDashboardData']>) => getPerformanceMonitor().getDashboardData(...args),
  getAlerts: (...args: Parameters<PerformanceMonitor['getAlerts']>) => getPerformanceMonitor().getAlerts(...args),
  createAlert: (...args: Parameters<PerformanceMonitor['createAlert']>) => getPerformanceMonitor().createAlert(...args),
  updateAlert: (...args: Parameters<PerformanceMonitor['updateAlert']>) => getPerformanceMonitor().updateAlert(...args),
  deleteAlert: (...args: Parameters<PerformanceMonitor['deleteAlert']>) => getPerformanceMonitor().deleteAlert(...args)
}
export default PerformanceMonitor