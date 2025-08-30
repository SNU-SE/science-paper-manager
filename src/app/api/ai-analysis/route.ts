import { NextRequest, NextResponse } from 'next/server'
import { AIAnalysisResult } from '@/types'
import { getSupabaseClient } from '@/lib/database'
import { TABLES } from '@/lib/database'

// This is a placeholder API route for AI analysis storage
// In a real implementation, this would integrate with Supabase

export async function POST(request: NextRequest) {
  try {
    const analysisResult: AIAnalysisResult = await request.json()
    
    // Validate required fields
    if (!analysisResult.paperId || !analysisResult.modelProvider || !analysisResult.modelName) {
      return NextResponse.json(
        { error: 'Missing required fields: paperId, modelProvider, or modelName' },
        { status: 400 }
      )
    }
    
    // Store in Supabase database
    const supabase = getSupabaseClient()
    const { data, error: dbError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .insert({
        paper_id: analysisResult.paperId,
        model_provider: analysisResult.modelProvider,
        model_name: analysisResult.modelName,
        summary: analysisResult.summary || null,
        keywords: analysisResult.keywords || [],
        scientific_relevance: analysisResult.scientificRelevance || null,
        confidence_score: analysisResult.confidenceScore || null,
        tokens_used: analysisResult.tokensUsed || null,
        processing_time_ms: analysisResult.processingTimeMs || null
      })
      .select()
      .single()
    
    if (dbError) {
      console.error('Database error storing analysis result:', dbError)
      return NextResponse.json(
        { error: 'Failed to store analysis result in database', details: dbError.message },
        { status: 500 }
      )
    }
    
    console.log('Successfully stored analysis result:', data.id)
    return NextResponse.json({ success: true, id: data.id, data })
    
  } catch (error) {
    console.error('Failed to store analysis result:', error)
    return NextResponse.json(
      { error: 'Failed to store analysis result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paperId')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const supabase = getSupabaseClient()
    
    if (paperId) {
      // Fetch from Supabase database for specific paper
      const { data, error: dbError } = await supabase
        .from(TABLES.AI_ANALYSES)
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (dbError) {
        console.error('Database error fetching analysis results:', dbError)
        return NextResponse.json(
          { error: 'Failed to fetch analysis results from database', details: dbError.message },
          { status: 500 }
        )
      }
      
      // Transform database results to match expected format
      const analyses: AIAnalysisResult[] = (data || []).map(row => ({
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
      }))
      
      console.log(`Fetched ${analyses.length} analysis results for paper:`, paperId)
      return NextResponse.json(analyses)
    } else {
      // Return all analyses from database
      const { data, error: dbError } = await supabase
        .from(TABLES.AI_ANALYSES)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (dbError) {
        console.error('Database error fetching all analysis results:', dbError)
        return NextResponse.json(
          { error: 'Failed to fetch analysis results from database', details: dbError.message },
          { status: 500 }
        )
      }
      
      // Transform database results to match expected format
      const analyses: AIAnalysisResult[] = (data || []).map(row => ({
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
      }))
      
      console.log(`Fetched ${analyses.length} total analysis results`)
      return NextResponse.json(analyses)
    }
  } catch (error) {
    console.error('Failed to fetch analysis results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}