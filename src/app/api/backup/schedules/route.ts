import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BackupService } from '@/services/backup/BackupService'
import * as crypto from 'crypto'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// GET /api/backup/schedules - 백업 스케줄 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
        const { data: schedules, error } = await supabase
      .from('backup_schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch schedules: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: schedules
    })

  } catch (error) {
    console.error('Failed to list backup schedules:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list backup schedules'
      },
      { status: 500 }
    )
  }
}

// POST /api/backup/schedules - 새 백업 스케줄 생성
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { name, type, cronExpression, isActive = true, retentionDays = 30 } = body

    // 입력 검증
    if (!name || !type || !cronExpression) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, cronExpression'
        },
        { status: 400 }
      )
    }

    if (!['full', 'incremental', 'differential'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid backup type. Must be one of: full, incremental, differential'
        },
        { status: 400 }
      )
    }

    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const scheduleId = crypto.randomUUID()
    const schedule = {
      id: scheduleId,
      name,
      type,
      cronExpression,
      isActive,
      retentionDays
    }

    await getBackupService().scheduleBackup(schedule)

    return NextResponse.json({
      success: true,
      data: schedule,
      message: 'Backup schedule created successfully'
    })

  } catch (error) {
    console.error('Failed to create backup schedule:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup schedule'
      },
      { status: 500 }
    )
  }
}