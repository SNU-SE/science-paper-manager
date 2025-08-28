import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        emailConfirmed: user.email_confirmed_at !== null
      }
    })
  } catch (error) {
    console.error('Session check API error:', error)
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    )
  }
}