import { NextRequest, NextResponse } from 'next/server'
import { getHealthService } from '@/services/health'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const timeRange = searchParams.get('timeRange') ? parseInt(searchParams.get('timeRange')!) : undefined

    const healthService = getHealthService()
    
    const resourceData = {
      current: healthService.getCurrentResourceMetrics(),
      history: healthService.getResourceHistory(limit),
      alerts: healthService.getActiveResourceAlerts(),
      summary: healthService.getResourceSummary(timeRange)
    }

    return NextResponse.json(resourceData)
  } catch (error) {
    console.error('Resource metrics retrieval failed:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve resource metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}