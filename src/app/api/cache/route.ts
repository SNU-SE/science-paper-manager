import { NextRequest, NextResponse } from 'next/server'
import { getCacheService } from '../../../services/cache/CacheService'
import CacheMonitor from '../../../services/cache/CacheMonitor'
import { getCacheHealth } from '../../../utils/cache'

const cacheService = getCacheService()
const cacheMonitor = new CacheMonitor(cacheService)

// Start monitoring when the module loads
cacheMonitor.startMonitoring(60000) // Monitor every minute

/**
 * GET /api/cache - Get cache statistics and health
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = cacheService.getStats()
        return NextResponse.json({
          success: true,
          data: stats
        })

      case 'metrics':
        const metrics = cacheMonitor.getMetrics()
        return NextResponse.json({
          success: true,
          data: metrics
        })

      case 'health':
        const health = await getCacheHealth()
        return NextResponse.json({
          success: true,
          data: health
        })

      case 'alerts':
        const limit = parseInt(searchParams.get('limit') || '50')
        const alerts = cacheMonitor.getAlerts(limit)
        return NextResponse.json({
          success: true,
          data: alerts
        })

      case 'score':
        const healthScore = cacheMonitor.getHealthScore()
        return NextResponse.json({
          success: true,
          data: { score: healthScore }
        })

      default:
        // Return comprehensive cache overview
        const overview = {
          stats: cacheService.getStats(),
          metrics: cacheMonitor.getMetrics(),
          health: await getCacheHealth(),
          score: cacheMonitor.getHealthScore()
        }
        
        return NextResponse.json({
          success: true,
          data: overview
        })
    }
  } catch (error) {
    console.error('Cache API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve cache information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cache - Cache management operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, key, value, options, pattern, tags } = body

    switch (action) {
      case 'set':
        if (!key || value === undefined) {
          return NextResponse.json(
            { success: false, error: 'Key and value are required' },
            { status: 400 }
          )
        }
        
        await cacheService.set(key, value, options || {})
        return NextResponse.json({
          success: true,
          message: 'Value cached successfully'
        })

      case 'get':
        if (!key) {
          return NextResponse.json(
            { success: false, error: 'Key is required' },
            { status: 400 }
          )
        }
        
        const cachedValue = await cacheService.get(key)
        return NextResponse.json({
          success: true,
          data: { key, value: cachedValue, exists: cachedValue !== null }
        })

      case 'delete':
        if (!key) {
          return NextResponse.json(
            { success: false, error: 'Key is required' },
            { status: 400 }
          )
        }
        
        const deleted = await cacheService.delete(key)
        return NextResponse.json({
          success: true,
          data: { deleted }
        })

      case 'invalidate-pattern':
        if (!pattern) {
          return NextResponse.json(
            { success: false, error: 'Pattern is required' },
            { status: 400 }
          )
        }
        
        const patternDeleted = await cacheService.invalidatePattern(pattern)
        return NextResponse.json({
          success: true,
          data: { deletedCount: patternDeleted }
        })

      case 'invalidate-tags':
        if (!tags || !Array.isArray(tags)) {
          return NextResponse.json(
            { success: false, error: 'Tags array is required' },
            { status: 400 }
          )
        }
        
        const tagDeleted = await cacheService.invalidateByTags(tags)
        return NextResponse.json({
          success: true,
          data: { deletedCount: tagDeleted }
        })

      case 'clear':
        await cacheService.clear()
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        })

      case 'optimize':
        const optimization = await cacheMonitor.optimizeCache()
        return NextResponse.json({
          success: true,
          data: optimization
        })

      case 'warm-up':
        const { warmUpData } = body
        if (!warmUpData || !Array.isArray(warmUpData)) {
          return NextResponse.json(
            { success: false, error: 'warmUpData array is required' },
            { status: 400 }
          )
        }
        
        await cacheService.warmUp(warmUpData)
        return NextResponse.json({
          success: true,
          message: 'Cache warm-up completed'
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Cache management error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cache operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cache - Clear cache or delete specific patterns
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pattern = searchParams.get('pattern')
    const tags = searchParams.get('tags')?.split(',')

    if (pattern) {
      const deletedCount = await cacheService.invalidatePattern(pattern)
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} keys matching pattern: ${pattern}`,
        data: { deletedCount }
      })
    }

    if (tags && tags.length > 0) {
      const deletedCount = await cacheService.invalidateByTags(tags)
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} keys with tags: ${tags.join(', ')}`,
        data: { deletedCount }
      })
    }

    // Clear all cache
    await cacheService.clear()
    return NextResponse.json({
      success: true,
      message: 'All cache cleared successfully'
    })
  } catch (error) {
    console.error('Cache deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cache deletion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}