import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

let backupService: BackupService | null = null

function getBackupService() {
  if (!backupService) {
    backupService = new BackupService()
  }
  return backupService
}

// POST /api/backup/[backupId]/validate - 백업 파일 유효성 검증
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

    const validation = await getBackupService().validateBackup(backupId)

    return NextResponse.json({
      success: true,
      data: validation,
      message: validation.isValid ? 'Backup is valid' : 'Backup validation failed'
    })

  } catch (error) {
    console.error('Failed to validate backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate backup'
      },
      { status: 500 }
    )
  }
}