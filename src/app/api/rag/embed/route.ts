import { NextRequest, NextResponse } from 'next/server'
import { SupabaseVectorService } from '@/services/vector/SupabaseVectorService'
import type { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paper, evaluation, analyses, openaiApiKey } = body

    // Validate required fields
    if (!paper || typeof paper !== 'object') {
      return NextResponse.json(
        { error: 'Paper data is required' },
        { status: 400 }
      )
    }

    if (!openaiApiKey || typeof openaiApiKey !== 'string') {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Initialize vector service
    const vectorService = new SupabaseVectorService(openaiApiKey)

    // Embed paper with context
    await vectorService.embedPaperWithContext({
      paper: paper as Paper,
      evaluation: evaluation as UserEvaluation | undefined,
      analyses: analyses as MultiModelAnalysis | undefined
    })

    return NextResponse.json({
      success: true,
      message: `Successfully embedded paper: ${paper.title}`
    })

  } catch (error) {
    console.error('Paper embedding API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to embed paper',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paperId')
    const openaiApiKey = searchParams.get('openaiApiKey')

    // Validate required fields
    if (!paperId) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Initialize vector service
    const vectorService = new SupabaseVectorService(openaiApiKey)

    // Remove paper embedding
    await vectorService.removePaperEmbedding(paperId)

    return NextResponse.json({
      success: true,
      message: `Successfully removed embedding for paper: ${paperId}`
    })

  } catch (error) {
    console.error('Paper embedding removal API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to remove paper embedding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}