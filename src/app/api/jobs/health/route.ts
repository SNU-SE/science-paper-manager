import { NextRequest, NextResponse } from 'next/server'
import { checkBackgroundJobsHealth } from '@/services/background'

/**
 * GET /api/jobs/health - Health check for background job system
 */
export async function GET(request: NextRequest) {
  try {
    const healthCheck = await checkBackgroundJobsHealth()

    const statusCode = healthCheck.healthy ? 200 : 503

    return NextResponse.json({
      ...healthCheck,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }, { status: statusCode })

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        healthy: false,
        queueManager: false,
        worker: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}