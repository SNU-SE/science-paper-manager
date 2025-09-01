import { NextRequest, NextResponse } from 'next/server'
import { securityService } from '@/services/security/SecurityService'
import { securityMiddleware, sessionValidationMiddleware } from '@/middleware/securityMiddleware'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Store encrypted API key
 * POST /api/security/api-keys
 */
export async function POST(request: NextRequest) {
  // Apply security middleware
  const middleware = securityMiddleware({ 
    requireCSRF: true, 
    logAccess: true, 
    checkSuspiciousActivity: true 
  })
  
  return middleware(request, {}, async () => {
    try {
      const { provider, apiKey } = await request.json()
      
      if (!provider || !apiKey) {
        return NextResponse.json(
          { error: 'Provider and API key are required' },
          { status: 400 }
        )
      }

      // Get user ID from session
      const sessionToken = request.cookies.get('session-token')?.value
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }

      const userId = validation.userId

      // Encrypt the API key
      const encryptedData = await securityService.encryptAPIKey(apiKey, userId)

      // Store in database
      const { error } = await supabase
        .from('user_encrypted_api_keys')
        .upsert({
          user_id: userId,
          provider,
          encrypted_value: encryptedData.encryptedValue,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
          hash: encryptedData.hash,
          auth_tag: encryptedData.authTag,
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      // Log the API key storage
      await securityService.logSecurityEvent(userId, 'api_key_stored', 'low', {
        provider,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        message: 'API key stored securely'
      })
    } catch (error) {
      console.error('API key storage failed:', error)
      return NextResponse.json(
        { error: 'Failed to store API key' },
        { status: 500 }
      )
    }
  })
}

/**
 * Get encrypted API key (for internal use)
 * GET /api/security/api-keys?provider=openai
 */
export async function GET(request: NextRequest) {
  // Apply security middleware
  const middleware = securityMiddleware({ 
    logAccess: true, 
    checkSuspiciousActivity: true 
  })
  
  return middleware(request, {}, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const provider = searchParams.get('provider')

      if (!provider) {
        return NextResponse.json(
          { error: 'Provider parameter is required' },
          { status: 400 }
        )
      }

      // Get user ID from session
      const sessionToken = request.cookies.get('session-token')?.value
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }

      const userId = validation.userId

      // Get encrypted API key from database
      const { data: keyData, error } = await supabase
        .from('user_encrypted_api_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single()

      if (error || !keyData) {
        return NextResponse.json(
          { error: 'API key not found' },
          { status: 404 }
        )
      }

      // Decrypt the API key
      const encryptedData = {
        encryptedValue: keyData.encrypted_value,
        iv: keyData.iv,
        salt: keyData.salt,
        hash: keyData.hash,
        authTag: keyData.auth_tag
      }

      const decryptedKey = await securityService.decryptAPIKey(encryptedData, userId)

      // Update last used timestamp
      await supabase
        .from('user_encrypted_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', provider)

      // Log API key access
      await securityService.logSecurityEvent(userId, 'api_key_accessed', 'low', {
        provider,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        apiKey: decryptedKey,
        provider,
        lastUsed: keyData.last_used_at
      })
    } catch (error) {
      console.error('API key retrieval failed:', error)
      return NextResponse.json(
        { error: 'Failed to retrieve API key' },
        { status: 500 }
      )
    }
  })
}

/**
 * Delete API key
 * DELETE /api/security/api-keys?provider=openai
 */
export async function DELETE(request: NextRequest) {
  // Apply security middleware
  const middleware = securityMiddleware({ 
    requireCSRF: true, 
    logAccess: true, 
    checkSuspiciousActivity: true 
  })
  
  return middleware(request, {}, async () => {
    try {
      const { searchParams } = new URL(request.url)
      const provider = searchParams.get('provider')

      if (!provider) {
        return NextResponse.json(
          { error: 'Provider parameter is required' },
          { status: 400 }
        )
      }

      // Get user ID from session
      const sessionToken = request.cookies.get('session-token')?.value
      if (!sessionToken) {
        return NextResponse.json(
          { error: 'Session required' },
          { status: 401 }
        )
      }

      const fingerprint = securityService.generateSessionFingerprint(request)
      const validation = await securityService.validateSession(sessionToken, fingerprint)

      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      }

      const userId = validation.userId

      // Delete the API key
      const { error } = await supabase
        .from('user_encrypted_api_keys')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider)

      if (error) {
        throw error
      }

      // Log API key deletion
      await securityService.logSecurityEvent(userId, 'api_key_deleted', 'medium', {
        provider,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        message: 'API key deleted successfully'
      })
    } catch (error) {
      console.error('API key deletion failed:', error)
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      )
    }
  })
}

/**
 * List user's API key providers (without exposing keys)
 * GET /api/security/api-keys/list
 */
export async function list(request: NextRequest) {
  try {
    // Get user ID from session
    const sessionToken = request.cookies.get('session-token')?.value
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session required' },
        { status: 401 }
      )
    }

    const fingerprint = securityService.generateSessionFingerprint(request)
    const validation = await securityService.validateSession(sessionToken, fingerprint)

    if (!validation.isValid || !validation.userId) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const userId = validation.userId

    // Get list of providers (without sensitive data)
    const { data: keys, error } = await supabase
      .from('user_encrypted_api_keys')
      .select('provider, created_at, updated_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      apiKeys: keys || []
    })
  } catch (error) {
    console.error('API key list retrieval failed:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve API key list' },
      { status: 500 }
    )
  }
}