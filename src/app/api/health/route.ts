import { NextRequest, NextResponse } from 'next/server'
import { getHealthService } from '@/services/health'

export async function GET(request: NextRequest) {
  try {
    const healthService = getHealthService()
    const systemHealth = await healthService.getSystemHealth()

    // Return appropriate HTTP status based on system health
    const statusCode = systemHealth.overall === 'healthy' ? 200 : 
                      systemHealth.overall === 'degraded' ? 200 : 503

    return NextResponse.json(systemHealth, { status: statusCode })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      overall: 'unhealthy',
      services: [],
      timestamp: new Date(),
      uptime: 0,
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 503 })
  }
}

// Simple health check endpoint for load balancers
export async function HEAD(request: NextRequest) {
  try {
    const healthService = getHealthService()
    const systemHealth = await healthService.getSystemHealth()
    
    const statusCode = systemHealth.overall === 'healthy' ? 200 : 503
    return new NextResponse(null, { status: statusCode })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}