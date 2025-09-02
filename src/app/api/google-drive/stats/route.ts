import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Validate required environment variables
    if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET || 
        !process.env.GOOGLE_DRIVE_REDIRECT_URI || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Google Drive configuration is incomplete' },
        { status: 500 }
      );
    }

    const driveService = new GoogleDriveService({
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    });

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
