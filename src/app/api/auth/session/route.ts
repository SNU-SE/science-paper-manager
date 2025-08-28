import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    // Decode session token (in production, verify JWT properly)
    try {
      const decoded = Buffer.from(sessionCookie.value, 'base64').toString()
      const [email, timestamp] = decoded.split(':')
      
      // Check if session is still valid (7 days)
      const sessionAge = Date.now() - parseInt(timestamp)
      const maxAge = 60 * 60 * 24 * 7 * 1000 // 7 days in milliseconds
      
      if (sessionAge > maxAge) {
        return NextResponse.json(
          { authenticated: false, error: 'Session expired' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          email: email,
          role: 'admin'
        }
      })
    } catch (decodeError) {
      return NextResponse.json(
        { authenticated: false, error: 'Invalid session' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Session check API error:', error)
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    )
  }
}