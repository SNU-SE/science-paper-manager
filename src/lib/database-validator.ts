import { getSupabaseClient, getSupabaseAdminClient, TABLES } from './database'

/**
 * Database validation utilities for Science Paper Manager
 */

export interface DatabaseHealth {
  isConnected: boolean
  tablesExist: boolean
  functionsExist: boolean
  indexesExist: boolean
  extensionsEnabled: boolean
  errors: string[]
}

/**
 * Validates the database connection and setup
 */
export async function validateDatabaseSetup(): Promise<DatabaseHealth> {
  const health: DatabaseHealth = {
    isConnected: false,
    tablesExist: false,
    functionsExist: false,
    indexesExist: false,
    extensionsEnabled: false,
    errors: []
  }

  try {
    const supabase = getSupabaseClient()
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Test basic connection
    const { error: connectionError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)

    if (connectionError) {
      health.errors.push(`Connection failed: ${connectionError.message}`)
      return health
    }

    health.isConnected = true

    // Check if required tables exist
    const requiredTables = Object.values(TABLES)
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables)

    if (tablesError) {
      health.errors.push(`Tables check failed: ${tablesError.message}`)
    } else {
      const existingTables = tables?.map(t => t.table_name) || []
      const missingTables = requiredTables.filter(table => !existingTables.includes(table))
      
      if (missingTables.length === 0) {
        health.tablesExist = true
      } else {
        health.errors.push(`Missing tables: ${missingTables.join(', ')}`)
      }
    }

    // Check if match_documents function exists
    try {
      const { error: functionError } = await supabase
        .rpc('match_documents', {
          query_embedding: new Array(1536).fill(0),
          match_count: 1
        })

      if (!functionError) {
        health.functionsExist = true
      } else if (!functionError.message.includes('function match_documents')) {
        health.functionsExist = true // Function exists but no data
      } else {
        health.errors.push(`match_documents function missing: ${functionError.message}`)
      }
    } catch (error) {
      health.errors.push(`Function test failed: ${error}`)
    }

    // Check if pgvector extension is enabled
    const { data: extensions, error: extensionsError } = await supabaseAdmin
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')

    if (extensionsError) {
      health.errors.push(`Extensions check failed: ${extensionsError.message}`)
    } else if (extensions && extensions.length > 0) {
      health.extensionsEnabled = true
    } else {
      health.errors.push('pgvector extension not enabled')
    }

    // Check critical indexes
    const { data: indexes, error: indexesError } = await supabaseAdmin
      .from('pg_indexes')
      .select('indexname')
      .eq('schemaname', 'public')
      .in('indexname', [
        'documents_embedding_idx',
        'idx_papers_reading_status',
        'idx_documents_metadata'
      ])

    if (indexesError) {
      health.errors.push(`Indexes check failed: ${indexesError.message}`)
    } else {
      const existingIndexes = indexes?.map(i => i.indexname) || []
      if (existingIndexes.length >= 2) { // At least some critical indexes exist
        health.indexesExist = true
      } else {
        health.errors.push('Some critical indexes may be missing')
      }
    }

  } catch (error) {
    health.errors.push(`Validation failed: ${error}`)
  }

  return health
}

/**
 * Tests database operations with sample data
 */
export async function testDatabaseOperations(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    
    // Test paper insertion
    const testPaper = {
      title: 'Test Paper for Database Validation',
      authors: ['Test Author'],
      abstract: 'This is a test paper for validating database operations.',
      reading_status: 'unread' as const
    }

    const { data: insertedPaper, error: insertError } = await supabase
      .from(TABLES.PAPERS)
      .insert(testPaper)
      .select()
      .single()

    if (insertError) {
      console.error('Paper insertion test failed:', insertError)
      return false
    }

    // Test paper retrieval
    const { data: retrievedPaper, error: selectError } = await supabase
      .from(TABLES.PAPERS)
      .select('*')
      .eq('id', insertedPaper.id)
      .single()

    if (selectError || !retrievedPaper) {
      console.error('Paper retrieval test failed:', selectError)
      return false
    }

    // Test user evaluation insertion
    const testEvaluation = {
      paper_id: insertedPaper.id,
      rating: 5,
      notes: 'Test evaluation',
      tags: ['test', 'validation']
    }

    const { error: evaluationError } = await supabase
      .from(TABLES.USER_EVALUATIONS)
      .insert(testEvaluation)

    if (evaluationError) {
      console.error('Evaluation insertion test failed:', evaluationError)
      return false
    }

    // Test AI analysis insertion
    const testAnalysis = {
      paper_id: insertedPaper.id,
      model_provider: 'openai' as const,
      model_name: 'gpt-4',
      summary: 'Test summary',
      keywords: ['test', 'database'],
      confidence_score: 0.95
    }

    const { error: analysisError } = await supabase
      .from(TABLES.AI_ANALYSES)
      .insert(testAnalysis)

    if (analysisError) {
      console.error('Analysis insertion test failed:', analysisError)
      return false
    }

    // Clean up test data
    await supabase.from(TABLES.PAPERS).delete().eq('id', insertedPaper.id)

    console.log('✅ Database operations test passed')
    return true

  } catch (error) {
    console.error('Database operations test failed:', error)
    return false
  }
}

/**
 * Gets database statistics
 */
export async function getDatabaseStats() {
  try {
    const supabase = getSupabaseClient()
    
    const [papersCount, evaluationsCount, analysesCount, documentsCount] = await Promise.all([
      supabase.from(TABLES.PAPERS).select('id', { count: 'exact', head: true }),
      supabase.from(TABLES.USER_EVALUATIONS).select('id', { count: 'exact', head: true }),
      supabase.from(TABLES.AI_ANALYSES).select('id', { count: 'exact', head: true }),
      supabase.from(TABLES.DOCUMENTS).select('id', { count: 'exact', head: true })
    ])

    return {
      papers: papersCount.count || 0,
      evaluations: evaluationsCount.count || 0,
      analyses: analysesCount.count || 0,
      documents: documentsCount.count || 0
    }
  } catch (error) {
    console.error('Failed to get database stats:', error)
    return {
      papers: 0,
      evaluations: 0,
      analyses: 0,
      documents: 0
    }
  }
}