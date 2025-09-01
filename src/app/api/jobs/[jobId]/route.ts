import { NextRequest, NextResponse } from 'next/server'
import { getJobQueueManager } from '@/services/background'

/**
 * GET /api/jobs/[jobId] - Get job status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const jobQueueManager = getJobQueueManager()
    const jobStatus = await jobQueueManager.getJobStatus(jobId)

    return NextResponse.json({
      success: true,
      job: jobStatus
    })

  } catch (error) {
    console.error(`Failed to get job status for ${params.jobId}:`, error)
    
    // Handle specific error cases
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/jobs/[jobId] - Cancel a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const jobQueueManager = getJobQueueManager()
    const cancelled = await jobQueueManager.cancelJob(jobId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job not found or cannot be cancelled' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    })

  } catch (error) {
    console.error(`Failed to cancel job ${params.jobId}:`, error)
    return NextResponse.json(
      { 
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs/[jobId]/retry - Retry a failed job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const jobQueueManager = getJobQueueManager()
    const retriedJobId = await jobQueueManager.retryFailedJob(jobId)

    return NextResponse.json({
      success: true,
      jobId: retriedJobId,
      message: 'Job retry initiated successfully'
    })

  } catch (error) {
    console.error(`Failed to retry job ${params.jobId}:`, error)
    
    // Handle specific error cases
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    if (error instanceof Error && error.message.includes('not in failed state')) {
      return NextResponse.json(
        { error: 'Job is not in failed state and cannot be retried' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to retry job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}