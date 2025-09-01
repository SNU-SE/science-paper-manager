import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { JobQueueManager } from '@/services/background/JobQueueManager'

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get the job details first
    const { data: job, error: fetchError } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      throw fetchError
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if job can be cancelled
    if (!['pending', 'running'].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: 'Job cannot be cancelled in current status' },
        { status: 400 }
      )
    }

    // Cancel the job in the queue system
    const jobQueueManager = new JobQueueManager()
    const cancelled = await jobQueueManager.cancelJob(jobId)

    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: 'Failed to cancel job in queue system' },
        { status: 500 }
      )
    }

    // Update job status in database
    const { data: updatedJob, error: updateError } = await supabase
      .from('background_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Job cancelled by administrator'
      })
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Log the cancellation action
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'job_cancelled',
        resource_type: 'background_job',
        resource_id: jobId,
        metadata: {
          job_type: job.type,
          original_status: job.status,
          user_id: job.user_id
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: 'Job cancelled successfully'
    })

  } catch (error) {
    console.error('Job cancellation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}