import { NextRequest, NextResponse } from 'next/server'
import { getHealthService } from '@/services/health'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actionId = searchParams.get('actionId')

    const healthService = getHealthService()
    
    const recoveryData = {
      stats: healthService.getRecoveryStats(),
      history: healthService.getRecoveryHistory(actionId || undefined)
    }

    return NextResponse.json(recoveryData)
  } catch (error) {
    console.error('Recovery data retrieval failed:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve recovery data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}