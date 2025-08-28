'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { PerformanceMonitor, measureWebVitals, monitorMemoryUsage } from '@/utils/performance'
import { analytics } from '@/utils/analytics'
import { monitoring } from '@/utils/monitoring'

interface PerformanceContextType {
  isMonitoring: boolean
  metrics: Record<string, any>
  startMonitoring: () => void
  stopMonitoring: () => void
  recordMetric: (name: string, value: number) => void
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined)

interface PerformanceProviderProps {
  children: React.ReactNode
  enableWebVitals?: boolean
  enableMemoryMonitoring?: boolean
  enableAnalytics?: boolean
}

export function PerformanceProvider({
  children,
  enableWebVitals = true,
  enableMemoryMonitoring = true,
  enableAnalytics = true
}: PerformanceProviderProps) {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [metrics, setMetrics] = useState<Record<string, any>>({})
  const monitor = PerformanceMonitor.getInstance()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true') {
      startMonitoring()
    }

    return () => {
      stopMonitoring()
    }
  }, [])

  const startMonitoring = () => {
    if (typeof window === 'undefined') return

    setIsMonitoring(true)

    // Start Web Vitals monitoring
    if (enableWebVitals) {
      measureWebVitals()
    }

    // Start memory monitoring
    if (enableMemoryMonitoring) {
      const memoryInterval = setInterval(() => {
        monitorMemoryUsage()
      }, 30000) // Every 30 seconds

      // Cleanup on unmount
      return () => clearInterval(memoryInterval)
    }

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      const currentMetrics = monitor.getAllStats()
      setMetrics(currentMetrics)

      // Report critical metrics to analytics
      if (enableAnalytics) {
        Object.entries(currentMetrics).forEach(([name, stats]) => {
          if (stats.avg > 1000) { // Report slow operations
            analytics.trackPerformance(name, stats.avg)
          }
        })
      }
    }, 10000) // Every 10 seconds

    return () => clearInterval(metricsInterval)
  }

  const stopMonitoring = () => {
    setIsMonitoring(false)
  }

  const recordMetric = (name: string, value: number) => {
    monitor.recordMetric(name, value)
    
    if (enableAnalytics) {
      analytics.trackPerformance(name, value)
    }
  }

  const contextValue: PerformanceContextType = {
    isMonitoring,
    metrics,
    startMonitoring,
    stopMonitoring,
    recordMetric
  }

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  )
}

export function usePerformance() {
  const context = useContext(PerformanceContext)
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider')
  }
  return context
}

// HOC for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const { recordMetric } = usePerformance()
    const [renderStart] = useState(() => performance.now())

    useEffect(() => {
      const renderEnd = performance.now()
      const renderTime = renderEnd - renderStart
      recordMetric(`component_render_${componentName}`, renderTime)
    }, [recordMetric, renderStart])

    return <WrappedComponent {...props} />
  }
}

// Performance monitoring hook for components
export function useComponentPerformance(componentName: string) {
  const { recordMetric } = usePerformance()
  
  const measureRender = React.useCallback((renderFn: () => void) => {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    recordMetric(`${componentName}_render`, end - start)
  }, [componentName, recordMetric])

  const measureAsyncOperation = React.useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const start = performance.now()
    try {
      const result = await operation()
      const end = performance.now()
      recordMetric(`${componentName}_${operationName}`, end - start)
      return result
    } catch (error) {
      const end = performance.now()
      recordMetric(`${componentName}_${operationName}_error`, end - start)
      throw error
    }
  }, [componentName, recordMetric])

  return {
    measureRender,
    measureAsyncOperation,
    recordMetric: (name: string, value: number) => 
      recordMetric(`${componentName}_${name}`, value)
  }
}