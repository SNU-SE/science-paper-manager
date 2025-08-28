import { NextRequest, NextResponse } from 'next/server'

// In-memory usage tracking (in production, this would be stored in a database)
const usageStats: Record<string, {
  tokensUsed: number
  cost: number
  requestCount: number
  lastUpdated: Date
}> = {}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    if (service) {
      // Return usage for specific service
      const stats = usageStats[service] || {
        tokensUsed: 0,
        cost: 0,
        requestCount: 0,
        lastUpdated: new Date()
      }

      return NextResponse.json({
        service,
        usage: stats
      })
    } else {
      // Return usage for all services
      return NextResponse.json({
        usage: usageStats,
        total: Object.values(usageStats).reduce((total, stats) => ({
          tokensUsed: total.tokensUsed + stats.tokensUsed,
          cost: total.cost + stats.cost,
          requestCount: total.requestCount + stats.requestCount
        }), { tokensUsed: 0, cost: 0, requestCount: 0 })
      })
    }
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { service, tokensUsed, cost, processingTimeMs } = await request.json()

    if (!service || typeof tokensUsed !== 'number') {
      return NextResponse.json(
        { error: 'Service and tokensUsed are required' },
        { status: 400 }
      )
    }

    if (!['openai', 'anthropic', 'xai', 'gemini'].includes(service)) {
      return NextResponse.json(
        { error: 'Invalid service' },
        { status: 400 }
      )
    }

    // Update usage stats
    if (!usageStats[service]) {
      usageStats[service] = {
        tokensUsed: 0,
        cost: 0,
        requestCount: 0,
        lastUpdated: new Date()
      }
    }

    usageStats[service].tokensUsed += tokensUsed
    usageStats[service].cost += cost || 0
    usageStats[service].requestCount += 1
    usageStats[service].lastUpdated = new Date()

    return NextResponse.json({
      service,
      usage: usageStats[service],
      message: 'Usage recorded successfully'
    })
  } catch (error) {
    console.error('Error recording usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    if (service) {
      // Reset usage for specific service
      if (usageStats[service]) {
        usageStats[service] = {
          tokensUsed: 0,
          cost: 0,
          requestCount: 0,
          lastUpdated: new Date()
        }
      }

      return NextResponse.json({
        service,
        message: 'Usage stats reset successfully'
      })
    } else {
      // Reset usage for all services
      Object.keys(usageStats).forEach(key => {
        usageStats[key] = {
          tokensUsed: 0,
          cost: 0,
          requestCount: 0,
          lastUpdated: new Date()
        }
      })

      return NextResponse.json({
        message: 'All usage stats reset successfully'
      })
    }
  } catch (error) {
    console.error('Error resetting usage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}