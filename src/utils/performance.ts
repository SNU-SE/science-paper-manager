// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Measure component render time
  measureRender(componentName: string, renderFn: () => void): void {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    this.recordMetric(`render_${componentName}`, end - start)
  }

  // Measure API call duration
  async measureApiCall<T>(
    endpoint: string, 
    apiCall: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await apiCall()
      const end = performance.now()
      this.recordMetric(`api_${endpoint}`, end - start)
      return result
    } catch (error) {
      const end = performance.now()
      this.recordMetric(`api_${endpoint}_error`, end - start)
      throw error
    }
  }

  // Record custom metrics
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
    
    // Keep only last 100 measurements
    const values = this.metrics.get(name)!
    if (values.length > 100) {
      values.shift()
    }
  }

  // Get performance statistics
  getStats(metricName: string): {
    avg: number
    min: number
    max: number
    count: number
  } | null {
    const values = this.metrics.get(metricName)
    if (!values || values.length === 0) return null

    return {
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  // Get all metrics
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        stats[name] = {
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        }
      }
    }
    return stats
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics.clear()
  }
}

// Web Vitals monitoring
export const measureWebVitals = () => {
  if (typeof window === 'undefined') return

  // Measure Core Web Vitals
  const observer = new PerformanceObserver((list) => {
    const monitor = PerformanceMonitor.getInstance()
    
    for (const entry of list.getEntries()) {
      switch (entry.entryType) {
        case 'largest-contentful-paint':
          monitor.recordMetric('lcp', entry.startTime)
          break
        case 'first-input':
          monitor.recordMetric('fid', (entry as any).processingStart - entry.startTime)
          break
        case 'layout-shift':
          if (!(entry as any).hadRecentInput) {
            monitor.recordMetric('cls', (entry as any).value)
          }
          break
      }
    }
  })

  try {
    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
  } catch (e) {
    // Fallback for browsers that don't support all entry types
    console.warn('Some performance metrics not supported:', e)
  }
}

// Bundle size analyzer helper
export const analyzeBundleSize = () => {
  if (typeof window === 'undefined') return

  const scripts = Array.from(document.querySelectorAll('script[src]'))
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  
  const monitor = PerformanceMonitor.getInstance()
  
  scripts.forEach((script, index) => {
    const src = (script as HTMLScriptElement).src
    if (src.includes('/_next/static/')) {
      // Estimate bundle size from URL patterns
      monitor.recordMetric(`bundle_script_${index}`, 1)
    }
  })
  
  styles.forEach((style, index) => {
    const href = (style as HTMLLinkElement).href
    if (href.includes('/_next/static/')) {
      monitor.recordMetric(`bundle_style_${index}`, 1)
    }
  })
}

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if (typeof window === 'undefined' || !(performance as any).memory) return

  const monitor = PerformanceMonitor.getInstance()
  const memory = (performance as any).memory
  
  monitor.recordMetric('memory_used', memory.usedJSHeapSize)
  monitor.recordMetric('memory_total', memory.totalJSHeapSize)
  monitor.recordMetric('memory_limit', memory.jsHeapSizeLimit)
}

// Performance hook for React components
export const usePerformanceMonitor = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance()
  
  return {
    measureRender: (renderFn: () => void) => 
      monitor.measureRender(componentName, renderFn),
    measureApiCall: <T>(endpoint: string, apiCall: () => Promise<T>) =>
      monitor.measureApiCall(endpoint, apiCall),
    recordMetric: (name: string, value: number) =>
      monitor.recordMetric(`${componentName}_${name}`, value)
  }
}