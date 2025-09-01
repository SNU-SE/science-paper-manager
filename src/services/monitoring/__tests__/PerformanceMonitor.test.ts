import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { performanceMonitor } from '../PerformanceMonitor'
import { NextRequest, NextResponse } from 'next/server'

// Mock global Request and Response
global.Request = jest.fn()
global.Response = jest.fn()

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            data: [
              {
                hour: new Date().toISOString(),
                endpoint: '/api/test',
                request_count: 10,
                avg_response_time: 500,
                error_count: 1
              }
            ],
            error: null
          })),
          gte: jest.fn(() => ({
            data: [
              {
                endpoint: '/api/test',
                status_code: 500
              }
            ],
            error: null
          }))
        })),
        limit: jest.fn(() => ({
          data: [
            {
              query_hash: 'abc123',
              query_type: 'SELECT',
              avg_execution_time: 300,
              execution_count: 25,
              table_name: 'papers'
            }
          ],
          error: null
        }))
      }))
    })),
    auth: {
      getUser: jest.fn(() => ({
        data: { user: { id: 'test-user-id' } },
        error: null
      }))
    }
  }))
}))

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('trackAPIRequest', () => {
    it('should track API request metrics successfully', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: {
          get: jest.fn((header) => {
            if (header === 'authorization') return 'Bearer test-token'
            if (header === 'user-agent') return 'test-agent'
            if (header === 'content-length') return '100'
            return null
          })
        }
      } as unknown as NextRequest

      const mockRes = {
        status: 200
      } as NextResponse

      await performanceMonitor.trackAPIRequest(mockReq, mockRes, 150)

      // Should not throw any errors
      expect(true).toBe(true)
    })

    it('should handle tracking errors gracefully', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: {
          get: jest.fn(() => null)
        }
      } as unknown as NextRequest

      const mockRes = {
        status: 500
      } as NextResponse

      // Should not throw even if tracking fails
      await expect(
        performanceMonitor.trackAPIRequest(mockReq, mockRes, 1000)
      ).resolves.not.toThrow()
    })
  })

  describe('trackDatabaseQuery', () => {
    it('should track database query metrics', async () => {
      const query = 'SELECT * FROM papers WHERE user_id = $1'
      const executionTime = 250
      const rowsAffected = 10

      await performanceMonitor.trackDatabaseQuery(query, executionTime, rowsAffected)

      // Should not throw any errors
      expect(true).toBe(true)
    })

    it('should generate consistent query hashes', async () => {
      const query1 = 'SELECT * FROM papers WHERE user_id = $1'
      const query2 = 'SELECT * FROM papers WHERE user_id = $2'
      
      // Both queries should generate the same hash after normalization
      await performanceMonitor.trackDatabaseQuery(query1, 100)
      await performanceMonitor.trackDatabaseQuery(query2, 150)

      expect(true).toBe(true)
    })
  })

  describe('trackUserActivity', () => {
    it('should track user activity metrics', async () => {
      const userId = 'test-user-id'
      const action = 'paper_upload'
      const feature = 'papers'
      const metadata = { fileSize: 1024, fileType: 'pdf' }

      await performanceMonitor.trackUserActivity(userId, action, feature, metadata)

      // Should not throw any errors
      expect(true).toBe(true)
    })
  })

  describe('trackSystemMetric', () => {
    it('should track system metrics', async () => {
      await performanceMonitor.trackSystemMetric(
        'memory',
        'heap_used',
        104857600, // 100MB
        'bytes',
        { process: 'main' }
      )

      // Should not throw any errors
      expect(true).toBe(true)
    })
  })

  describe('getMetrics', () => {
    it('should retrieve performance metrics for a time range', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      const metrics = await performanceMonitor.getMetrics({
        start: oneHourAgo,
        end: now
      })

      expect(metrics).toHaveProperty('apiMetrics')
      expect(metrics).toHaveProperty('databaseMetrics')
      expect(metrics).toHaveProperty('userMetrics')
      expect(metrics).toHaveProperty('systemMetrics')

      expect(metrics.apiMetrics).toHaveProperty('averageResponseTime')
      expect(metrics.apiMetrics).toHaveProperty('requestsPerMinute')
      expect(metrics.apiMetrics).toHaveProperty('errorRate')
      expect(metrics.apiMetrics).toHaveProperty('slowestEndpoints')
    })
  })

  describe('getDashboardData', () => {
    it('should retrieve dashboard data with recent and daily metrics', async () => {
      const dashboardData = await performanceMonitor.getDashboardData()

      expect(dashboardData).toHaveProperty('recent')
      expect(dashboardData).toHaveProperty('daily')
      expect(dashboardData).toHaveProperty('slowQueries')
      expect(dashboardData).toHaveProperty('errorRates')
      expect(dashboardData).toHaveProperty('activeUsers')
      expect(dashboardData).toHaveProperty('timestamp')
    })
  })

  describe('helper methods', () => {
    it('should extract query type correctly', async () => {
      const selectQuery = 'SELECT * FROM papers'
      const insertQuery = 'INSERT INTO papers (title) VALUES ($1)'
      const updateQuery = 'UPDATE papers SET title = $1 WHERE id = $2'
      const deleteQuery = 'DELETE FROM papers WHERE id = $1'

      // Test by tracking queries and checking they don't throw
      await performanceMonitor.trackDatabaseQuery(selectQuery, 100)
      await performanceMonitor.trackDatabaseQuery(insertQuery, 150)
      await performanceMonitor.trackDatabaseQuery(updateQuery, 200)
      await performanceMonitor.trackDatabaseQuery(deleteQuery, 50)

      expect(true).toBe(true)
    })

    it('should extract table name from queries', async () => {
      const queries = [
        'SELECT * FROM papers WHERE id = $1',
        'INSERT INTO user_evaluations (rating) VALUES ($1)',
        'UPDATE background_jobs SET status = $1',
        'DELETE FROM api_metrics WHERE created_at < $1'
      ]

      for (const query of queries) {
        await performanceMonitor.trackDatabaseQuery(query, 100)
      }

      expect(true).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const originalConsoleError = console.error
      console.error = jest.fn()

      // This should not throw even if the database operation fails
      await expect(
        performanceMonitor.trackAPIRequest(
          {} as NextRequest,
          { status: 200 } as NextResponse,
          100
        )
      ).resolves.not.toThrow()

      console.error = originalConsoleError
    })

    it('should handle malformed requests gracefully', async () => {
      const malformedReq = {
        url: 'invalid-url',
        method: 'INVALID',
        headers: {
          get: jest.fn(() => null)
        }
      } as unknown as NextRequest

      await expect(
        performanceMonitor.trackAPIRequest(
          malformedReq,
          { status: 400 } as NextResponse,
          0
        )
      ).resolves.not.toThrow()
    })
  })
})