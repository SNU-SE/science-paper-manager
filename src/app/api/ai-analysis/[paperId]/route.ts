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

interface MultiModelAnalysis {
  openai?: AIAnalysisResult
  anthropic?: AIAnalysisResult
  xai?: AIAnalysisResult
  gemini?: AIAnalysisResult
}

// Mock analysis data for demonstration
const mockAnalyses: AIAnalysisResult[] = [
  {
    id: '1',
    paperId: '1',
    modelProvider: 'openai',
    modelName: 'gpt-4',
    summary: 'This comprehensive survey covers the latest developments in deep learning for NLP...',
    keywords: ['deep learning', 'natural language processing', 'transformers', 'survey'],
    confidenceScore: 0.95,
    tokensUsed: 1500,
    processingTimeMs: 2500,
    createdAt: new Date('2024-01-20')
  },
  {
    id: '2',
    paperId: '1',
    modelProvider: 'anthropic',
    modelName: 'claude-3-sonnet',
    summary: 'An excellent overview of deep learning techniques applied to NLP tasks...',
    keywords: ['deep learning', 'NLP', 'machine learning', 'neural networks'],
    confidenceScore: 0.92,
    tokensUsed: 1200,
    processingTimeMs: 1800,
    createdAt: new Date('2024-01-20')
  },
  {
    id: '3',
    paperId: '2',
    modelProvider: 'openai',
    modelName: 'gpt-4',
    summary: 'The paper presents novel improvements to transformer architecture...',
    keywords: ['transformer', 'architecture', 'attention mechanism', 'efficiency'],
    confidenceScore: 0.88,
    tokensUsed: 1100,
    processingTimeMs: 2100,
    createdAt: new Date('2024-02-05')
  }
]

export async function GET(
  request: NextRequest,
  { params }: { params: { paperId: string } }
) {
  try {
    const { paperId } = params
    
    if (!paperId) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    // Fetch analyses from Supabase database
    const supabase = getSupabaseClient()
    const { data, error: dbError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .select('*')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false })
    
    if (dbError) {
      console.error('Database error fetching analysis results:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch analysis results from database', details: dbError.message },
        { status: 500 }
      )
    }
    
    // Transform and group by model provider
    const multiModelAnalysis: MultiModelAnalysis = {}
    const paperAnalyses: AIAnalysisResult[] = []
    
    (data || []).forEach(row => {
      const analysis: AIAnalysisResult = {
        id: row.id,
        paperId: row.paper_id,
        modelProvider: row.model_provider as 'openai' | 'anthropic' | 'xai' | 'gemini',
        modelName: row.model_name,
        summary: row.summary || '',
        keywords: row.keywords || [],
        scientificRelevance: row.scientific_relevance,
        confidenceScore: row.confidence_score || 0,
        tokensUsed: row.tokens_used || 0,
        processingTimeMs: row.processing_time_ms || 0,
        createdAt: new Date(row.created_at)
      }
      
      paperAnalyses.push(analysis)
      multiModelAnalysis[analysis.modelProvider] = analysis
    })
    
    return NextResponse.json({
      paperId,
      analyses: multiModelAnalysis,
      totalAnalyses: paperAnalyses.length
    })
  } catch (error) {
    console.error('Failed to fetch analysis results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { paperId: string } }
) {
  try {
    const { paperId } = params
    const body = await request.json()
    const { modelProviders, apiKeys } = body

    if (!paperId) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    if (!modelProviders || !Array.isArray(modelProviders)) {
      return NextResponse.json(
        { error: 'Model providers array is required' },
        { status: 400 }
      )
    }

    if (!apiKeys || typeof apiKeys !== 'object') {
      return NextResponse.json(
        { error: 'API keys object is required' },
        { status: 400 }
      )
    }

    // Verify paper exists in database
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
    
    // TODO: Trigger actual AI analysis with background job or queue
    // For now, create placeholder analysis records to indicate processing status
    const processingRecords = modelProviders.map(provider => ({
      paper_id: paperId,
      model_provider: provider,
      model_name: 'processing',
      summary: null,
      keywords: [],
      scientific_relevance: { status: 'processing', started_at: new Date().toISOString() },
      confidence_score: null,
      tokens_used: null,
      processing_time_ms: null
    }))
    
    const { error: insertError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .upsert(processingRecords, {
        onConflict: 'paper_id, model_provider',
        ignoreDuplicates: false
      })
    
    if (insertError) {
      console.error('Failed to create processing records:', insertError)
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({
      success: true,
      message: `Analysis started for paper "${paper.title}" with models: ${modelProviders.join(', ')}`,
      paperId,
      modelProviders,
      status: 'processing'
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
  { params }: { params: { paperId: string } }
) {
  try {
    const { paperId } = params
    
    if (!paperId) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    // Delete from Supabase database
    const supabase = getSupabaseClient()
    const { data, error: dbError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .delete()
      .eq('paper_id', paperId)
      .select('id')
    
    if (dbError) {
      console.error('Database error deleting analysis results:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete analysis results from database', details: dbError.message },
        { status: 500 }
      )
    }
    
    const deletedCount = data?.length || 0
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} analysis results for paper ${paperId}`,
      deletedCount
    })
  } catch (error) {
    console.error('Failed to delete analysis results:', error)
    return NextResponse.json(
      { error: 'Failed to delete analysis results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}