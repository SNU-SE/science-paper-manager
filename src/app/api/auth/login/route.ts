import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'

interface LoginCredentials {
  email: string
  password: string
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

    const supabase = getSupabaseClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session
    })
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}