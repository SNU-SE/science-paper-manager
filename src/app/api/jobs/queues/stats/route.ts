import { NextRequest, NextResponse } from 'next/server'
import { JobQueueManager } from '@/services/background/JobQueueManager'

export async function GET(request: NextRequest) {
  try {
    const jobQueueManager = new JobQueueManager()
    const queueStats = await jobQueueManager.getQueueStats()

    return NextResponse.json({
      success: true,
      data: queueStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Queue stats fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch queue statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}