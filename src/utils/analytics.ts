// Analytics and monitoring utilities
import React from 'react'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
  }
}

interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
  custom_parameters?: Record<string, any>
}

interface UserProperties {
  user_id?: string
  user_type?: string
  subscription_tier?: string
  [key: string]: any
}

class Analytics {
  private static instance: Analytics
  private isEnabled: boolean = false
  private userId?: string

  constructor() {
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
    this.initialize()
  }

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics()
    }
    return Analytics.instance
  }

  private initialize(): void {
    if (!this.isEnabled || typeof window === 'undefined') return

    // Initialize Google Analytics 4
    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (GA_MEASUREMENT_ID) {
      this.initializeGA4(GA_MEASUREMENT_ID)
    }

    // Initialize custom analytics
    this.initializeCustomAnalytics()
  }

  private initializeGA4(measurementId: string): void {
    // Load Google Analytics script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)

    // Initialize gtag
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments)
    }
    
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      page_title: document.title,
      page_location: window.location.href,
    })
  }

  private initializeCustomAnalytics(): void {
    // Custom analytics initialization
    console.log('Custom analytics initialized')
  }

  // Set user properties
  setUser(properties: UserProperties): void {
    if (!this.isEnabled) return

    this.userId = properties.user_id
    
    if (window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        user_id: properties.user_id,
        custom_map: properties
      })
    }
  }

  // Track page views
  trackPageView(url: string, title?: string): void {
    if (!this.isEnabled) return

    if (window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
        page_title: title || document.title,
        page_location: url,
      })
    }

    // Custom page view tracking
    this.trackEvent({
      action: 'page_view',
      category: 'navigation',
      label: url,
      custom_parameters: {
        page_title: title || document.title,
        user_id: this.userId
      }
    })
  }

  // Track custom events
  trackEvent(event: AnalyticsEvent): void {
    if (!this.isEnabled) return

    if (window.gtag) {
      window.gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event.custom_parameters
      })
    }

    // Custom event tracking
    console.log('Analytics Event:', event)
  }

  // Track paper-related events
  trackPaperEvent(action: string, paperId: string, metadata?: any): void {
    this.trackEvent({
      action,
      category: 'paper_management',
      label: paperId,
      custom_parameters: {
        paper_id: paperId,
        ...metadata
      }
    })
  }

  // Track AI analysis events
  trackAIEvent(action: string, provider: string, metadata?: any): void {
    this.trackEvent({
      action,
      category: 'ai_analysis',
      label: provider,
      custom_parameters: {
        ai_provider: provider,
        ...metadata
      }
    })
  }

  // Track search events
  trackSearchEvent(action: string, query: string, results?: number): void {
    this.trackEvent({
      action,
      category: 'search',
      label: query,
      value: results,
      custom_parameters: {
        search_query: query,
        result_count: results
      }
    })
  }

  // Track performance metrics
  trackPerformance(metric: string, value: number, category: string = 'performance'): void {
    this.trackEvent({
      action: 'performance_metric',
      category,
      label: metric,
      value: Math.round(value),
      custom_parameters: {
        metric_name: metric,
        metric_value: value
      }
    })
  }

  // Track errors
  trackError(error: Error, context?: string): void {
    this.trackEvent({
      action: 'error',
      category: 'error_tracking',
      label: error.message,
      custom_parameters: {
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack,
        error_context: context
      }
    })
  }

  // Track user interactions
  trackInteraction(element: string, action: string, metadata?: any): void {
    this.trackEvent({
      action: 'user_interaction',
      category: 'ui_interaction',
      label: `${element}_${action}`,
      custom_parameters: {
        element,
        interaction_type: action,
        ...metadata
      }
    })
  }
}

// Export singleton instance
export const analytics = Analytics.getInstance()

// React hook for analytics
export function useAnalytics() {
  return {
    trackPageView: analytics.trackPageView.bind(analytics),
    trackEvent: analytics.trackEvent.bind(analytics),
    trackPaperEvent: analytics.trackPaperEvent.bind(analytics),
    trackAIEvent: analytics.trackAIEvent.bind(analytics),
    trackSearchEvent: analytics.trackSearchEvent.bind(analytics),
    trackPerformance: analytics.trackPerformance.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackInteraction: analytics.trackInteraction.bind(analytics),
    setUser: analytics.setUser.bind(analytics)
  }
}

// Higher-order component for automatic page view tracking
export function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  pageName?: string
) {
  return function AnalyticsWrapper(props: P) {
    if (typeof window !== 'undefined') {
      React.useEffect(() => {
        analytics.trackPageView(window.location.href, pageName)
      }, [])
    }

    return React.createElement(WrappedComponent, props)
  }
}

// Utility functions for common tracking scenarios
export const trackingUtils = {
  // Paper management tracking
  paperUploaded: (paperId: string, fileSize: number, provider?: string) => {
    analytics.trackPaperEvent('paper_uploaded', paperId, {
      file_size: fileSize,
      upload_provider: provider
    })
  },

  paperAnalyzed: (paperId: string, provider: string, duration: number) => {
    analytics.trackAIEvent('paper_analyzed', provider, {
      paper_id: paperId,
      analysis_duration: duration
    })
  },

  searchPerformed: (query: string, resultCount: number, searchType: 'semantic' | 'keyword') => {
    analytics.trackSearchEvent('search_performed', query, resultCount)
    analytics.trackEvent({
      action: 'search_type_used',
      category: 'search',
      label: searchType,
      custom_parameters: { search_type: searchType }
    })
  },

  ragQueryAsked: (question: string, responseTime: number, sourcesCount: number) => {
    analytics.trackEvent({
      action: 'rag_query',
      category: 'ai_interaction',
      label: 'question_asked',
      custom_parameters: {
        response_time: responseTime,
        sources_count: sourcesCount,
        question_length: question.length
      }
    })
  },

  // Performance tracking
  componentLoadTime: (componentName: string, loadTime: number) => {
    analytics.trackPerformance(`component_load_${componentName}`, loadTime, 'component_performance')
  },

  apiResponseTime: (endpoint: string, responseTime: number, status: number) => {
    analytics.trackPerformance(`api_response_${endpoint}`, responseTime, 'api_performance')
    analytics.trackEvent({
      action: 'api_call',
      category: 'api_usage',
      label: endpoint,
      custom_parameters: {
        response_time: responseTime,
        status_code: status
      }
    })
  },

  // Error tracking
  componentError: (componentName: string, error: Error) => {
    analytics.trackError(error, `component_${componentName}`)
  },

  apiError: (endpoint: string, error: Error, statusCode?: number) => {
    analytics.trackError(error, `api_${endpoint}`)
    analytics.trackEvent({
      action: 'api_error',
      category: 'error_tracking',
      label: endpoint,
      custom_parameters: {
        status_code: statusCode,
        error_type: error.name
      }
    })
  }
}