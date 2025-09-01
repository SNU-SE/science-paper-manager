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

// GET /api/backup - 백업 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'full' | 'incremental' | 'differential' | null
    const status = searchParams.get('status')
    const limit = searchParams.get('limit')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const filter = {
      ...(type && { type }),
      ...(status && { status }),
      ...(limit && { limit: parseInt(limit) }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) })
    }

    const backups = await getBackupService().listBackups(filter)

    return NextResponse.json({
      success: true,
      data: backups,
      count: backups.length
    })

  } catch (error) {
    console.error('Failed to list backups:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list backups'
      },
      { status: 500 }
    )
  }
}

// POST /api/backup - 새 백업 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    if (!type || !['full', 'incremental', 'differential'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid backup type. Must be one of: full, incremental, differential'
        },
        { status: 400 }
      )
    }

    // 관리자 권한 확인 (실제 구현에서는 JWT 토큰 검증 필요)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    const result = await getBackupService().createBackup(type)

    return NextResponse.json({
      success: true,
      data: result,
      message: `${type} backup created successfully`
    })

  } catch (error) {
    console.error('Failed to create backup:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      },
      { status: 500 }
    )
  }
}