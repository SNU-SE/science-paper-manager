import { NextRequest, NextResponse } from 'next/server'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'
import { UserEvaluation } from '@/types'

function getService() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  
  return new UserEvaluationService(supabaseUrl, supabaseKey)
}

export async function GET(request: NextRequest) {
  try {
    // Check if we're in build mode or missing environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Return mock data during build or when environment variables are missing
      const mockEvaluations = [
        {
          id: '1',
          paperId: '1',
          rating: 5,
          notes: 'Excellent comprehensive survey',
          tags: ['survey', 'deep-learning', 'nlp'],
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: '2',
          paperId: '2',
          rating: 4,
          notes: 'Interesting improvements to transformer architecture',
          tags: ['transformer', 'architecture', 'llm'],
          createdAt: new Date('2024-02-05'),
          updatedAt: new Date('2024-02-05')
        }
      ]
      return NextResponse.json(mockEvaluations)
    }

    const service = getService()
    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paperId')
    const paperIds = searchParams.get('paperIds')

    if (paperId) {
      // Get single evaluation
      const evaluation = await service.getEvaluation(paperId)
      return NextResponse.json({ evaluation })
    } else if (paperIds) {
      // Get multiple evaluations
      const ids = paperIds.split(',').filter(id => id.trim())
      const evaluations = await service.getEvaluationsByPaperIds(ids)
      
      // Convert Map to object for JSON serialization
      const evaluationsObj = Object.fromEntries(evaluations)
      return NextResponse.json({ evaluations: evaluationsObj })
    } else {
      // Get all evaluations - return mock data for now
      const mockEvaluations = [
        {
          id: '1',
          paperId: '1',
          rating: 5,
          notes: 'Excellent comprehensive survey',
          tags: ['survey', 'deep-learning', 'nlp'],
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: '2',
          paperId: '2',
          rating: 4,
          notes: 'Interesting improvements to transformer architecture',
          tags: ['transformer', 'architecture', 'llm'],
          createdAt: new Date('2024-02-05'),
          updatedAt: new Date('2024-02-05')
        }
      ]
      return NextResponse.json(mockEvaluations)
    }
  } catch (error) {
    console.error('Error in GET /api/evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Database configuration is missing' },
        { status: 503 }
      )
    }

    const service = getService()
    const body = await request.json()
    const evaluation: Partial<UserEvaluation> = body.evaluation

    if (!evaluation.paperId) {
      return NextResponse.json(
        { error: 'paperId is required' },
        { status: 400 }
      )
    }

    const savedEvaluation = await service.saveEvaluation(evaluation)
    return NextResponse.json({ evaluation: savedEvaluation })
  } catch (error) {
    console.error('Error in POST /api/evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to save evaluation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Database configuration is missing' },
        { status: 503 }
      )
    }

    const service = getService()
    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paperId')

    if (!paperId) {
      return NextResponse.json(
        { error: 'paperId parameter is required' },
        { status: 400 }
      )
    }

    await service.deleteEvaluation(paperId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/evaluations:', error)
    return NextResponse.json(
      { error: 'Failed to delete evaluation' },
      { status: 500 }
    )
  }
}