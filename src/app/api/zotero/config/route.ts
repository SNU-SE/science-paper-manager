import { NextRequest, NextResponse } from 'next/server'
import { zoteroService } from '@/services/zotero/ZoteroService'

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()
    
    // Validate required fields
    if (!config.userId || !config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'User ID and API key are required'
      }, { status: 400 })
    }

    // Configure the service
    zoteroService.configure({
      userId: config.userId,
      apiKey: config.apiKey,
      libraryType: config.libraryType || 'user',
      libraryId: config.libraryId
    })

    // Validate credentials
    const isValid = await zoteroService.validateCredentials()
    
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Zotero credentials'
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: 'Zotero configured successfully'
    })

  } catch (error) {
    console.error('Zotero config error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const config = zoteroService.getConfig()
    const isConfigured = zoteroService.isConfigured()
    
    // Don't return the API key for security
    const safeConfig = config ? {
      userId: config.userId,
      libraryType: config.libraryType,
      libraryId: config.libraryId,
      hasApiKey: !!config.apiKey
    } : null

    return NextResponse.json({
      success: true,
      data: {
        isConfigured,
        config: safeConfig
      }
    })

  } catch (error) {
    console.error('Error getting Zotero config:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    // Clear configuration
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zotero-config')
      localStorage.removeItem('zotero-sync-status')
    }

    return NextResponse.json({
      success: true,
      message: 'Zotero configuration cleared'
    })

  } catch (error) {
    console.error('Error clearing Zotero config:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}