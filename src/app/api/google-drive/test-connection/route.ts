import { NextRequest, NextResponse } from 'next/server'
import { UserGoogleDriveService } from '@/services/google-drive/UserGoogleDriveService'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId, accessToken } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    let userSettings: any = null
    // Try admin client first (requires SUPABASE_SERVICE_ROLE_KEY)
    try {
      const userGoogleDriveService = new UserGoogleDriveService()
      userSettings = await userGoogleDriveService.getUserSettings(userId)
    } catch (e) {
      // Fallback: use anon client with user's access token if provided
      if (!accessToken || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration missing or no access token provided')
      }
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data, error } = await supabase
        .from('user_google_drive_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
      if (error && (error as any).code !== 'PGRST116') {
        throw error
      }
      userSettings = data
    }
    
    if (!userSettings) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive not configured for this user',
          requiresSetup: true
        },
        { status: 200 }
      )
    }

    // Check if user has client credentials
    if (!userSettings.client_id || !userSettings.client_secret) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive credentials not configured',
          requiresSetup: true
        },
        { status: 200 }
      )
    }

    // Check if user has refresh token
    if (!userSettings.refresh_token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Drive not authorized. Please complete OAuth flow.',
          requiresAuth: true
        },
        { status: 200 }
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
        details: oauthError instanceof Error ? oauthError.message : 'Unknown error',
        requiresAuth: true
      }, { status: 200 })
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
