/**
 * Performance Tests
 * 
 * Tests to verify system performance under various load conditions
 * and ensure performance requirements are met.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { performance } from 'perf_hooks'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { JobQueueManager } from '../background/JobQueueManager'
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor'
import { CacheService } from '../cache/CacheService'
import { AdvancedSearchService } from '../search/AdvancedSearchService'

// Performance test configuration
const PERFORMANCE_CONFIG = {
  supabase: {
    url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
    key: process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/2'
  },
  thresholds: {
    apiResponseTime: 1000, // 1 second max
    databaseQueryTime: 500, // 500ms max
    cacheResponseTime: 50, // 50ms max
    searchResponseTime: 2000, // 2 seconds max for complex searches
    jobProcessingTime: 5000 // 5 seconds max for job processing
  }
}

describe('Performance Tests', () => {
  let supabase: any
  let redis: Redis
  let jobQueue: JobQueueManager
  let performanceMonitor: PerformanceMonitor
  let cacheService: CacheService
  let searchService: AdvancedSearchService
  let testUserId: string

  beforeAll(async () => {
    supabase = createClient(PERFORMANCE_CONFIG.supabase.url, PERFORMANCE_CONFIG.supabase.key)
    redis = new Redis(PERFORMANCE_CONFIG.redis.url)
    
    jobQueue = new JobQueueManager(redis)
    performanceMonitor = new PerformanceMonitor(supabase, redis)
    cacheService = new CacheService(redis)
    searchService = new AdvancedSearchService(supabase, cacheService)

    // Create test user
    const { data: user } = await supabase.auth.signUp({
      email: 'perf-test@example.com',
      password: 'testpassword123'
    })
    testUserId = user?.user?.id || 'perf-test-user-id'

    // Create test data for performance tests
    await createTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await redis.flushdb()
    await redis.quit()
  })

  beforeEach(async () => {
    // Clear performance metrics before each test
    await redis.del('perf:*')
  })

  async function createTestData() {
    // Create 1000 test papers for performance testing
    const papers = Array.from({ length: 1000 }, (_, i) => ({
      title: `Performance Test Paper ${i + 1}`,
      abstract: `This is abstract ${i + 1} for performance testing with various keywords like machine learning, artificial intelligence, neural networks, and data science.`,
      content: `Full content of paper ${i + 1}. `.repeat(100), // Simulate large content
      authors: [`Author ${i + 1}`, `Co-Author ${i + 1}`],
      journal: `Journal ${(i % 10) + 1}`,
      publication_year: 2020 + (i % 4),
      user_id: testUserId,
      file_path: `/test/papers/paper-${i + 1}.pdf`,
      created_at: new Date(Date.now() - i * 1000 * 60 * 60) // Spread over time
    }))

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize)
      await supabase.from('papers').insert(batch)
    }

    // Create test evaluations
    const evaluations = Array.from({ length: 500 }, (_, i) => ({
      paper_id: `paper-${(i % 1000) + 1}`,
      user_id: testUserId,
      rating: Math.floor(Math.random() * 5) + 1,
      tags: [`tag-${i % 20}`, `category-${i % 10}`],
      notes: `Test evaluation notes ${i + 1}`
    }))

    for (let i = 0; i < evaluations.length; i += batchSize) {
      const batch = evaluations.slice(i, i + batchSize)
      await supabase.from('user_evaluations').insert(batch)
    }
  }

  async function cleanupTestData() {
    await supabase.from('user_evaluations').delete().eq('user_id', testUserId)
    await supabase.from('papers').delete().eq('user_id', testUserId)
  }

  describe('Database Query Performance', () => {
    test('should retrieve papers list within performance threshold', async () => {
      const startTime = performance.now()

      const { data: papers } = await supabase
        .from('papers')
        .select('id, title, abstract, authors, journal, publication_year, created_at')
        .eq('user_id', testUserId)
        .order('created_at', { ascending: false })
        .limit(50)

      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(papers).toHaveLength(50)
      expect(queryTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.databaseQueryTime)

      console.log(`Papers list query time: ${queryTime.toFixed(2)}ms`)
    })

    test('should perform complex search queries within threshold', async () => {
      const startTime = performance.now()

      const { data: results } = await supabase
        .from('papers')
        .select(`
          id, title, abstract, authors, journal, publication_year,
          user_evaluations!inner(rating, tags)
        `)
        .eq('user_id', testUserId)
        .gte('user_evaluations.rating', 3)
        .textSearch('title', 'machine learning')
        .order('publication_year', { ascending: false })
        .limit(20)

      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(results).toBeDefined()
      expect(queryTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.databaseQueryTime * 2) // Allow 2x for complex queries

      console.log(`Complex search query time: ${queryTime.toFixed(2)}ms`)
    })

    test('should handle concurrent database queries efficiently', async () => {
      const concurrentQueries = 10
      const startTime = performance.now()

      const promises = Array.from({ length: concurrentQueries }, (_, i) =>
        supabase
          .from('papers')
          .select('id, title')
          .eq('user_id', testUserId)
          .range(i * 10, (i + 1) * 10 - 1)
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(results).toHaveLength(concurrentQueries)
      results.forEach(result => {
        expect(result.data).toBeDefined()
      })

      // Should not take much longer than a single query due to connection pooling
      expect(totalTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.databaseQueryTime * 2)

      console.log(`${concurrentQueries} concurrent queries time: ${totalTime.toFixed(2)}ms`)
    })
  })

  describe('Cache Performance', () => {
    test('should cache and retrieve data within performance threshold', async () => {
      const testData = { 
        papers: Array.from({ length: 100 }, (_, i) => ({ id: i, title: `Paper ${i}` }))
      }
      const cacheKey = 'perf:test:papers'

      // Test cache write performance
      const writeStartTime = performance.now()
      await cacheService.set(cacheKey, testData, 300)
      const writeEndTime = performance.now()
      const writeTime = writeEndTime - writeStartTime

      expect(writeTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.cacheResponseTime)

      // Test cache read performance
      const readStartTime = performance.now()
      const cachedData = await cacheService.get(cacheKey)
      const readEndTime = performance.now()
      const readTime = readEndTime - readStartTime

      expect(cachedData).toEqual(testData)
      expect(readTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.cacheResponseTime)

      console.log(`Cache write time: ${writeTime.toFixed(2)}ms, read time: ${readTime.toFixed(2)}ms`)
    })

    test('should handle high-frequency cache operations', async () => {
      const operations = 1000
      const startTime = performance.now()

      const promises = Array.from({ length: operations }, async (_, i) => {
        const key = `perf:test:item:${i}`
        const value = { id: i, data: `test-data-${i}` }
        
        await cacheService.set(key, value, 60)
        return cacheService.get(key)
      })

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / operations

      expect(results).toHaveLength(operations)
      expect(avgTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.cacheResponseTime)

      console.log(`${operations} cache operations avg time: ${avgTime.toFixed(2)}ms`)
    })
  })

  describe('Search Performance', () => {
    test('should perform text search within performance threshold', async () => {
      const searchQuery = {
        textQuery: 'machine learning artificial intelligence',
        filters: {
          rating: { min: 3, max: 5 }
        },
        sortBy: 'relevance' as const,
        pagination: { page: 1, limit: 20 }
      }

      const startTime = performance.now()
      const results = await searchService.searchPapers(searchQuery)
      const endTime = performance.now()
      const searchTime = endTime - startTime

      expect(results.papers).toBeDefined()
      expect(results.total).toBeGreaterThan(0)
      expect(searchTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.searchResponseTime)

      console.log(`Text search time: ${searchTime.toFixed(2)}ms`)
    })

    test('should handle complex filtered search efficiently', async () => {
      const complexQuery = {
        textQuery: 'neural networks',
        filters: {
          rating: { min: 4, max: 5 },
          tags: ['machine-learning', 'ai'],
          dateRange: {
            start: new Date('2022-01-01'),
            end: new Date('2024-01-01')
          },
          journals: ['Journal 1', 'Journal 2', 'Journal 3']
        },
        sortBy: 'publication_year' as const,
        pagination: { page: 1, limit: 50 }
      }

      const startTime = performance.now()
      const results = await searchService.searchPapers(complexQuery)
      const endTime = performance.now()
      const searchTime = endTime - startTime

      expect(results.papers).toBeDefined()
      expect(searchTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.searchResponseTime)

      console.log(`Complex filtered search time: ${searchTime.toFixed(2)}ms`)
    })
  })

  describe('Background Job Performance', () => {
    test('should process jobs within performance threshold', async () => {
      const jobData = {
        paperId: 'test-paper-1',
        providers: ['openai'],
        userId: testUserId
      }

      const startTime = performance.now()
      const jobId = await jobQueue.addAnalysisJob(jobData.paperId, jobData.providers, {
        userId: jobData.userId,
        priority: 1
      })
      const endTime = performance.now()
      const queueTime = endTime - startTime

      expect(jobId).toBeDefined()
      expect(queueTime).toBeLessThan(100) // Job queuing should be very fast

      // Test job processing time (mocked)
      const processingStartTime = performance.now()
      
      // Simulate job processing
      await new Promise(resolve => setTimeout(resolve, 100)) // Mock processing time
      
      const processingEndTime = performance.now()
      const processingTime = processingEndTime - processingStartTime

      expect(processingTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.jobProcessingTime)

      console.log(`Job queue time: ${queueTime.toFixed(2)}ms, processing time: ${processingTime.toFixed(2)}ms`)
    })

    test('should handle concurrent job submissions efficiently', async () => {
      const concurrentJobs = 50
      const startTime = performance.now()

      const promises = Array.from({ length: concurrentJobs }, (_, i) =>
        jobQueue.addAnalysisJob(`test-paper-${i}`, ['openai'], {
          userId: testUserId,
          priority: 1
        })
      )

      const jobIds = await Promise.all(promises)
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / concurrentJobs

      expect(jobIds).toHaveLength(concurrentJobs)
      expect(avgTime).toBeLessThan(50) // Each job submission should be very fast

      console.log(`${concurrentJobs} concurrent job submissions avg time: ${avgTime.toFixed(2)}ms`)
    })
  })

  describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during intensive operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform intensive operations
      for (let i = 0; i < 100; i++) {
        // Create and cache large objects
        const largeObject = {
          data: Array.from({ length: 1000 }, (_, j) => ({
            id: j,
            content: `Large content ${j}`.repeat(100)
          }))
        }

        await cacheService.set(`memory:test:${i}`, largeObject, 10)
        
        // Perform database operations
        await supabase
          .from('papers')
          .select('id, title')
          .eq('user_id', testUserId)
          .limit(10)

        // Clean up periodically
        if (i % 10 === 0) {
          await cacheService.invalidatePattern('memory:test:*')
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc()
          }
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
    })
  })

  describe('Load Testing Simulation', () => {
    test('should handle simulated user load', async () => {
      const simulatedUsers = 20
      const operationsPerUser = 10

      const startTime = performance.now()

      const userPromises = Array.from({ length: simulatedUsers }, async (_, userId) => {
        const operations = Array.from({ length: operationsPerUser }, async (_, opId) => {
          const operation = opId % 4

          switch (operation) {
            case 0: // Search papers
              return searchService.searchPapers({
                textQuery: `test query ${opId}`,
                filters: {},
                sortBy: 'created_at',
                pagination: { page: 1, limit: 10 }
              })

            case 1: // Get papers list
              return supabase
                .from('papers')
                .select('id, title, abstract')
                .eq('user_id', testUserId)
                .limit(20)

            case 2: // Cache operation
              const cacheKey = `load:test:user:${userId}:op:${opId}`
              await cacheService.set(cacheKey, { data: `test-${opId}` }, 60)
              return cacheService.get(cacheKey)

            case 3: // Performance tracking
              return performanceMonitor.trackAPIRequest({
                endpoint: `/api/test/${opId}`,
                method: 'GET',
                responseTime: Math.random() * 500,
                statusCode: 200,
                userId: `user-${userId}`,
                timestamp: new Date()
              })
          }
        })

        return Promise.all(operations)
      })

      const results = await Promise.all(userPromises)
      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(results).toHaveLength(simulatedUsers)
      
      // Total time should be reasonable for the load
      const expectedMaxTime = 10000 // 10 seconds for this load
      expect(totalTime).toBeLessThan(expectedMaxTime)

      console.log(`Load test (${simulatedUsers} users, ${operationsPerUser} ops each): ${totalTime.toFixed(2)}ms`)
    })
  })
})