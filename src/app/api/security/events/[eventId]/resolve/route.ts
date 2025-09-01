import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params
    const { resolution_notes } = await request.json()

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Update the security event as resolved
    const { data: updatedEvent, error } = await supabase
      .from('security_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolution_notes || 'Manually resolved by administrator'
      })
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!updatedEvent) {
      return NextResponse.json(
        { success: false, error: 'Security event not found' },
        { status: 404 }
      )
    }

    // Log the resolution action
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'security_event_resolved',
        resource_type: 'security_event',
        resource_id: eventId,
        metadata: {
          event_type: updatedEvent.event_type,
          severity: updatedEvent.severity,
          resolution_notes
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      data: updatedEvent,
      message: 'Security event resolved successfully'
    })

  } catch (error) {
    console.error('Security event resolution error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve security event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}