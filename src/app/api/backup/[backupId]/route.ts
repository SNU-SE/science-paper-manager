import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// GET /api/backup/[backupId] - 특정 백업 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  try {
    const { backupId } = params

    const backups = await getBackupService().listBackups()
    const backup = backups.find(b => b.id === backupId)

    if (!backup) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: backup
    })

  } catch (error) {
    console.error('Failed to get backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get backup'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/backup/[backupId] - 백업 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  try {
    const { backupId } = params

    // 관리자 권한 확인 (실제 구현에서는 JWT 토큰 검증 필요)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    // 백업 기록 삭제 (실제 파일 삭제는 별도 처리)
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('backup_records')
      .delete()
      .eq('id', backupId)

    if (error) {
      throw new Error(`Failed to delete backup record: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup'
      },
      { status: 500 }
    )
  }
}