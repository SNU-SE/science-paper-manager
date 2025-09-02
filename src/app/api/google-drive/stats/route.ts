import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

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

    try {
      const files = await driveService.listFiles(
        process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
        'application/pdf'
      );

      const totalSize = files.reduce((sum, file) => {
        return sum + (parseInt(file.size || '0'));
      }, 0);

      // Count recent uploads (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const recentUploads = files.filter(file => 
        new Date(file.createdTime) > weekAgo
      ).length;

      // Format file size
      const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return NextResponse.json({
        totalFiles: files.length,
        totalSize: formatFileSize(totalSize),
        recentUploads
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      return NextResponse.json({
        totalFiles: 0,
        totalSize: '0 B',
        recentUploads: 0
      });
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
