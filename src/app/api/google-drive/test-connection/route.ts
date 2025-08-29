import { NextRequest, NextResponse } from 'next/server'
import { UserGoogleDriveServiceClient } from '@/services/google-drive/UserGoogleDriveService.client'
import { isGoogleDriveConfigured } from '@/lib/env-check'

export async function POST(request: NextRequest) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive is not configured on the server' 
        },
        { status: 503 }
      )
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const userGoogleDriveService = new UserGoogleDriveServiceClient()
    const isConnected = await userGoogleDriveService.testConnection(userId)

    return NextResponse.json({
      success: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    })
  } catch (error) {
    console.error('Google Drive connection test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    )
  }
}