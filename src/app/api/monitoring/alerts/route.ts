import { NextRequest, NextResponse } from 'next/server'
import { checkPerformanceThresholds } from '@/middleware/performanceMiddleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/monitoring/alerts - 성능 알림 조회
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    // 인증 및 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = user.email?.endsWith('@admin.com') || false
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 현재 성능 임계값 확인
    const thresholdCheck = await checkPerformanceThresholds()

    // 알림 히스토리 조회 (실제로는 별도 테이블에서 조회)
    const alertHistory = await getAlertHistory()

    return NextResponse.json({
      currentAlerts: thresholdCheck.alerts,
      alertHistory,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Alerts API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitoring/alerts - 알림 상태 업데이트
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    // 인증 및 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = user.email?.endsWith('@admin.com') || false
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, alertId, data } = body

    switch (action) {
      case 'acknowledge':
        // 알림 확인 처리
        await acknowledgeAlert(alertId, user.id)
        return NextResponse.json({ success: true })

      case 'dismiss':
        // 알림 해제 처리
        await dismissAlert(alertId, user.id)
        return NextResponse.json({ success: true })

      case 'create_custom':
        // 사용자 정의 알림 생성
        const customAlert = await createCustomAlert(data, user.id)
        return NextResponse.json({ success: true, alert: customAlert })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Alerts POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions

async function getAlertHistory() {
  // 실제로는 alerts 테이블에서 조회
  // 여기서는 모의 데이터 반환
  return [
    {
      id: '1',
      type: 'slow_api_response',
      message: 'API response time exceeded threshold',
      value: 1500,
      threshold: 1000,
      status: 'resolved',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      type: 'high_error_rate',
      message: 'Error rate is above acceptable level',
      value: 8,
      threshold: 5,
      status: 'active',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ]
}

async function acknowledgeAlert(alertId: string, userId: string) {
  // 실제로는 데이터베이스에 알림 확인 상태 업데이트
  console.log(`Alert ${alertId} acknowledged by user ${userId}`)
}

async function dismissAlert(alertId: string, userId: string) {
  // 실제로는 데이터베이스에 알림 해제 상태 업데이트
  console.log(`Alert ${alertId} dismissed by user ${userId}`)
}

async function createCustomAlert(alertData: any, userId: string) {
  // 실제로는 데이터베이스에 사용자 정의 알림 생성
  const customAlert = {
    id: Date.now().toString(),
    type: 'custom',
    message: alertData.message,
    threshold: alertData.threshold,
    createdBy: userId,
    createdAt: new Date().toISOString()
  }
  
  console.log('Custom alert created:', customAlert)
  return customAlert
}