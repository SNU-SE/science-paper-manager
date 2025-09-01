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
    await jobQueueManager.resumeQueue()

    return NextResponse.json({
      success: true,
      message: `Queue ${queueName} resumed successfully`
    })

  } catch (error) {
    console.error('Queue resume error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resume queue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}