import { NextRequest, NextResponse } from 'next/server'
import { SupabaseVectorService } from '@/services/vector/SupabaseVectorService'
import type { SearchFilters } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { question, filters, openaiApiKey } = body

    // Validate required fields
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
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

    // Build search context from filters
    const searchContext = buildSearchContext(filters)

    // Perform RAG query
    const ragResponse = await vectorService.ragQuery(question.trim(), searchContext)

    return NextResponse.json({
      success: true,
      data: ragResponse
    })

  } catch (error) {
    console.error('RAG query API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process RAG query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Build search context from filters for vector search
 */
function buildSearchContext(filters?: SearchFilters): Record<string, unknown> {
  if (!filters) return {}

  const context: Record<string, unknown> = {}

  if (filters.readingStatus?.length) {
    context.reading_status = filters.readingStatus
  }

  if (filters.publicationYear) {
    if (filters.publicationYear.min) {
      context.publication_year_min = filters.publicationYear.min
    }
    if (filters.publicationYear.max) {
      context.publication_year_max = filters.publicationYear.max
    }
  }

  if (filters.tags?.length) {
    context.tags = filters.tags
  }

  if (filters.rating) {
    if (filters.rating.min) {
      context.rating_min = filters.rating.min
    }
    if (filters.rating.max) {
      context.rating_max = filters.rating.max
    }
  }

  return context
}