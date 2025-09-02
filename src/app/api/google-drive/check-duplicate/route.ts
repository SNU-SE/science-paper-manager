import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year');
    const journal = searchParams.get('journal');
    const userId = searchParams.get('userId');
    
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required for duplicate check' },
        { status: 400 }
      );
    }

    let driveService: GoogleDriveService
    if (userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnon) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
      }
      const authHeader = request.headers.get('authorization') || ''
      const supabase = createClient(supabaseUrl, supabaseAnon, {
        global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
        auth: { persistSession: false, autoRefreshToken: false }
      })
      const { data, error } = await supabase
        .from('user_google_drive_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
      if (error && (error as any).code !== 'PGRST116') {
        return NextResponse.json({ error: 'Failed to load Drive settings' }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: 'Drive not configured for user' }, { status: 400 })
      }
      driveService = new GoogleDriveService({
        clientId: data.client_id,
        clientSecret: data.client_secret,
        redirectUri: data.redirect_uri,
        refreshToken: data.refresh_token,
      })
    } else {
      if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET || 
          !process.env.GOOGLE_DRIVE_REDIRECT_URI || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
        return NextResponse.json({ error: 'Google Drive configuration is incomplete' }, { status: 500 });
      }
      driveService = new GoogleDriveService({
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
      })
    }

    // Generate folder path
    const folderYear = year || new Date().getFullYear().toString();
    const folderJournal = journal || 'Unknown Journal';
    const paperTitle = title
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    try {
      // Try to find the folder structure
      const folderId = await driveService.createFolderStructure(
        folderYear,
        folderJournal,
        paperTitle,
        process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
      );

      // List PDF files in the folder
      const files = await driveService.listFiles(folderId, 'application/pdf');
      
      return NextResponse.json({ exists: files.length > 0 });
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return NextResponse.json({ exists: false });
    }

  } catch (error) {
    console.error('API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'API request failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
