import { NextRequest, NextResponse } from 'next/server'
import { JobQueueManager } from '@/services/background/JobQueueManager'

export async function POST(
  request: NextRequest,
  { params }: { params: { queueName: string } }
) {
  try {
    const { queueName } = params

    if (!queueName) {
      return NextResponse.json(
        { success: false, error: 'Queue name is required' },
        { status: 400 }
      )
    }

    const jobQueueManager = new JobQueueManager()
    await jobQueueManager.pauseQueue()

    return NextResponse.json({
      success: true,
      message: `Queue ${queueName} paused successfully`
    })

  } catch (error) {
    console.error('Queue pause error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to pause queue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}