import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/services/monitoring/PerformanceMonitor'
import { checkPerformanceThresholds } from '@/middleware/performanceMiddleware'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/monitoring - 성능 메트릭 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
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

    // 관리자 권한 확인 (실제 구현에서는 사용자 역할 확인)
    // 여기서는 간단히 특정 사용자 ID로 확인
    const isAdmin = user.email?.endsWith('@admin.com') || false

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '1h'
    const type = url.searchParams.get('type') || 'all'

    // 시간 범위 계산
    const now = new Date()
    let start: Date

    switch (timeRange) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        start = new Date(now.getTime() - 60 * 60 * 1000)
    }

    // 메트릭 타입에 따른 데이터 조회
    if (type === 'dashboard') {
      const dashboardData = await performanceMonitor.getDashboardData()
      return NextResponse.json(dashboardData)
    }

    const metrics = await performanceMonitor.getMetrics({ start, end: now })
    
    // 성능 임계값 확인
    const thresholdCheck = await checkPerformanceThresholds()

    return NextResponse.json({
      metrics,
      alerts: thresholdCheck.alerts,
      timeRange: {
        start: start.toISOString(),
        end: now.toISOString()
      },
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Monitoring API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitoring - 수동 메트릭 기록
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
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

    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'user_activity':
        await performanceMonitor.trackUserActivity(
          user.id,
          data.action,
          data.feature,
          data.metadata,
          data.sessionId
        )
        break

      case 'system_metric':
        await performanceMonitor.trackSystemMetric(
          data.metricType,
          data.metricName,
          data.value,
          data.unit,
          data.metadata
        )
        break

      case 'custom_event':
        await performanceMonitor.trackUserActivity(
          user.id,
          'custom_event',
          data.eventName,
          data.eventData
        )
        break

      default:
        return NextResponse.json(
          { error: 'Invalid metric type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Monitoring POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}