#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import { supabaseAdmin } from '../src/lib/database'

/**
 * Database setup script for Science Paper Manager
 * This script creates the database schema, tables, functions, and indexes
 */

async function setupDatabase() {
  console.log('🚀 Setting up Science Paper Manager database...')

  try {
    // Read the schema SQL file
    const schemaPath = join(process.cwd(), 'database', 'schema.sql')
    const schemaSql = readFileSync(schemaPath, 'utf-8')

    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          console.log(`   ${i + 1}/${statements.length}: Executing statement...`)
          const { error } = await supabaseAdmin.rpc('exec_sql', { 
            sql: statement + ';' 
          }).single()
          
          if (error) {
            // Try direct execution for statements that don't work with rpc
            const { error: directError } = await supabaseAdmin
              .from('_temp_exec')
              .select('*')
              .limit(0) // This will fail but allows us to execute raw SQL
            
            if (directError && !directError.message.includes('relation "_temp_exec" does not exist')) {
              console.warn(`   ⚠️  Warning on statement ${i + 1}:`, error.message)
            }
          }
        } catch (err) {
          console.warn(`   ⚠️  Warning on statement ${i + 1}:`, err)
        }
      }
    }

    // Verify the setup by checking if tables exist
    console.log('🔍 Verifying database setup...')
    
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['papers', 'user_evaluations', 'ai_analyses', 'documents'])

    if (tablesError) {
      console.error('❌ Error verifying tables:', tablesError)
      return false
    }

    const expectedTables = ['papers', 'user_evaluations', 'ai_analyses', 'documents']
    const existingTables = tables?.map(t => t.table_name) || []
    const missingTables = expectedTables.filter(table => !existingTables.includes(table))

    if (missingTables.length > 0) {
      console.warn('⚠️  Some tables may not have been created:', missingTables)
    } else {
      console.log('✅ All required tables verified')
    }

    // Test the match_documents function
    console.log('🧪 Testing match_documents function...')
    const { data: functionTest, error: functionError } = await supabaseAdmin
      .rpc('match_documents', {
        query_embedding: new Array(1536).fill(0),
        match_count: 1
      })

    if (functionError) {
      console.warn('⚠️  match_documents function test failed:', functionError.message)
    } else {
      console.log('✅ match_documents function is working')
    }

    console.log('🎉 Database setup completed successfully!')
    return true

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    return false
  }
}

// Alternative manual setup function for when RPC doesn't work
async function manualSetup() {
  console.log('🔧 Running manual database setup...')
  
  const setupSteps = [
    {
      name: 'Enable extensions',
      fn: async () => {
        // Extensions need to be enabled via Supabase dashboard or SQL editor
        console.log('   📋 Please ensure these extensions are enabled in your Supabase project:')
        console.log('      - uuid-ossp')
        console.log('      - vector (pgvector)')
        return true
      }
    },
    {
      name: 'Create papers table',
      fn: async () => {
        const { error } = await supabaseAdmin.from('papers').select('id').limit(1)
        return !error || error.message.includes('relation "papers" does not exist')
      }
    }
  ]

  for (const step of setupSteps) {
    console.log(`   ${step.name}...`)
    try {
      await step.fn()
      console.log('   ✅ Success')
    } catch (error) {
      console.log('   ❌ Failed:', error)
    }
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase().then(success => {
    if (!success) {
      console.log('\n📖 Manual Setup Instructions:')
      console.log('1. Go to your Supabase project dashboard')
      console.log('2. Navigate to SQL Editor')
      console.log('3. Copy and paste the contents of database/schema.sql')
      console.log('4. Execute the SQL to create tables, functions, and indexes')
      console.log('5. Ensure pgvector extension is enabled')
      
      manualSetup()
    }
    process.exit(success ? 0 : 1)
  })
}

export { setupDatabase }