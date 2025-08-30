import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'
import { TABLES } from '@/lib/database'

interface AIAnalysisResult {
  id: string
  paperId: string
  modelProvider: 'openai' | 'anthropic' | 'xai' | 'gemini'
  modelName: string
  summary: string
  keywords: string[]
  scientificRelevance?: Record<string, unknown>
  confidenceScore: number
  tokensUsed: number
  processingTimeMs: number
  createdAt: Date
}

export async function GET(
  request: NextRequest,
  { params }: { params: { paperId: string; provider: string } }
) {
  try {
    const { paperId, provider } = params
    
    if (!paperId || !provider) {
      return NextResponse.json(
        { error: 'Paper ID and provider are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'xai', 'gemini']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch from Supabase database
    const supabase = getSupabaseClient()
    const { data, error: dbError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .select('*')
      .eq('paper_id', paperId)
      .eq('model_provider', provider)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (dbError) {
      if (dbError.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json(
          { error: 'Analysis not found' },
          { status: 404 }
        )
      }
      console.error('Database error fetching analysis result:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch analysis result from database', details: dbError.message },
        { status: 500 }
      )
    }
    
    // Transform database result to expected format
    const analysis: AIAnalysisResult = {
      id: data.id,
      paperId: data.paper_id,
      modelProvider: data.model_provider as 'openai' | 'anthropic' | 'xai' | 'gemini',
      modelName: data.model_name,
      summary: data.summary || '',
      keywords: data.keywords || [],
      scientificRelevance: data.scientific_relevance,
      confidenceScore: data.confidence_score || 0,
      tokensUsed: data.tokens_used || 0,
      processingTimeMs: data.processing_time_ms || 0,
      createdAt: new Date(data.created_at)
    }
    
    return NextResponse.json({
      analysis
    })
  } catch (error) {
    console.error('Failed to fetch analysis result:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { paperId: string; provider: string } }
) {
  try {
    const { paperId, provider } = params
    const body = await request.json()
    const { apiKey, modelName } = body
    
    if (!paperId || !provider) {
      return NextResponse.json(
        { error: 'Paper ID and provider are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'xai', 'gemini']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }
    
    if (!modelName) {
      return NextResponse.json(
        { error: 'Model name is required' },
        { status: 400 }
      )
    }

    // Verify paper exists
    const supabase = getSupabaseClient()
    const { data: paper, error: paperError } = await supabase
      .from(TABLES.PAPERS)
      .select('id, title')
      .eq('id', paperId)
      .single()
    
    if (paperError || !paper) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      )
    }
    
    // Create or update processing record for this specific provider
    const processingRecord = {
      paper_id: paperId,
      model_provider: provider,
      model_name: modelName,
      summary: null,
      keywords: [],
      scientific_relevance: { 
        status: 'processing', 
        started_at: new Date().toISOString(),
        provider_details: { api_key_provided: true }
      },
      confidence_score: null,
      tokens_used: null,
      processing_time_ms: null
    }
    
    const { data, error: insertError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .upsert(processingRecord, {
        onConflict: 'paper_id, model_provider',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Failed to create processing record:', insertError)
      return NextResponse.json(
        { error: 'Failed to start analysis processing', details: insertError.message },
        { status: 500 }
      )
    }
    
    // TODO: Trigger actual AI analysis with specific provider using background job
    // This would typically be done with a queue system like Bull, BullMQ, or similar
    
    return NextResponse.json({
      success: true,
      message: `Analysis started for paper "${paper.title}" with ${provider} (${modelName})`,
      paperId,
      provider,
      modelName,
      status: 'processing',
      processingId: data.id
    })
  } catch (error) {
    console.error('Failed to start analysis:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { paperId: string; provider: string } }
) {
  try {
    const { paperId, provider } = params
    
    if (!paperId || !provider) {
      return NextResponse.json(
        { error: 'Paper ID and provider are required' },
        { status: 400 }
      )
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'xai', 'gemini']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Delete specific provider analysis from Supabase database
    const supabase = getSupabaseClient()
    const { data, error: dbError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .delete()
      .eq('paper_id', paperId)
      .eq('model_provider', provider)
      .select('id')
    
    if (dbError) {
      console.error('Database error deleting analysis result:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete analysis result from database', details: dbError.message },
        { status: 500 }
      )
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${provider} analysis for paper ${paperId}`,
      paperId,
      provider,
      deletedId: data[0].id
    })
  } catch (error) {
    console.error('Failed to delete analysis result:', error)
    return NextResponse.json(
      { error: 'Failed to delete analysis result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}