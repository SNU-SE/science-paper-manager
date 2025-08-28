import { NextRequest, NextResponse } from 'next/server'
import { SupabaseVectorService } from '@/services/vector/SupabaseVectorService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const openaiApiKey = searchParams.get('openaiApiKey')

    // Validate required fields
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Initialize vector service
    const vectorService = new SupabaseVectorService(openaiApiKey)

    // Get embedding statistics
    const stats = await vectorService.getEmbeddingStats()

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('RAG stats API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get RAG statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}