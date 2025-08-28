import { NextResponse } from 'next/server'
import { validateDatabaseSetup, getDatabaseStats } from '@/lib/database-validator'

/**
 * GET /api/database/health
 * Returns database health status and statistics
 */
export async function GET() {
  try {
    const [health, stats] = await Promise.all([
      validateDatabaseSetup(),
      getDatabaseStats()
    ])

    return NextResponse.json({
      success: true,
      health,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}