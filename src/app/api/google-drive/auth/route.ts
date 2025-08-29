import { NextRequest, NextResponse } from 'next/server';
import { isGoogleDriveConfigured, getEnvConfig } from '@/lib/env-check';

export async function GET(request: NextRequest) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { error: 'Google Drive is not configured. Please check environment variables.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const { google } = await import('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID!,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      process.env.GOOGLE_DRIVE_REDIRECT_URI!
    );

    switch (action) {
      case 'auth-url':
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.metadata.readonly'
          ],
          prompt: 'consent'
        });
        return NextResponse.json({ authUrl });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Auth API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Auth request failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { error: 'Google Drive is not configured. Please check environment variables.' },
        { status: 503 }
      );
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    const { google } = await import('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID!,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      process.env.GOOGLE_DRIVE_REDIRECT_URI!
    );

    const { tokens } = await oauth2Client.getToken(code);

    return NextResponse.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date
      }
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Token exchange failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}