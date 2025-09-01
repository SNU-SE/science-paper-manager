import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/services/monitoring/PerformanceMonitor'

/**
 * Performance tracking middleware for API routes
 */
export function performanceTrackingMiddleware() {
  return async (req: NextRequest, res: NextResponse, next: () => void) => {
    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    // Continue with the request
    await next()

    // Calculate metrics after response
    const endTime = Date.now()
    const endMemory = process.memoryUsage()
    const responseTime = endTime - startTime
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

    // Track the API request
    try {
      await performanceMonitor.trackAPIRequest(req, res, responseTime)
      
      // Track memory usage if significant
      if (Math.abs(memoryDelta) > 1024 * 1024) { // 1MB threshold
        await performanceMonitor.trackSystemMetric(
          'memory',
          'heap_delta',
          memoryDelta,
          'bytes',
          { endpoint: new URL(req.url).pathname }
        )
      }
    } catch (error) {
      console.error('Performance tracking failed:', error)
      // Don't throw - performance tracking shouldn't break the app
    }
  }
}

/**
 * Enhanced middleware with request/response size tracking
 */
export function enhancedPerformanceMiddleware() {
  return async (req: NextRequest) => {
    const startTime = Date.now()
    
    try {
      // Get original response
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body
      })
      
      const endTime = Date.now()
      const responseTime = endTime - startTime

      // Create new response to track
      const newResponse = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

      // Track performance in background
      setImmediate(async () => {
        try {
          await performanceMonitor.trackAPIRequest(req, newResponse, responseTime)
        } catch (error) {
          console.error('Performance tracking failed:', error)
        }
      })

      return newResponse
    } catch (error) {
      console.error('Enhanced performance middleware error:', error)
      // Return a basic response if fetch fails
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  }
}

/**
 * Database query performance wrapper
 */
export function trackDatabaseQuery<T>(
  queryFn: () => Promise<T>,
  queryString: string
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now()
    
    try {
      const result = await queryFn()
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // Track query performance
      setImmediate(async () => {
        try {
          let rowsAffected: number | undefined
          
          // Try to extract rows affected from result
          if (result && typeof result === 'object') {
            if ('length' in result && typeof result.length === 'number') {
              rowsAffected = result.length
            } else if ('count' in result && typeof result.count === 'number') {
              rowsAffected = result.count
            }
          }

          await performanceMonitor.trackDatabaseQuery(
            queryString,
            executionTime,
            rowsAffected
          )
        } catch (error) {
          console.error('Database query tracking failed:', error)
        }
      })

      resolve(result)
    } catch (error) {
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // Track failed query
      setImmediate(async () => {
        try {
          await performanceMonitor.trackDatabaseQuery(
            queryString + ' [FAILED]',
            executionTime
          )
        } catch (trackingError) {
          console.error('Failed query tracking failed:', trackingError)
        }
      })

      reject(error)
    }
  })
}

/**
 * User activity tracking helper
 */
export async function trackUserActivity(
  userId: string,
  action: string,
  feature: string,
  metadata?: Record<string, any>,
  sessionId?: string
): Promise<void> {
  try {
    await performanceMonitor.trackUserActivity(
      userId,
      action,
      feature,
      metadata,
      sessionId
    )
  } catch (error) {
    console.error('User activity tracking failed:', error)
  }
}

/**
 * System metrics collection
 */
export async function collectSystemMetrics(): Promise<void> {
  try {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Track memory metrics
    await performanceMonitor.trackSystemMetric(
      'memory',
      'heap_used',
      memoryUsage.heapUsed,
      'bytes'
    )
    
    await performanceMonitor.trackSystemMetric(
      'memory',
      'heap_total',
      memoryUsage.heapTotal,
      'bytes'
    )
    
    await performanceMonitor.trackSystemMetric(
      'memory',
      'external',
      memoryUsage.external,
      'bytes'
    )

    // Track CPU metrics
    await performanceMonitor.trackSystemMetric(
      'cpu',
      'user_time',
      cpuUsage.user,
      'microseconds'
    )
    
    await performanceMonitor.trackSystemMetric(
      'cpu',
      'system_time',
      cpuUsage.system,
      'microseconds'
    )

    // Track uptime
    await performanceMonitor.trackSystemMetric(
      'system',
      'uptime',
      process.uptime(),
      'seconds'
    )

  } catch (error) {
    console.error('System metrics collection failed:', error)
  }
}

/**
 * Performance alert thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_API_RESPONSE: 1000, // 1 second
  SLOW_DB_QUERY: 500, // 500ms
  HIGH_ERROR_RATE: 5, // 5%
  HIGH_MEMORY_USAGE: 500 * 1024 * 1024, // 500MB
  HIGH_CPU_USAGE: 80 // 80%
}

/**
 * Check if metrics exceed thresholds
 */
export async function checkPerformanceThresholds(): Promise<{
  alerts: Array<{
    type: string
    message: string
    value: number
    threshold: number
  }>
}> {
  const alerts: Array<{
    type: string
    message: string
    value: number
    threshold: number
  }> = []

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    const metrics = await performanceMonitor.getMetrics({
      start: oneHourAgo,
      end: now
    })

    // Check API response time
    if (metrics.apiMetrics.averageResponseTime > PERFORMANCE_THRESHOLDS.SLOW_API_RESPONSE) {
      alerts.push({
        type: 'slow_api_response',
        message: 'Average API response time is too high',
        value: metrics.apiMetrics.averageResponseTime,
        threshold: PERFORMANCE_THRESHOLDS.SLOW_API_RESPONSE
      })
    }

    // Check database query time
    if (metrics.databaseMetrics.averageQueryTime > PERFORMANCE_THRESHOLDS.SLOW_DB_QUERY) {
      alerts.push({
        type: 'slow_db_query',
        message: 'Average database query time is too high',
        value: metrics.databaseMetrics.averageQueryTime,
        threshold: PERFORMANCE_THRESHOLDS.SLOW_DB_QUERY
      })
    }

    // Check error rate
    if (metrics.apiMetrics.errorRate > PERFORMANCE_THRESHOLDS.HIGH_ERROR_RATE) {
      alerts.push({
        type: 'high_error_rate',
        message: 'API error rate is too high',
        value: metrics.apiMetrics.errorRate,
        threshold: PERFORMANCE_THRESHOLDS.HIGH_ERROR_RATE
      })
    }

    // Check memory usage
    if (metrics.systemMetrics.memoryUsage > PERFORMANCE_THRESHOLDS.HIGH_MEMORY_USAGE / 1024 / 1024) {
      alerts.push({
        type: 'high_memory_usage',
        message: 'Memory usage is too high',
        value: metrics.systemMetrics.memoryUsage,
        threshold: PERFORMANCE_THRESHOLDS.HIGH_MEMORY_USAGE / 1024 / 1024
      })
    }

  } catch (error) {
    console.error('Performance threshold check failed:', error)
  }

  return { alerts }
}

export default {
  performanceTrackingMiddleware,
  enhancedPerformanceMiddleware,
  trackDatabaseQuery,
  trackUserActivity,
  collectSystemMetrics,
  checkPerformanceThresholds
}