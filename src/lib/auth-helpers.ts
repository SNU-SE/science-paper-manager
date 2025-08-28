import { getSupabaseAdminClient } from './database'
import { NextRequest } from 'next/server'

export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  try {
    const supabase = getSupabaseAdminClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export function createAuthResponse(message: string, status: number = 401) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}