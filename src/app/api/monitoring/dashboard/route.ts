import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/services/monitoring/PerformanceMonitor'
import { collectSystemMetrics, checkPerformanceThresholds } from '@/middleware/performanceMiddleware'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/monitoring/dashboard - 실시간 성능 대시보드 데이터
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

    // 관리자 권한 확인
    const isAdmin = user.email?.endsWith('@admin.com') || false
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 현재 시스템 메트릭 수집
    await collectSystemMetrics()

    // 대시보드 데이터 조회
    const dashboardData = await performanceMonitor.getDashboardData()
    
    // 성능 임계값 확인
    const thresholdCheck = await checkPerformanceThresholds()

    // 추가 실시간 정보
    const now = new Date()
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      pid: process.pid
    }

    return NextResponse.json({
      ...dashboardData,
      alerts: thresholdCheck.alerts,
      systemInfo,
      lastUpdated: now.toISOString()
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitoring/dashboard - 대시보드 설정 업데이트
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
    const { action, settings } = body

    switch (action) {
      case 'update_refresh_interval':
        // 대시보드 새로고침 간격 설정 (실제로는 클라이언트에서 처리)
        return NextResponse.json({ 
          success: true, 
          refreshInterval: settings.refreshInterval 
        })

      case 'toggle_alerts':
        // 알림 활성화/비활성화 설정
        return NextResponse.json({ 
          success: true, 
          alertsEnabled: settings.alertsEnabled 
        })

      case 'update_thresholds':
        // 성능 임계값 업데이트 (실제로는 환경 변수나 데이터베이스에 저장)
        return NextResponse.json({ 
          success: true, 
          thresholds: settings.thresholds 
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Dashboard POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}