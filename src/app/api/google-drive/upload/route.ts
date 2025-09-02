import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';
import { UserGoogleDriveService } from '@/services/google-drive/UserGoogleDriveService'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const year = formData.get('year') as string;
    const journal = formData.get('journal') as string;
    const paperTitle = formData.get('paperTitle') as string;
    const userId = formData.get('userId') as string | null;
    const accessToken = formData.get('accessToken') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Prefer per-user Google Drive settings if provided
    let driveService: GoogleDriveService
    let rootFolderId: string | undefined = undefined

    if (userId) {
      try {
        let settings: any = null
        try {
          const userDrive = new UserGoogleDriveService()
          settings = await userDrive.getUserSettings(userId)
        } catch (e) {
          // Fallback to anon client with user's access token
          if (!accessToken || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return NextResponse.json({ error: 'Missing access token or Supabase config' }, { status: 500 })
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
          settings = data
        }
        if (!settings) {
          return NextResponse.json(
            { error: 'Google Drive not configured for this user' },
            { status: 400 }
          )
        }
        if (!settings.client_id || !settings.client_secret || !settings.redirect_uri || !settings.refresh_token) {
          return NextResponse.json(
            { error: 'User Google Drive credentials are incomplete' },
            { status: 400 }
          )
        }

        driveService = new GoogleDriveService({
          clientId: settings.client_id,
          clientSecret: settings.client_secret,
          redirectUri: settings.redirect_uri,
          refreshToken: settings.refresh_token || undefined,
        })
        rootFolderId = settings.root_folder_id || undefined
      } catch (err) {
        console.error('Failed to load user Google Drive settings:', err)
        return NextResponse.json(
          { error: 'Failed to load user Google Drive settings' },
          { status: 500 }
        )
      }
    } else {
      // Fallback to global env (legacy)
      if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET || 
          !process.env.GOOGLE_DRIVE_REDIRECT_URI || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
        return NextResponse.json(
          { error: 'Google Drive configuration is missing. Provide userId with configured Drive settings.' },
          { status: 500 }
        );
      }

      driveService = new GoogleDriveService({
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
      })
      rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to Google Drive
    const uploadResult = await driveService.uploadPDF(
      fileBuffer,
      file.name,
      year,
      journal,
      paperTitle,
      rootFolderId
    );

    return NextResponse.json(uploadResult);

  } catch (error) {
    console.error('Upload error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
