import { NextRequest, NextResponse } from 'next/server'
import { getJobQueueManager } from '@/services/background'
import { AIProvider } from '@/services/background/types'

/**
 * POST /api/jobs - Create a new background job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, paperId, providers } = body

    // Validate request
    if (!type || !paperId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, paperId' },
        { status: 400 }
      )
    }

    if (type === 'ai-analysis') {
      if (!providers || !Array.isArray(providers) || providers.length === 0) {
        return NextResponse.json(
          { error: 'AI analysis jobs require at least one provider' },
          { status: 400 }
        )
      }

      const validProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'xai']
      const invalidProviders = providers.filter((p: string) => !validProviders.includes(p as AIProvider))
      
      if (invalidProviders.length > 0) {
        return NextResponse.json(
          { error: `Invalid providers: ${invalidProviders.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const jobQueueManager = getJobQueueManager()
    
    let jobId: string
    
    switch (type) {
      case 'ai-analysis':
        jobId = await jobQueueManager.addAnalysisJob(paperId, providers)
        break
      default:
        return NextResponse.json(
          { error: `Unsupported job type: ${type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job queued successfully'
    })

  } catch (error) {
    console.error('Failed to create job:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs - Get queue status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const jobQueueManager = getJobQueueManager()
    const queueStatus = await jobQueueManager.getQueueStatus()
    const isHealthy = await jobQueueManager.isHealthy()

    return NextResponse.json({
      success: true,
      queueStatus,
      isHealthy,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to get queue status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}