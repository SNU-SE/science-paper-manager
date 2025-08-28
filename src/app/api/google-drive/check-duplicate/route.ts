import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year');
    const journal = searchParams.get('journal');
    
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required for duplicate check' },
        { status: 400 }
      );
    }

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