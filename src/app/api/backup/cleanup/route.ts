import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// POST /api/backup/cleanup - 오래된 백업 정리
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const deletedCount = await getBackupService().cleanupOldBackups()

    return NextResponse.json({
      success: true,
      data: { deletedCount },
      message: `Cleaned up ${deletedCount} old backup records`
    })

  } catch (error) {
    console.error('Failed to cleanup old backups:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup old backups'
      },
      { status: 500 }
    )
  }
}