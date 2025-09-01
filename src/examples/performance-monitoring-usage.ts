/**
 * Performance Monitoring Usage Examples
 * 
 * This file demonstrates how to integrate performance monitoring
 * into your Next.js application.
 */

import { performanceMonitor } from '@/services/monitoring/PerformanceMonitor'
import { trackDatabaseQuery, trackUserActivity } from '@/middleware/performanceMiddleware'
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring'

// Example 1: Tracking API requests in route handlers
export async function exampleAPIRoute() {
  const startTime = Date.now()
  
  try {
    // Your API logic here
    const result = await someAPILogic()
    
    // Manual tracking if needed
    const responseTime = Date.now() - startTime
    // Note: Automatic tracking is handled by middleware
    
    return result
  } catch (error) {
    // Error tracking is also handled automatically
    throw error
  }
}

// Example 2: Tracking database queries
export async function exampleDatabaseQuery() {
  const query = 'SELECT * FROM papers WHERE user_id = $1'
  
  return trackDatabaseQuery(
    async () => {
      // Your database query logic
      return await database.query(query, ['user-id'])
    },
    query
  )
}

// Example 3: Tracking user activities
export async function exampleUserActivity(userId: string) {
  await trackUserActivity(
    userId,
    'paper_upload',
    'papers',
    { 
      fileSize: 1024 * 1024, // 1MB
      fileType: 'pdf',
      processingTime: 5000 // 5 seconds
    }
  )
}

// Example 4: Using the performance monitoring hook in React components
export function ExampleComponent() {
  const { 
    data, 
    loading, 
    error, 
    trackUserActivity, 
    trackCustomEvent 
  } = usePerformanceMonitoring()

  const handleButtonClick = async () => {
    // Track user interaction
    await trackUserActivity('button_click', 'ui_interaction', {
      buttonId: 'upload-paper',
      timestamp: Date.now()
    })
  }

  const handleFeatureUsage = async () => {
    // Track custom events
    await trackCustomEvent('ai_analysis_started', {
      provider: 'openai',
      paperCount: 1,
      analysisType: 'summary'
    })
  }

  if (loading) return <div>Loading metrics...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>Performance Metrics</h2>
      {data && (
        <div>
          <p>Active Users: {data.activeUsers}</p>
          <p>Avg Response Time: {data.recent.apiMetrics.averageResponseTime}ms</p>
          <p>Error Rate: {data.recent.apiMetrics.errorRate}%</p>
        </div>
      )}
      <button onClick={handleButtonClick}>Track Click</button>
      <button onClick={handleFeatureUsage}>Track Feature Usage</button>
    </div>
  )
}

// Example 5: Setting up middleware in your Next.js app
export function setupPerformanceMiddleware() {
  // In your middleware.ts file:
  /*
  import { performanceTrackingMiddleware } from '@/middleware/performanceMiddleware'
  
  export function middleware(request: NextRequest) {
    // Apply performance tracking to API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return performanceTrackingMiddleware()(request)
    }
  }
  
  export const config = {
    matcher: '/api/:path*'
  }
  */
}

// Example 6: Custom performance alerts
export async function checkCustomPerformanceThresholds() {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  
  const metrics = await performanceMonitor.getMetrics({
    start: oneHourAgo,
    end: now
  })
  
  const alerts = []
  
  // Custom threshold: More than 50 errors per hour
  if (metrics.apiMetrics.errorRate > 5) {
    alerts.push({
      type: 'high_error_rate',
      message: `Error rate is ${metrics.apiMetrics.errorRate}%, exceeding 5% threshold`,
      severity: 'high'
    })
  }
  
  // Custom threshold: Average response time over 2 seconds
  if (metrics.apiMetrics.averageResponseTime > 2000) {
    alerts.push({
      type: 'slow_response',
      message: `Average response time is ${metrics.apiMetrics.averageResponseTime}ms`,
      severity: 'medium'
    })
  }
  
  // Custom threshold: More than 100 active users (capacity planning)
  if (metrics.userMetrics.activeUsers > 100) {
    alerts.push({
      type: 'high_load',
      message: `${metrics.userMetrics.activeUsers} active users, consider scaling`,
      severity: 'low'
    })
  }
  
  return alerts
}

// Example 7: Performance optimization based on metrics
export async function optimizeBasedOnMetrics() {
  const metrics = await performanceMonitor.getDashboardData()
  
  // Identify slow endpoints
  const slowEndpoints = metrics.recent.apiMetrics.slowestEndpoints
    .filter(endpoint => endpoint.averageResponseTime > 1000)
  
  console.log('Slow endpoints requiring optimization:', slowEndpoints)
  
  // Identify slow queries
  const slowQueries = metrics.slowQueries
    .filter(query => query.averageExecutionTime > 500)
  
  console.log('Slow queries requiring optimization:', slowQueries)
  
  // Check if caching would help
  const highTrafficEndpoints = metrics.recent.apiMetrics.slowestEndpoints
    .filter(endpoint => endpoint.requestCount > 100)
  
  console.log('High traffic endpoints that could benefit from caching:', highTrafficEndpoints)
}

// Mock function for example
async function someAPILogic() {
  return { success: true }
}

// Mock database for example
const database = {
  query: async (query: string, params: any[]) => {
    return [{ id: 1, title: 'Example Paper' }]
  }
}