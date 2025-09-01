import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// POST /api/backup/[backupId]/restore - 백업에서 복구
export async function POST(
  request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  try {
    const { backupId } = params

    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    // 복구 실행
    const result = await getBackupService().restoreFromBackup(backupId)

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Database restored successfully'
    })

  } catch (error) {
    console.error('Failed to restore backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      },
      { status: 500 }
    )
  }
}