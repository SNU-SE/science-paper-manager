// Monitoring and error tracking utilities
import React from 'react'
import { PerformanceMonitor } from './performance'
import { analytics } from './analytics'

interface ErrorReport {
  message: string
  stack?: string
  url: string
  lineNumber?: number
  columnNumber?: number
  timestamp: Date
  userAgent: string
  userId?: string
  context?: any
}

interface PerformanceReport {
  metric: string
  value: number
  timestamp: Date
  url: string
  userId?: string
  context?: any
}

class MonitoringService {
  private static instance: MonitoringService
  private isEnabled: boolean = false
  private errorQueue: ErrorReport[] = []
  private performanceQueue: PerformanceReport[] = []
  private userId?: string

  constructor() {
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true'
    this.initialize()
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  private initialize(): void {
    if (!this.isEnabled || typeof window === 'undefined') return

    // Initialize Sentry if available
    this.initializeSentry()

    // Set up global error handlers
    this.setupGlobalErrorHandlers()

    // Set up performance monitoring
    this.setupPerformanceMonitoring()

    // Flush queues periodically
    setInterval(() => {
      this.flushQueues()
    }, 30000) // Every 30 seconds
  }

  private async initializeSentry(): Promise<void> {
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (!sentryDsn || typeof window === 'undefined') return

    try {
      // Dynamic import with proper error handling
      const Sentry = await import('@sentry/nextjs')
      
      Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0.1,
        beforeSend: (event) => {
          // Filter out non-critical errors
          if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection')) {
            return null
          }
          return event
        },
        integrations: [
          Sentry.browserTracingIntegration({
            tracePropagationTargets: [window.location.hostname],
          }),
        ],
      })

