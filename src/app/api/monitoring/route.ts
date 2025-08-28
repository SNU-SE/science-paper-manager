import { NextRequest, NextResponse } from 'next/server'

interface ErrorReport {
  message: string
  stack?: string
  url: string
  lineNumber?: number
  columnNumber?: number
  timestamp: string
  userAgent: string
  userId?: string
  context?: any
}

interface PerformanceReport {
  metric: string
  value: number
  timestamp: string
  url: string
  userId?: string
  context?: any
}

interface MonitoringData {
  errors: ErrorReport[]
  performance: PerformanceReport[]
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    const data: MonitoringData = await request.json()
    
    // Log errors and performance data
    if (data.errors.length > 0) {
      console.error('Client Errors:', JSON.stringify(data.errors, null, 2))
      
      // In production, you might want to send this to a logging service
      // like Datadog, New Relic, or a custom logging endpoint
      if (process.env.NODE_ENV === 'production') {
        await logToExternalService('errors', data.errors)
      }
    }
    
    if (data.performance.length > 0) {
      console.log('Performance Metrics:', JSON.stringify(data.performance, null, 2))
      
      if (process.env.NODE_ENV === 'production') {
        await logToExternalService('performance', data.performance)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      processed: {
        errors: data.errors.length,
        performance: data.performance.length
      }
    })
    
  } catch (error) {
    console.error('Monitoring endpoint error:', error)
    return NextResponse.json(
      { error: 'Failed to process monitoring data' },
      { status: 500 }
    )
  }
}

async function logToExternalService(type: 'errors' | 'performance', data: any[]) {
  // Example integration with external logging service
  // Replace with your preferred logging service
  
  try {
    // Example: Send to Datadog
    if (process.env.DATADOG_API_KEY) {
      await fetch('https://http-intake.logs.datadoghq.com/v1/input/' + process.env.DATADOG_API_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ddsource: 'science-paper-manager',
          ddtags: `env:${process.env.NODE_ENV},type:${type}`,
          hostname: 'vercel',
          service: 'science-paper-manager',
          message: JSON.stringify(data)
        })
      })
    }
    
    // Example: Send to custom webhook
    if (process.env.MONITORING_WEBHOOK_URL) {
      await fetch(process.env.MONITORING_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MONITORING_WEBHOOK_TOKEN}`
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          source: 'science-paper-manager'
        })
      })
    }
    
  } catch (error) {
    console.error('Failed to send to external logging service:', error)
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  })
}