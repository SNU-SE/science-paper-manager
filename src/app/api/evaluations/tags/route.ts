import { NextResponse } from 'next/server'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'

function getService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  
  return new UserEvaluationService(supabaseUrl, supabaseKey)
}

export async function GET() {
  try {
    // Check if we're in build mode or missing environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Return mock tags during build or when environment variables are missing
      const mockTags = [
        'deep-learning',
        'nlp',
        'transformer',
        'survey',
        'llm',
        'architecture',
        'attention',
        'bert',
        'gpt',
        'computer-vision',
        'reinforcement-learning',
        'neural-networks',
        'machine-learning',
        'ai-ethics',
        'explainable-ai'
      ]
      return NextResponse.json({ tags: mockTags })
    }

    const service = getService()
    const tags = await service.getAllTags()
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error in GET /api/evaluations/tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}