      // Set user context
      if (this.userId) {
        Sentry.setUser({ id: this.userId })
      }
    } catch (error) {
      console.warn('Failed to initialize Sentry:', error)
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        context: { type: 'javascript_error' }
      })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        context: { type: 'promise_rejection', reason: event.reason }
      })
    })

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.reportError({
          message: `Resource loading error: ${(event.target as any)?.src || (event.target as any)?.href}`,
          url: window.location.href,
          timestamp: new Date(),
          userAgent: navigator.userAgent,
          userId: this.userId,
          context: { 
            type: 'resource_error',
            resource: (event.target as any)?.src || (event.target as any)?.href,
            tagName: (event.target as any)?.tagName
          }
        })
      }
    }, true)
  }

  private setupPerformanceMonitoring(): void {
    const monitor = PerformanceMonitor.getInstance()

    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.reportPerformance({
              metric: entry.name,
              value: entry.startTime,
              timestamp: new Date(),
              url: window.location.href,
              userId: this.userId,
              context: { entryType: entry.entryType }
            })
          }
        })

        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
      } catch (error) {
        console.warn('Performance observer not fully supported:', error)
      }
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.reportPerformance({
                metric: 'long_task',
                value: entry.duration,
                timestamp: new Date(),
                url: window.location.href,
                userId: this.userId,
                context: { 
                  startTime: entry.startTime,
                  duration: entry.duration
                }
              })
            }
          }
        })

        longTaskObserver.observe({ entryTypes: ['longtask'] })
      } catch (error) {
        console.warn('Long task observer not supported:', error)
      }
    }
  }

  setUserId(userId: string): void {
    this.userId = userId

    // Update Sentry user context
    if (typeof window !== 'undefined') {
      try {
        import('@sentry/nextjs').then((Sentry) => {
          Sentry.setUser({ id: userId })
        }).catch(() => {
          // Sentry not available, silently continue
        })
      } catch {
        // Dynamic import failed, silently continue
      }
    }
  }

  reportError(error: ErrorReport): void {
    if (!this.isEnabled) return

    // Add to queue
    this.errorQueue.push(error)

    // Report to analytics
    analytics.trackError(new Error(error.message), error.context?.type)

    // Report to Sentry if available
    if (typeof window !== 'undefined') {
      try {
        import('@sentry/nextjs').then((Sentry) => {
          Sentry.captureException(new Error(error.message), {
            contexts: {
              error_details: error.context,
              user_agent: error.userAgent,
              url: error.url
            },
            user: { id: error.userId }
          })
        }).catch(() => {
          // Sentry not available, silently continue
        })
      } catch {
        // Dynamic import failed, silently continue
      }
    }

    // Flush immediately for critical errors
    if (error.message.toLowerCase().includes('critical') || 
        error.message.toLowerCase().includes('fatal')) {
      this.flushQueues()
    }
  }

  reportPerformance(performance: PerformanceReport): void {
    if (!this.isEnabled) return

    // Add to queue
    this.performanceQueue.push(performance)

    // Report to analytics
    analytics.trackPerformance(performance.metric, performance.value)

    // Report critical performance issues immediately
    if (performance.value > 3000) { // > 3 seconds
      this.flushQueues()
    }
  }

  private async flushQueues(): Promise<void> {
    if (this.errorQueue.length === 0 && this.performanceQueue.length === 0) return

    try {
      // Send to custom monitoring endpoint
      if (this.errorQueue.length > 0 || this.performanceQueue.length > 0) {
        await fetch('/api/monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errors: this.errorQueue.splice(0),
            performance: this.performanceQueue.splice(0),
            timestamp: new Date().toISOString()
          })
        })
      }
    } catch (error) {
      console.warn('Failed to flush monitoring queues:', error)
    }
  }

  // Manual error reporting
  captureException(error: Error, context?: any): void {
    this.reportError({
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      userId: this.userId,
      context
    })
  }

  // Manual performance reporting
  capturePerformance(metric: string, value: number, context?: any): void {
    this.reportPerformance({
      metric,
      value,
      timestamp: new Date(),
      url: window.location.href,
      userId: this.userId,
      context
    })
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('/api/health')
      return response.ok
    } catch (error) {
      this.captureException(error as Error, { type: 'health_check' })
      return false
    }
  }

  // Get monitoring stats
  getStats(): {
    errorQueueSize: number
    performanceQueueSize: number
    isEnabled: boolean
    userId?: string
  } {
    return {
      errorQueueSize: this.errorQueue.length,
      performanceQueueSize: this.performanceQueue.length,
      isEnabled: this.isEnabled,
      userId: this.userId
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance()

// React hook for monitoring
export function useMonitoring() {
  return {
    reportError: monitoring.reportError.bind(monitoring),
    reportPerformance: monitoring.reportPerformance.bind(monitoring),
    captureException: monitoring.captureException.bind(monitoring),
    capturePerformance: monitoring.capturePerformance.bind(monitoring),
    setUserId: monitoring.setUserId.bind(monitoring),
    healthCheck: monitoring.healthCheck.bind(monitoring),
    getStats: monitoring.getStats.bind(monitoring)
  }
}

// Error boundary integration
export function withMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  return function MonitoringWrapper(props: P) {
    React.useEffect(() => {
      const startTime = performance.now()
      
      return () => {
        const endTime = performance.now()
        monitoring.capturePerformance(
          `component_lifecycle_${componentName}`,
          endTime - startTime,
          { component: componentName }
        )
      }
    }, [])

    const handleError = React.useCallback((error: Error, errorInfo: any) => {
      monitoring.captureException(error, {
        component: componentName,
        errorInfo,
        type: 'react_error_boundary'
      })
    }, [])

    return React.createElement(ErrorBoundary, { onError: handleError },
      React.createElement(WrappedComponent, props)
    )
  }
}

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: any) => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: "p-4 border border-red-200 rounded-lg bg-red-50"
      }, [
        React.createElement('h2', {
          key: 'title',
          className: "text-red-800 font-semibold"
        }, 'Something went wrong'),
        React.createElement('p', {
          key: 'message',
          className: "text-red-600 text-sm mt-1"
        }, 'An error occurred in this component. Please refresh the page.')
      ])
    }

    return this.props.children
  }
}