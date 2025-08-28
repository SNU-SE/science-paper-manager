import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const year = formData.get('year') as string;
    const journal = formData.get('journal') as string;
    const paperTitle = formData.get('paperTitle') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
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

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to Google Drive
    const uploadResult = await driveService.uploadPDF(
      fileBuffer,
      file.name,
      year,
      journal,
      paperTitle,
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
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

