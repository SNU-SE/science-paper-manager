import { NextRequest, NextResponse } from 'next/server'
import { UserGoogleDriveServiceClient } from '@/services/google-drive/UserGoogleDriveService.client'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const userGoogleDriveService = new UserGoogleDriveServiceClient()
    
    // Get user's Google Drive settings from database
    const userSettings = await userGoogleDriveService.getUserSettings(userId)
    
    if (!userSettings) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive not configured for this user' 
        },
        { status: 404 }
      )
    }

    // Check if user has client credentials
    if (!userSettings.client_id || !userSettings.client_secret) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive credentials not configured' 
        },
        { status: 400 }
      )
    }

    // Check if user has refresh token
    if (!userSettings.refresh_token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive not authorized. Please complete OAuth flow.' 
        },
        { status: 401 }
      )
    }

    try {
      // Create OAuth2 client with user's credentials
      const oauth2Client = new google.auth.OAuth2(
        userSettings.client_id,
        userSettings.client_secret,
        userSettings.redirect_uri
      )

      // Set the refresh token
      oauth2Client.setCredentials({
        refresh_token: userSettings.refresh_token
      })

      // Try to get an access token to verify the connection
      await oauth2Client.refreshAccessToken()
      
      // Test the connection by listing files (limited to 1 to be fast)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.files.list({
        pageSize: 1,
        fields: 'files(id)'
      })

      return NextResponse.json({
        success: true,
        message: 'Connection successful'
      })
    } catch (oauthError) {
      console.error('OAuth error during connection test:', oauthError)
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to Google Drive. Please re-authorize.',
        details: oauthError instanceof Error ? oauthError.message : 'Unknown error'
      }, { status: 401 })
    }
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