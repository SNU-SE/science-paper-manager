import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 503 }
    )
  }

  try {
    // Get job statistics
    const { data: jobs, error } = await supabase
      .from('background_jobs')
      .select('status, created_at, started_at, completed_at')

    if (error) {
      throw error
    }

    const stats = {
      total: jobs?.length || 0,
      pending: jobs?.filter(j => j.status === 'pending').length || 0,
      running: jobs?.filter(j => j.status === 'running').length || 0,
      completed: jobs?.filter(j => j.status === 'completed').length || 0,
      failed: jobs?.filter(j => j.status === 'failed').length || 0,
      cancelled: jobs?.filter(j => j.status === 'cancelled').length || 0,
      avgDuration: 0,
      successRate: 0
    }

    // Calculate average duration for completed jobs
    const completedJobs = jobs?.filter(j => 
      j.status === 'completed' && j.started_at && j.completed_at
    ) || []

    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        const start = new Date(job.started_at!).getTime()
        const end = new Date(job.completed_at!).getTime()
        return sum + (end - start)
      }, 0)
      
      stats.avgDuration = totalDuration / completedJobs.length
    }

    // Calculate success rate
    const finishedJobs = stats.completed + stats.failed + stats.cancelled
    if (finishedJobs > 0) {
      stats.successRate = Math.round((stats.completed / finishedJobs) * 100)
    }

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Job stats fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch job statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}