#!/usr/bin/env tsx

/**
 * Database Schema Validation Script
 * 
 * This script validates that all database optimizations, indexes, partitions,
 * and RLS policies are correctly implemented.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface ValidationResult {
  category: string
  test: string
  passed: boolean
  details?: any
  error?: string
}

class DatabaseValidator {
  private results: ValidationResult[] = []

  async runValidation(): Promise<ValidationResult[]> {
    console.log('🔍 Starting database schema validation...')
    console.log('=' .repeat(60))

    await this.validateTables()
    await this.validateIndexes()
    await this.validatePartitions()
    await this.validateRLSPolicies()
    await this.validateFunctions()
    await this.validateTriggers()
    await this.validateMaterializedViews()
    await this.validatePerformanceOptimizations()

    return this.results
  }

  private async validateTables() {
    console.log('\n📋 Validating tables...')

    const requiredTables = [
      'papers',
      'user_evaluations', 
      'ai_analyses',
      'background_jobs',
      'job_progress',
      'job_failures',
      'notifications',
      'notification_settings',
      'notification_delivery_log',
      'api_metrics',
      'db_query_metrics',
      'user_activity_metrics',
      'system_metrics',
      'api_usage_tracking',
      'daily_usage_summary',
      'user_rate_limits',
      'suspicious_activity_log',
      'usage_statistics',
      'backup_records',
      'backup_schedules',
      'health_check_results',
      'system_resource_metrics',
      'resource_alerts',
      'recovery_attempts',
      'service_status_history',
      'maintenance_log'
    ]

    for (const tableName of requiredTables) {
      await this.checkTableExists(tableName)
    }
  }

  private async checkTableExists(tableName: string) {
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .single()

      if (error || !data) {
        this.addResult('Tables', `Table ${tableName} exists`, false, null, error?.message)
      } else {
        this.addResult('Tables', `Table ${tableName} exists`, true, data)
      }
    } catch (error) {
      this.addResult('Tables', `Table ${tableName} exists`, false, null, String(error))
    }
  }

  private async validateIndexes() {
    console.log('\n📊 Validating indexes...')

    const criticalIndexes = [
      'idx_papers_composite_search',
      'idx_user_evaluations_rating_tags',
      'idx_ai_analyses_composite',
      'idx_papers_fulltext_search',
      'idx_background_jobs_queue_processing',
      'idx_background_jobs_user_recent',
      'idx_notifications_user_unread',
      'idx_api_metrics_time_series',
      'idx_user_statistics_user_id'
    ]

    for (const indexName of criticalIndexes) {
      await this.checkIndexExists(indexName)
    }
  }

  private async checkIndexExists(indexName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname, tablename, indexdef 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = '${indexName}'
        `
      })

      if (error) {
        this.addResult('Indexes', `Index ${indexName} exists`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Indexes', `Index ${indexName} exists`, false, null, 'Index not found')
      } else {
        this.addResult('Indexes', `Index ${indexName} exists`, true, data[0])
      }
    } catch (error) {
      this.addResult('Indexes', `Index ${indexName} exists`, false, null, String(error))
    }
  }

  private async validatePartitions() {
    console.log('\n🗂️  Validating partitions...')

    // Check if api_metrics is partitioned
    await this.checkTablePartitioned('api_metrics')
    
    // Check if system_resource_metrics is partitioned
    await this.checkTablePartitioned('system_resource_metrics')

    // Check for existing partitions
    await this.checkPartitionsExist()
  }

  private async checkTablePartitioned(tableName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, partitiontype 
          FROM pg_partitioned_table 
          WHERE schemaname = 'public' 
          AND tablename = '${tableName}'
        `
      })

      if (error) {
        this.addResult('Partitions', `Table ${tableName} is partitioned`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Partitions', `Table ${tableName} is partitioned`, false, null, 'Table is not partitioned')
      } else {
        this.addResult('Partitions', `Table ${tableName} is partitioned`, true, data[0])
      }
    } catch (error) {
      this.addResult('Partitions', `Table ${tableName} is partitioned`, false, null, String(error))
    }
  }

  private async checkPartitionsExist() {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT COUNT(*) as partition_count 
          FROM pg_tables 
          WHERE schemaname = 'public' 
          AND (tablename LIKE 'api_metrics_%' OR tablename LIKE 'system_resource_metrics_%')
        `
      })

      if (error) {
        this.addResult('Partitions', 'Partition tables exist', false, null, error.message)
      } else {
        const count = data[0]?.partition_count || 0
        this.addResult('Partitions', 'Partition tables exist', count > 0, { partition_count: count })
      }
    } catch (error) {
      this.addResult('Partitions', 'Partition tables exist', false, null, String(error))
    }
  }

  private async validateRLSPolicies() {
    console.log('\n🔒 Validating RLS policies...')

    const tablesWithRLS = [
      'papers',
      'user_evaluations',
      'ai_analyses',
      'background_jobs',
      'notifications',
      'api_metrics',
      'api_usage_tracking',
      'health_check_results'
    ]

    for (const tableName of tablesWithRLS) {
      await this.checkRLSEnabled(tableName)
      await this.checkRLSPolicies(tableName)
    }
  }

  private async checkRLSEnabled(tableName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT tablename, rowsecurity 
          FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = '${tableName}'
        `
      })

      if (error) {
        this.addResult('RLS', `RLS enabled on ${tableName}`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('RLS', `RLS enabled on ${tableName}`, false, null, 'Table not found')
      } else {
        const rlsEnabled = data[0]?.rowsecurity === true
        this.addResult('RLS', `RLS enabled on ${tableName}`, rlsEnabled, data[0])
      }
    } catch (error) {
      this.addResult('RLS', `RLS enabled on ${tableName}`, false, null, String(error))
    }
  }

  private async checkRLSPolicies(tableName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT COUNT(*) as policy_count 
          FROM pg_policies 
          WHERE schemaname = 'public' 
          AND tablename = '${tableName}'
        `
      })

      if (error) {
        this.addResult('RLS', `Policies exist for ${tableName}`, false, null, error.message)
      } else {
        const count = data[0]?.policy_count || 0
        this.addResult('RLS', `Policies exist for ${tableName}`, count > 0, { policy_count: count })
      }
    } catch (error) {
      this.addResult('RLS', `Policies exist for ${tableName}`, false, null, String(error))
    }
  }

  private async validateFunctions() {
    console.log('\n⚙️  Validating functions...')

    const requiredFunctions = [
      'create_monthly_api_metrics_partition',
      'create_daily_resource_metrics_partition',
      'maintain_partitions',
      'get_database_performance_metrics',
      'analyze_slow_queries',
      'run_maintenance_tasks',
      'refresh_materialized_views',
      'cleanup_old_metrics',
      'cleanup_old_jobs',
      'update_daily_usage_summary',
      'check_rate_limit',
      'detect_suspicious_activity'
    ]

    for (const functionName of requiredFunctions) {
      await this.checkFunctionExists(functionName)
    }
  }

  private async checkFunctionExists(functionName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT proname, pronargs 
          FROM pg_proc 
          WHERE proname = '${functionName}' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `
      })

      if (error) {
        this.addResult('Functions', `Function ${functionName} exists`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Functions', `Function ${functionName} exists`, false, null, 'Function not found')
      } else {
        this.addResult('Functions', `Function ${functionName} exists`, true, data[0])
      }
    } catch (error) {
      this.addResult('Functions', `Function ${functionName} exists`, false, null, String(error))
    }
  }

  private async validateTriggers() {
    console.log('\n🎯 Validating triggers...')

    const requiredTriggers = [
      { table: 'background_jobs', trigger: 'trigger_update_job_status' },
      { table: 'api_usage_tracking', trigger: 'trigger_update_daily_usage_summary' },
      { table: 'notification_settings', trigger: 'update_notification_settings_updated_at' },
      { table: 'papers', trigger: 'update_papers_last_modified' },
      { table: 'user_evaluations', trigger: 'update_user_evaluations_updated_at' }
    ]

    for (const { table, trigger } of requiredTriggers) {
      await this.checkTriggerExists(table, trigger)
    }
  }

  private async checkTriggerExists(tableName: string, triggerName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT tgname, tgrelid::regclass as table_name 
          FROM pg_trigger 
          WHERE tgname = '${triggerName}' 
          AND tgrelid = '${tableName}'::regclass
        `
      })

      if (error) {
        this.addResult('Triggers', `Trigger ${triggerName} on ${tableName}`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Triggers', `Trigger ${triggerName} on ${tableName}`, false, null, 'Trigger not found')
      } else {
        this.addResult('Triggers', `Trigger ${triggerName} on ${tableName}`, true, data[0])
      }
    } catch (error) {
      this.addResult('Triggers', `Trigger ${triggerName} on ${tableName}`, false, null, String(error))
    }
  }

  private async validateMaterializedViews() {
    console.log('\n📈 Validating materialized views...')

    const requiredViews = [
      'user_statistics',
      'performance_summary',
      'slow_queries',
      'user_activity_summary'
    ]

    for (const viewName of requiredViews) {
      await this.checkMaterializedViewExists(viewName)
    }
  }

  private async checkMaterializedViewExists(viewName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT matviewname, ispopulated 
          FROM pg_matviews 
          WHERE schemaname = 'public' 
          AND matviewname = '${viewName}'
        `
      })

      if (error) {
        this.addResult('Materialized Views', `View ${viewName} exists`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Materialized Views', `View ${viewName} exists`, false, null, 'View not found')
      } else {
        this.addResult('Materialized Views', `View ${viewName} exists`, true, data[0])
      }
    } catch (error) {
      this.addResult('Materialized Views', `View ${viewName} exists`, false, null, String(error))
    }
  }

  private async validatePerformanceOptimizations() {
    console.log('\n🚀 Validating performance optimizations...')

    // Check if pg_stat_statements is enabled
    await this.checkExtensionEnabled('pg_stat_statements')
    
    // Check if btree_gin is enabled
    await this.checkExtensionEnabled('btree_gin')

    // Validate table statistics are up to date
    await this.checkTableStatistics()
  }

  private async checkExtensionEnabled(extensionName: string) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT extname, extversion 
          FROM pg_extension 
          WHERE extname = '${extensionName}'
        `
      })

      if (error) {
        this.addResult('Extensions', `Extension ${extensionName} enabled`, false, null, error.message)
      } else if (!data || data.length === 0) {
        this.addResult('Extensions', `Extension ${extensionName} enabled`, false, null, 'Extension not found')
      } else {
        this.addResult('Extensions', `Extension ${extensionName} enabled`, true, data[0])
      }
    } catch (error) {
      this.addResult('Extensions', `Extension ${extensionName} enabled`, false, null, String(error))
    }
  }

  private async checkTableStatistics() {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, last_analyze 
          FROM pg_stat_user_tables 
          WHERE schemaname = 'public' 
          AND last_analyze IS NOT NULL
          ORDER BY last_analyze DESC
          LIMIT 5
        `
      })

      if (error) {
        this.addResult('Performance', 'Table statistics updated', false, null, error.message)
      } else {
        const hasRecentStats = data && data.length > 0
        this.addResult('Performance', 'Table statistics updated', hasRecentStats, data)
      }
    } catch (error) {
      this.addResult('Performance', 'Table statistics updated', false, null, String(error))
    }
  }

  private addResult(category: string, test: string, passed: boolean, details?: any, error?: string) {
    this.results.push({ category, test, passed, details, error })
    
    const status = passed ? '✅' : '❌'
    console.log(`  ${status} ${test}`)
    
    if (error) {
      console.log(`    Error: ${error}`)
    }
  }

  printSummary() {
    console.log('\n' + '=' .repeat(60))
    console.log('📊 Validation Summary')
    console.log('=' .repeat(60))

    const categories = [...new Set(this.results.map(r => r.category))]
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category)
      const passed = categoryResults.filter(r => r.passed).length
      const total = categoryResults.length
      
      console.log(`\n${category}: ${passed}/${total} passed`)
      
      const failed = categoryResults.filter(r => !r.passed)
      if (failed.length > 0) {
        failed.forEach(f => console.log(`  ❌ ${f.test}: ${f.error || 'Failed'}`))
      }
    }

    const totalPassed = this.results.filter(r => r.passed).length
    const totalTests = this.results.length
    const successRate = Math.round((totalPassed / totalTests) * 100)

    console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed (${successRate}%)`)
    
    if (successRate === 100) {
      console.log('\n🎉 All validations passed! Database schema is optimally configured.')
    } else if (successRate >= 90) {
      console.log('\n⚠️  Most validations passed, but some optimizations may be missing.')
    } else {
      console.log('\n❌ Significant issues found. Database schema needs attention.')
    }
  }
}

async function main() {
  const validator = new DatabaseValidator()
  
  try {
    await validator.runValidation()
    validator.printSummary()
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  }
}

// Handle script execution
if (require.main === module) {
  main()
}

export { DatabaseValidator }