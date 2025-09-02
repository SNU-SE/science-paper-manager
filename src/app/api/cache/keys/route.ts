import { NextRequest, NextResponse } from 'next/server'
import { getCacheService } from '../../../../services/cache/CacheService'

const cacheService = getCacheService()

/**
 * GET /api/cache/keys - List cache keys with optional pattern matching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pattern = searchParams.get('pattern') || '*'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Completely prevent Redis import during build/static generation
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.NODE_ENV !== 'production' ||
                       typeof window !== 'undefined' ||
                       !process.env.VERCEL_ENV ||
                       process.env.VERCEL_ENV !== 'production'

    let redis: any

    if (isBuildTime) {
      const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
      redis = new MockRedis()
    } else if (process.env.REDIS_URL && typeof process.env.REDIS_URL === 'string') {
      const Redis = (await import('ioredis')).default
      redis = new Redis(process.env.REDIS_URL)
    } else {
      // Fallback to mock if no Redis URL
      const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
      redis = new MockRedis()
    }
    
    try {
      // Get keys matching pattern
      const allKeys = await redis.keys(pattern)
      const totalCount = allKeys.length
      
      // Apply pagination
      const paginatedKeys = allKeys.slice(offset, offset + limit)
      
      // Get additional info for each key
      const keyDetails = await Promise.all(
        paginatedKeys.map(async (key) => {
          try {
            const ttl = await redis.ttl(key)
            const type = await redis.type(key)
            const size = await redis.memory('usage', key).catch(() => null)
            
            return {
              key,
              ttl: ttl === -1 ? null : ttl, // -1 means no expiration
              type,
              size
            }
          } catch (error) {
            return {
              key,
              ttl: null,
              type: 'unknown',
              size: null,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )
      
      return NextResponse.json({
        success: true,
        data: {
          keys: keyDetails,
          pagination: {
            total: totalCount,
            offset,
            limit,
            hasMore: offset + limit < totalCount
          }
        }
      })
    } finally {
      await redis.quit()
    }
  } catch (error) {
    console.error('Cache keys listing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list cache keys',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cache/keys - Delete specific keys
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { keys } = body

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keys array is required' },
        { status: 400 }
      )
    }

    let deletedCount = 0
    const results = []

    for (const key of keys) {
      try {
        const deleted = await cacheService.delete(key)
        results.push({ key, deleted })
        if (deleted) deletedCount++
      } catch (error) {
        results.push({ 
          key, 
          deleted: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        totalRequested: keys.length,
        results
      }
    })
  } catch (error) {
    console.error('Cache keys deletion error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete cache keys',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}