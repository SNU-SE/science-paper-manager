import { NextRequest, NextResponse } from 'next/server'
import { getJobQueueManager } from '@/services/background'
import { AIProvider } from '@/services/background/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paperId, providers } = body

    // Validate input
    if (!paperId) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    if (!providers || !Array.isArray(providers) || providers.length === 0) {
      return NextResponse.json(
        { error: 'At least one AI provider is required' },
        { status: 400 }
      )
    }

    // Validate providers
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'xai']
    const invalidProviders = providers.filter(p => !validProviders.includes(p))
    
    if (invalidProviders.length > 0) {
      return NextResponse.json(
        { error: `Invalid AI providers: ${invalidProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Add job to queue
    const queueManager = getJobQueueManager()
    const jobId = await queueManager.addAnalysisJob(paperId, providers)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Analysis job queued successfully',
      providers
    })
  } catch (error) {
    console.error('Failed to queue analysis job:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to queue analysis job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get job status
    const queueManager = getJobQueueManager()
    const jobStatus = await queueManager.getJobStatus(jobId)

    return NextResponse.json({
      success: true,
      jobStatus
    })
  } catch (error) {
    console.error('Failed to get job status:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}