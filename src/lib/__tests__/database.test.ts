/**
 * Database setup and functionality tests
 * These tests verify that the database schema is correctly set up
 * and all operations work as expected.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { supabase, TABLES } from '../database'
import { validateDatabaseSetup, testDatabaseOperations, getDatabaseStats } from '../database-validator'

describe('Database Setup', () => {
  beforeAll(async () => {
    // Ensure we have a valid connection
    const { error } = await supabase.from('information_schema.tables').select('table_name').limit(1)
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`)
    }
  })

  describe('Schema Validation', () => {
    it('should have all required tables', async () => {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', Object.values(TABLES))

      expect(error).toBeNull()
      expect(data).toBeDefined()
      
      const tableNames = data?.map(t => t.table_name) || []
      expect(tableNames).toContain(TABLES.PAPERS)
      expect(tableNames).toContain(TABLES.USER_EVALUATIONS)
      expect(tableNames).toContain(TABLES.AI_ANALYSES)
      expect(tableNames).toContain(TABLES.DOCUMENTS)
    })

    it('should have match_documents function', async () => {
      const { error } = await supabase.rpc('match_documents', {
        query_embedding: new Array(1536).fill(0),
        match_count: 1
      })

      // Function should exist (error would be about no data, not missing function)
      expect(error?.message).not.toContain('function match_documents')
    })

    it('should validate database health', async () => {
      const health = await validateDatabaseSetup()
      
      expect(health.isConnected).toBe(true)
      expect(health.tablesExist).toBe(true)
      expect(health.errors.length).toBe(0)
    })
  })

  describe('CRUD Operations', () => {
    let testPaperId: string

    it('should insert a paper', async () => {
      const testPaper = {
        title: 'Test Paper for Jest',
        authors: ['Test Author 1', 'Test Author 2'],
        abstract: 'This is a test paper abstract for Jest testing.',
        journal: 'Test Journal',
        publication_year: 2024,
        reading_status: 'unread' as const
      }

      const { data, error } = await supabase
        .from(TABLES.PAPERS)
        .insert(testPaper)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.title).toBe(testPaper.title)
      expect(data?.authors).toEqual(testPaper.authors)
      
      testPaperId = data?.id
    })

    it('should retrieve the inserted paper', async () => {
      const { data, error } = await supabase
        .from(TABLES.PAPERS)
        .select('*')
        .eq('id', testPaperId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(testPaperId)
      expect(data?.title).toBe('Test Paper for Jest')
    })

    it('should insert user evaluation', async () => {
      const testEvaluation = {
        paper_id: testPaperId,
        rating: 4,
        notes: 'Great paper for testing',
        tags: ['test', 'jest', 'database']
      }

      const { data, error } = await supabase
        .from(TABLES.USER_EVALUATIONS)
        .insert(testEvaluation)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.paper_id).toBe(testPaperId)
      expect(data?.rating).toBe(4)
      expect(data?.tags).toEqual(['test', 'jest', 'database'])
    })

    it('should insert AI analysis', async () => {
      const testAnalysis = {
        paper_id: testPaperId,
        model_provider: 'openai' as const,
        model_name: 'gpt-4',
        summary: 'AI-generated summary for testing',
        keywords: ['artificial intelligence', 'testing', 'database'],
        confidence_score: 0.92,
        tokens_used: 150,
        processing_time_ms: 2500
      }

      const { data, error } = await supabase
        .from(TABLES.AI_ANALYSES)
        .insert(testAnalysis)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.paper_id).toBe(testPaperId)
      expect(data?.model_provider).toBe('openai')
      expect(data?.confidence_score).toBe(0.92)
    })

    it('should update paper reading status', async () => {
      const { data, error } = await supabase
        .from(TABLES.PAPERS)
        .update({ 
          reading_status: 'completed',
          date_read: new Date().toISOString()
        })
        .eq('id', testPaperId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.reading_status).toBe('completed')
      expect(data?.date_read).toBeDefined()
    })

    afterAll(async () => {
      // Clean up test data
      if (testPaperId) {
        await supabase.from(TABLES.PAPERS).delete().eq('id', testPaperId)
      }
    })
  })

  describe('Vector Operations', () => {
    let testDocumentId: number

    it('should insert document with embedding', async () => {
      const testDocument = {
        content: 'This is a test document for vector search testing.',
        metadata: {
          paper_id: 'test-paper-id',
          type: 'abstract',
          source: 'jest-test'
        },
        embedding: new Array(1536).fill(0.1) // Mock embedding
      }

      const { data, error } = await supabase
        .from(TABLES.DOCUMENTS)
        .insert(testDocument)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.content).toBe(testDocument.content)
      
      testDocumentId = data?.id
    })

    it('should perform vector similarity search', async () => {
      const queryEmbedding = new Array(1536).fill(0.1)
      
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_count: 5,
        filter: { source: 'jest-test' }
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('content')
        expect(data[0]).toHaveProperty('metadata')
        expect(data[0]).toHaveProperty('similarity')
      }
    })

    afterAll(async () => {
      // Clean up test document
      if (testDocumentId) {
        await supabase.from(TABLES.DOCUMENTS).delete().eq('id', testDocumentId)
      }
    })
  })

  describe('Database Statistics', () => {
    it('should get database statistics', async () => {
      const stats = await getDatabaseStats()
      
      expect(stats).toBeDefined()
      expect(typeof stats.papers).toBe('number')
      expect(typeof stats.evaluations).toBe('number')
      expect(typeof stats.analyses).toBe('number')
      expect(typeof stats.documents).toBe('number')
      expect(stats.papers).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration Tests', () => {
    it('should pass all database operation tests', async () => {
      const success = await testDatabaseOperations()
      expect(success).toBe(true)
    })
  })
})