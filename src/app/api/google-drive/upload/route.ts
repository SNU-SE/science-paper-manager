import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';
import { UserGoogleDriveService } from '@/services/google-drive/UserGoogleDriveService'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = (formData.get('action') as string | null) || 'direct';
    const file = formData.get('file') as File | null;
    const year = formData.get('year') as string | null;
    const journal = formData.get('journal') as string | null;
    const paperTitle = formData.get('paperTitle') as string | null;
    const userId = formData.get('userId') as string | null;
    const accessToken = formData.get('accessToken') as string | null;

    // For direct upload, file is required
    if (action === 'direct' && !file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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

    // Handle resumable upload actions to bypass Vercel body size limits
    if (action === 'start') {
      const fileName = (formData.get('fileName') as string) || 'upload.pdf'
      const totalSize = parseInt((formData.get('totalSize') as string) || '0', 10)

      // Create folder structure first
      const folderId = await driveService.createFolderStructure(
        year || new Date().getFullYear().toString(),
        journal || 'Unknown Journal',
        paperTitle || fileName.replace(/\.pdf$/i, '') || 'Untitled',
        rootFolderId
      )

      // Get OAuth access token
      // Using google auth client via driveService's internal auth is not directly exposed; recreate here
      const { google } = await import('googleapis')
      const oauth2 = new google.auth.OAuth2()
      // Reuse credentials from service
      // Note: We cannot read refresh token back from driveService; recreate from settings above
      // We already know settings were valid; use the same path as creation above to build oauth client
      // For simplicity, regenerate using same settings branch
      let token: string | null = null
      try {
        // This path will only work when using env fallback; for per-user we need to mint via request headers
        // Safer approach: getRequestHeaders via driveService internal auth not available; instead, call google.auth.
        // We'll build oauth client same as in service creation above.
        // Recreate oauth with same credentials
        // We already have a working driveService; use google drive client to getHeaders
        // @ts-ignore accessing private
        const auth: any = (driveService as any).auth || (driveService as any).drive?.options?.auth
        if (auth && typeof auth.getAccessToken === 'function') {
          const t = await auth.getAccessToken()
          token = typeof t === 'string' ? t : t?.token || null
        }
      } catch {}

      if (!token) {
        return NextResponse.json({ error: 'Failed to acquire access token' }, { status: 500 })
      }

      // Initiate resumable session
      const meta = {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/pdf'
      }

      const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/pdf',
          ...(totalSize ? { 'X-Upload-Content-Length': String(totalSize) } : {})
        },
        body: JSON.stringify(meta)
      })

      if (!initRes.ok) {
        const text = await initRes.text()
        return NextResponse.json({ error: 'Failed to start resumable upload', details: text }, { status: 500 })
      }

      const uploadUrl = initRes.headers.get('location')
      if (!uploadUrl) {
        return NextResponse.json({ error: 'Missing upload URL' }, { status: 500 })
      }

      return NextResponse.json({ uploadUrl, folderPath: `${year}/${journal}/${paperTitle}` })
    }

    if (action === 'chunk') {
      const uploadUrl = formData.get('uploadUrl') as string
      const chunk = formData.get('chunk') as File
      const chunkStart = parseInt((formData.get('chunkStart') as string) || '0', 10)
      const chunkEnd = parseInt((formData.get('chunkEnd') as string) || '0', 10)
      const totalSize = parseInt((formData.get('totalSize') as string) || '0', 10)

      if (!uploadUrl || !chunk) {
        return NextResponse.json({ error: 'Missing uploadUrl or chunk' }, { status: 400 })
      }

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.size),
          'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalSize}`,
          'Content-Type': 'application/pdf'
        },
        body: Buffer.from(await chunk.arrayBuffer())
      })

      if (putRes.status === 308) {
        const range = putRes.headers.get('range')
        return NextResponse.json({ status: 'resumable', range })
      }
      if (!putRes.ok) {
        const text = await putRes.text()
        return NextResponse.json({ error: 'Chunk upload failed', details: text }, { status: 500 })
      }
      const data = await putRes.json()
      return NextResponse.json({
        fileId: data.id,
        fileName: data.name,
        webViewLink: data.webViewLink,
        webContentLink: data.webContentLink,
        folderPath: `${year}/${journal}/${paperTitle}`
      })
    }

    // Default: direct small-file upload (may hit platform limits)
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await driveService.uploadPDF(
      fileBuffer,
      file.name,
      year!,
      journal!,
      paperTitle!,
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
