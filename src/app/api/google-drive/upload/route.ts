import { NextRequest, NextResponse } from 'next/server';
import { PaperUploadService } from '@/services/upload/PaperUploadService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const authors = JSON.parse(formData.get('authors') as string || '[]');
    const journal = formData.get('journal') as string;
    const publicationYear = parseInt(formData.get('publicationYear') as string);
    const doi = formData.get('doi') as string;
    const abstract = formData.get('abstract') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Get Google Drive configuration from environment variables
    const config = {
      googleDrive: {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
        rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
      }
    };

    // Validate required environment variables
    if (!config.googleDrive.clientId || !config.googleDrive.clientSecret || 
        !config.googleDrive.redirectUri || !config.googleDrive.refreshToken) {
      return NextResponse.json(
        { error: 'Google Drive configuration is incomplete' },
        { status: 500 }
      );
    }

    const uploadService = new PaperUploadService(config);

    const paperData = {
      file,
      title,
      authors,
      journal: journal || undefined,
      publicationYear: publicationYear || undefined,
      doi: doi || undefined,
      abstract: abstract || undefined
    };

    const result = await uploadService.uploadPaper(paperData);

    return NextResponse.json({
      success: true,
      paper: result.paper,
      uploadResult: result.uploadResult
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const config = {
      googleDrive: {
        clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
        refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
        rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
      }
    };

    const uploadService = new PaperUploadService(config);

    switch (action) {
      case 'stats':
        const stats = await uploadService.getUploadStats();
        return NextResponse.json(stats);

      case 'check-duplicate':
        const title = searchParams.get('title');
        const year = searchParams.get('year');
        const journal = searchParams.get('journal');
        
        if (!title) {
          return NextResponse.json(
            { error: 'Title is required for duplicate check' },
            { status: 400 }
          );
        }

        const isDuplicate = await uploadService.checkDuplicatePaper(
          title,
          year ? parseInt(year) : undefined,
          journal || undefined
        );

        return NextResponse.json({ isDuplicate });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
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