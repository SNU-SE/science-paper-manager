import { NextRequest, NextResponse } from 'next/server'
import { getHealthService } from '@/services/health'

export async function GET(request: NextRequest) {
  try {
    const healthService = getHealthService()
    
    // Get comprehensive health information
    const [
      systemHealth,
      resourceMetrics,
      resourceAlerts,
      recoveryStats,
      resourceSummary
    ] = await Promise.all([
      healthService.getSystemHealth(),
      healthService.getCurrentResourceMetrics(),
      healthService.getActiveResourceAlerts(),
      healthService.getRecoveryStats(),
      healthService.getResourceSummary()
    ])

    const detailedHealth = {
      system: systemHealth,
      resources: {
        current: resourceMetrics,
        alerts: resourceAlerts,
        summary: resourceSummary
      },
      recovery: recoveryStats,
      timestamp: new Date()
    }

    const statusCode = systemHealth.overall === 'healthy' ? 200 : 
                      systemHealth.overall === 'degraded' ? 200 : 503

    return NextResponse.json(detailedHealth, { status: statusCode })
  } catch (error) {
    console.error('Detailed health check failed:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve detailed health information',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }, { status: 500 })
  }
}