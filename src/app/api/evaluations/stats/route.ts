import { NextResponse } from 'next/server'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'

const service = new UserEvaluationService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const stats = await service.getEvaluationStats()
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error in GET /api/evaluations/stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation statistics' },
      { status: 500 }
    )
  }
}