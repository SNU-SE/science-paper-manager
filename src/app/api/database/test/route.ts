import { NextResponse } from 'next/server'
import { testDatabaseOperations } from '@/lib/database-validator'

/**
 * POST /api/database/test
 * Runs database operation tests
 */
export async function POST() {
  try {
    const success = await testDatabaseOperations()
    
    return NextResponse.json({
      success,
      message: success ? 'All database operations passed' : 'Some database operations failed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}