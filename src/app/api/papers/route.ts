import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Paper } from '@/types'

export const runtime = 'nodejs'

function getSupabaseForRequest(request: NextRequest) {
  try {
    const admin = createServerSupabaseClient()
    if (admin) return admin
  } catch {}
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Supabase is not configured')
  }
  const authHeader = request.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
  return createClient(url, anon, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const supabase = getSupabaseForRequest(request)

    if (id) {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .eq('id', id)
        .single()
      if (error && (error as any).code !== 'PGRST116') throw error
      if (!data) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
      return NextResponse.json(data)
    } else {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .order('date_added', { ascending: false })
      if (error) throw error
      return NextResponse.json(data || [])
    }
  } catch (error) {
    console.error('Error in GET /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch papers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const paper: Partial<Paper> = body

    if (!paper.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const supabase = getSupabaseForRequest(request)
    const { data, error } = await supabase
      .from('papers')
      .insert({
        title: paper.title,
        authors: paper.authors || [],
        journal: paper.journal || null,
        publication_year: paper.publicationYear || null,
        doi: paper.doi || null,
        abstract: paper.abstract || null,
        google_drive_id: paper.googleDriveId || null,
        google_drive_url: paper.googleDriveUrl || null,
        pdf_path: paper.pdfPath || null,
        reading_status: paper.readingStatus || 'unread',
        date_added: (paper.dateAdded ? new Date(paper.dateAdded) : new Date()).toISOString(),
        last_modified: new Date().toISOString()
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to create paper' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates }: Partial<Paper> & { id: string } = body

    if (!id) return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 })

    const supabase = getSupabaseForRequest(request)
    const { data, error } = await supabase
      .from('papers')
      .update({
        title: updates.title,
        authors: updates.authors,
        journal: updates.journal,
        publication_year: updates.publicationYear,
        doi: updates.doi,
        abstract: updates.abstract,
        reading_status: updates.readingStatus,
        last_modified: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to update paper' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 })

    const supabase = getSupabaseForRequest(request)
    const { error } = await supabase
      .from('papers')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to delete paper' },
      { status: 500 }
    )
  }
}

