import { NextRequest, NextResponse } from 'next/server'
import { checkBackgroundJobsHealth } from '@/services/background'

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive health status
    const healthStatus = await checkBackgroundJobsHealth()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...healthStatus
    })
  } catch (error) {
    console.error('Failed to get background jobs status:', error)
    
    return NextResponse.json(
      { 
        success: false,
        healthy: false,
        error: 'Failed to get background jobs status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}