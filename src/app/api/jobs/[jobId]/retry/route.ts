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

    // Check if job can be retried
    if (job.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: 'Only failed jobs can be retried' },
        { status: 400 }
      )
    }

    // Reset job status and add to queue
    const { data: updatedJob, error: updateError } = await supabase
      .from('background_jobs')
      .update({
        status: 'pending',
        error_message: null,
        started_at: null,
        completed_at: null,
        attempts: job.attempts + 1
      })
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Add job back to queue
    const jobQueueManager = new JobQueueManager()
    await jobQueueManager.retryJob(jobId)

    // Log the retry action
    await supabase
      .from('admin_action_logs')
      .insert({
        action_type: 'job_retried',
        resource_type: 'background_job',
        resource_id: jobId,
        metadata: {
          job_type: job.type,
          attempt_number: job.attempts + 1,
          user_id: job.user_id
        },
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: 'Job queued for retry successfully'
    })

  } catch (error) {
    console.error('Job retry error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retry job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}