import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware } from '@/middleware/securityMiddleware'

/**
 * Example of a secure API route using security middleware
 * This demonstrates how to apply security features to API endpoints
 */

/**
 * GET endpoint with basic security logging
 */
export async function GET(request: NextRequest) {
  const middleware = securityMiddleware({
    logAccess: true,
    checkSuspiciousActivity: true
  })

  return middleware(request, {}, async () => {
    return NextResponse.json({
      message: 'This is a secure GET endpoint',
      timestamp: new Date().toISOString()
    })
  })
}

/**
 * POST endpoint with CSRF protection
 */
export async function POST(request: NextRequest) {
  const middleware = securityMiddleware({
    requireCSRF: true,
    logAccess: true,
    checkSuspiciousActivity: true,
    rateLimitRequests: true
  })

  return middleware(request, {}, async () => {
    const body = await request.json()
    
    return NextResponse.json({
      message: 'Data processed securely',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  })
}

/**
 * DELETE endpoint with full security features
 */
export async function DELETE(request: NextRequest) {
  const middleware = securityMiddleware({
    requireCSRF: true,
    logAccess: true,
    checkSuspiciousActivity: true,
    rateLimitRequests: true
  })

  return middleware(request, {}, async () => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      )
    }

    // Simulate deletion logic
    return NextResponse.json({
      message: `Resource ${id} deleted securely`,
      timestamp: new Date().toISOString()
    })
  })
}