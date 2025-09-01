#!/usr/bin/env tsx

/**
 * Database Setup and Optimization Script
 * 
 * This script sets up the complete database schema with all optimizations,
 * partitioning, and performance enhancements for the Science Paper Manager.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface MigrationResult {
  file: string
  success: boolean
  error?: string
  duration: number
}

async function runMigration(filePath: string, fileName: string): Promise<MigrationResult> {
  const startTime = Date.now()
  
  try {
    console.log(`Running migration: ${fileName}`)
    
    const sql = readFileSync(filePath, 'utf-8')
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          throw new Error(`SQL Error: ${error.message}`)
        }
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Migration ${fileName} completed in ${duration}ms`)
    
    return {
      file: fileName,
      success: true,
      duration
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error(`❌ Migration ${fileName} failed: ${errorMessage}`)
    
    return {
      file: fileName,
      success: false,
      error: errorMessage,
      duration
    }
  }
}

async function setupDatabase() {
  console.log('🚀 Starting database setup and optimization...')
  console.log('=' .repeat(60))
  
  const migrationsDir = join(process.cwd(), 'database', 'migrations')
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort() // Ensure migrations run in order
  
  console.log(`Found ${migrationFiles.length} migration files`)
  console.log('')
  
  const results: MigrationResult[] = []
  let totalDuration = 0
  
  // Run each migration
  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file)
    const result = await runMigration(filePath, file)
    results.push(result)
    totalDuration += result.duration
    
    // Stop on first failure
    if (!result.success) {
      console.error(`\n❌ Migration failed: ${file}`)
      console.error(`Error: ${result.error}`)
      break
    }
  }
  
  // Summary
  console.log('')
  console.log('=' .repeat(60))
  console.log('📊 Migration Summary')
  console.log('=' .repeat(60))
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log(`Total migrations: ${results.length}`)
  console.log(`Successful: ${successful}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total duration: ${totalDuration}ms`)
  
  if (failed > 0) {
    console.log('\n❌ Failed migrations:')
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.file}: ${r.error}`))
    
    process.exit(1)
  }
  
  // Run post-migration optimizations
  await runPostMigrationOptimizations()
  
  console.log('\n✅ Database setup completed successfully!')
}

async function runPostMigrationOptimizations() {
  console.log('\n🔧 Running post-migration optimizations...')
  
  const optimizations = [
    {
      name: 'Create initial partitions',
      sql: `
        SELECT create_monthly_api_metrics_partition(CURRENT_DATE);
        SELECT create_monthly_api_metrics_partition(CURRENT_DATE + INTERVAL '1 month');
        SELECT create_daily_resource_metrics_partition(CURRENT_DATE);
        SELECT create_daily_resource_metrics_partition(CURRENT_DATE + INTERVAL '1 day');
      `
    },
    {
      name: 'Refresh materialized views',
      sql: 'SELECT refresh_materialized_views();'
    },
    {
      name: 'Update table statistics',
      sql: 'ANALYZE;'
    },
    {
      name: 'Vacuum tables',
      sql: 'VACUUM ANALYZE;'
    }
  ]
  
  for (const optimization of optimizations) {
    try {
      console.log(`  Running: ${optimization.name}`)
      const { error } = await supabase.rpc('exec_sql', { sql: optimization.sql })
      
      if (error) {
        console.warn(`  ⚠️  Warning in ${optimization.name}: ${error.message}`)
      } else {
        console.log(`  ✅ ${optimization.name} completed`)
      }
    } catch (error) {
      console.warn(`  ⚠️  Warning in ${optimization.name}: ${error}`)
    }
  }
}

async function verifyDatabaseSetup() {
  console.log('\n🔍 Verifying database setup...')
  
  const checks = [
    {
      name: 'Check required tables exist',
      sql: `
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'papers', 'user_evaluations', 'ai_analyses', 'background_jobs',
          'notifications', 'api_metrics', 'system_resource_metrics'
        )
      `
    },
    {
      name: 'Check partitions created',
      sql: `
        SELECT COUNT(*) as partition_count 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'api_metrics_%' OR tablename LIKE 'system_resource_metrics_%')
      `
    },
    {
      name: 'Check indexes created',
      sql: `
        SELECT COUNT(*) as index_count 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
      `
    },
    {
      name: 'Check RLS policies',
      sql: `
        SELECT COUNT(*) as policy_count 
        FROM pg_policies 
        WHERE schemaname = 'public'
      `
    }
  ]
  
  for (const check of checks) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: check.sql })
      
      if (error) {
        console.error(`  ❌ ${check.name}: ${error.message}`)
      } else {
        console.log(`  ✅ ${check.name}: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      console.error(`  ❌ ${check.name}: ${error}`)
    }
  }
}

// Main execution
async function main() {
  try {
    await setupDatabase()
    await verifyDatabaseSetup()
    
    console.log('\n🎉 Database setup and optimization completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Run tests to verify functionality')
    console.log('2. Set up monitoring for partition maintenance')
    console.log('3. Configure automated maintenance jobs')
    
  } catch (error) {
    console.error('\n💥 Database setup failed:', error)
    process.exit(1)
  }
}

// Handle script execution
if (require.main === module) {
  main()
}

export { setupDatabase, verifyDatabaseSetup }