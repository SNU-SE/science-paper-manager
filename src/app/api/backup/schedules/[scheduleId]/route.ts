import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'
import { createClient } from '@supabase/supabase-js'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// GET /api/backup/schedules/[scheduleId] - 특정 스케줄 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const { scheduleId } = params

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: schedule, error } = await supabase
      .from('backup_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (error || !schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: schedule
    })

  } catch (error) {
    console.error('Failed to get backup schedule:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get backup schedule'
      },
      { status: 500 }
    )
  }
}

// PUT /api/backup/schedules/[scheduleId] - 스케줄 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const { scheduleId } = params
    const body = await request.json()
    const { name, type, cronExpression, isActive, retentionDays } = body

    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 기존 스케줄 조회
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('backup_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (fetchError || !existingSchedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // 스케줄 업데이트
    const updatedSchedule = {
      id: scheduleId,
      name: name || existingSchedule.name,
      type: type || existingSchedule.type,
      cronExpression: cronExpression || existingSchedule.cron_expression,
      isActive: isActive !== undefined ? isActive : existingSchedule.is_active,
      retentionDays: retentionDays || existingSchedule.retention_days
    }

    await getBackupService().scheduleBackup(updatedSchedule)

    return NextResponse.json({
      success: true,
      data: updatedSchedule,
      message: 'Backup schedule updated successfully'
    })

  } catch (error) {
    console.error('Failed to update backup schedule:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update backup schedule'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/backup/schedules/[scheduleId] - 스케줄 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const { scheduleId } = params

    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('backup_schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) {
      throw new Error(`Failed to delete schedule: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Backup schedule deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete backup schedule:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup schedule'
      },
      { status: 500 }
    )
  }
}