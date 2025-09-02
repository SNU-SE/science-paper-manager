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
    let oauthCreds: { clientId: string; clientSecret: string; redirectUri: string; refreshToken: string } | null = null

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

        oauthCreds = {
          clientId: settings.client_id,
          clientSecret: settings.client_secret,
          redirectUri: settings.redirect_uri,
          refreshToken: settings.refresh_token,
        }
        driveService = new GoogleDriveService(oauthCreds)
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

      oauthCreds = {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
      }
      driveService = new GoogleDriveService(oauthCreds)
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

      // Build OAuth client and get Authorization header
      try {
        const { google } = await import('googleapis')
        const oauth2 = new google.auth.OAuth2(
          oauthCreds!.clientId,
          oauthCreds!.clientSecret,
          oauthCreds!.redirectUri,
        )
        oauth2.setCredentials({ refresh_token: oauthCreds!.refreshToken })
        const reqHeaders = await oauth2.getRequestHeaders()
        const authorization = (reqHeaders['Authorization'] || reqHeaders['authorization']) as string | undefined
        if (!authorization) {
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
            'Authorization': authorization,
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
      } catch (e) {
        console.error('Resumable start error:', e)
        return NextResponse.json({ error: 'Failed to start resumable upload', details: String(e) }, { status: 500 })
      }
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

      try {
        const { google } = await import('googleapis')
        const oauth2 = new google.auth.OAuth2(
          oauthCreds!.clientId,
          oauthCreds!.clientSecret,
          oauthCreds!.redirectUri,
        )
        oauth2.setCredentials({ refresh_token: oauthCreds!.refreshToken })
        const reqHeaders2 = await oauth2.getRequestHeaders()
        const authorization2 = (reqHeaders2['Authorization'] || reqHeaders2['authorization']) as string | undefined

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            ...(authorization2 ? { 'Authorization': authorization2 } : {}),
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
      } catch (e) {
        console.error('Resumable chunk error:', e)
        return NextResponse.json({ error: 'Chunk upload failed', details: String(e) }, { status: 500 })
      }
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
