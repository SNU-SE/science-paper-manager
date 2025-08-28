import { NextRequest, NextResponse } from 'next/server'

interface LoginCredentials {
  email: string
  password: string
}

// Simple hardcoded authentication as per requirements
const ADMIN_CREDENTIALS = {
  email: 'admin@email.com',
  password: '1234567890'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password }: LoginCredentials = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check credentials
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      // Create a simple session token (in production, use proper JWT)
      const sessionToken = Buffer.from(`${email}:${Date.now()}`).toString('base64')
      
      const response = NextResponse.json({
        success: true,
        user: {
          email: email,
          role: 'admin'
        },
        token: sessionToken
      })

      // Set session cookie
      response.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      return response
    } else {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}