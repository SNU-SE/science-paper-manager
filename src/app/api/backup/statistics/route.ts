import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// GET /api/backup/statistics - 백업 통계 조회
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const statistics = await getBackupService().getBackupStatistics()

    return NextResponse.json({
      success: true,
      data: statistics
    })

  } catch (error) {
    console.error('Failed to get backup statistics:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get backup statistics'
      },
      { status: 500 }
    )
  }
}