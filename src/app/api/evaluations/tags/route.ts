import { NextResponse } from 'next/server'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'

const service = new UserEvaluationService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
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