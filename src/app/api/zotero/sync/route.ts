import { NextRequest, NextResponse } from 'next/server'
import { zoteroSyncService } from '@/services/zotero/ZoteroSyncService'

export async function POST(request: NextRequest) {
  try {
    const { type = 'incremental' } = await request.json()

    let result
    if (type === 'full') {
      result = await zoteroSyncService.performFullSync()
    } else {
      result = await zoteroSyncService.performIncrementalSync()
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Zotero sync error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const status = zoteroSyncService.getSyncStatus()
    
    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Error getting sync status:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}