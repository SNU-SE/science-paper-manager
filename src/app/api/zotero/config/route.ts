import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import CryptoJS from 'crypto-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userIdZotero, apiKey, libraryType = 'user', libraryId, autoSync = false, syncInterval = 3600 } = body

    if (!userIdZotero || !apiKey) {
      return NextResponse.json({ success: false, error: 'userIdZotero and apiKey are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false }
    })

    // Validate with Zotero API
    const baseUrl = libraryType === 'group' && libraryId
      ? `https://api.zotero.org/groups/${libraryId}`
      : `https://api.zotero.org/users/${userIdZotero}`
    const testRes = await fetch(`${baseUrl}/items?limit=1`, {
      headers: { 'Zotero-API-Key': apiKey, 'Content-Type': 'application/json' }
    })
    if (!testRes.ok) {
      const status = testRes.status
      const map: Record<number, string> = {
        403: 'Invalid API key or insufficient permissions',
        404: 'User ID or Library ID not found',
        429: 'Rate limit exceeded. Please wait before trying again.'
      }
      return NextResponse.json({ success: false, error: map[status] || `API validation failed (${status})` }, { status: 400 })
    }

    // Encrypt and save settings
    const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'fallback-key-for-development'
    const api_key_encrypted = CryptoJS.AES.encrypt(apiKey, encryptionKey).toString()

    // Deactivate previous active
    await supabase
      .from('user_zotero_settings')
      .update({ is_active: false })
      .eq('is_active', true)

    // Insert new settings
    const insert = {
      user_id: undefined, // Filled by RLS auth.uid()
      user_id_zotero: String(userIdZotero),
      api_key_encrypted,
      library_type: libraryType,
      library_id: libraryId || null,
      auto_sync: !!autoSync,
      sync_interval: Number(syncInterval) || 3600,
      is_active: true
    }

    const { data, error } = await supabase
      .from('user_zotero_settings')
      .insert(insert as any)
      .select()
      .single()
    if (error) {
      console.error('Save Zotero settings error:', error)
      return NextResponse.json({ success: false, error: 'Failed to save Zotero settings' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { userIdZotero, libraryType, libraryId: libraryId || null, autoSync, syncInterval } })
  } catch (error) {
    console.error('Zotero config error:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 })
    }
    const authHeader = request.headers.get('authorization') || ''
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data, error } = await supabase
      .from('user_zotero_settings')
      .select('user_id_zotero, library_type, library_id, auto_sync, sync_interval, is_active')
      .eq('is_active', true)
      .single()
    if (error && (error as any).code !== 'PGRST116') {
      throw error
    }

    const isConfigured = !!data
    const safeConfig = data ? {
      userIdZotero: data.user_id_zotero,
      libraryType: data.library_type,
      libraryId: data.library_id,
      autoSync: data.auto_sync,
      syncInterval: data.sync_interval,
      hasApiKey: true
    } : null

    return NextResponse.json({ success: true, data: { isConfigured, config: safeConfig } })
  } catch (error) {
    console.error('Error getting Zotero config:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 })
    }
    const authHeader = request.headers.get('authorization') || ''
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { error } = await supabase
      .from('user_zotero_settings')
      .update({ is_active: false })
      .eq('is_active', true)
    if (error) throw error

    return NextResponse.json({ success: true, message: 'Zotero configuration cleared' })
  } catch (error) {
    console.error('Error clearing Zotero config:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 })
  }
}
