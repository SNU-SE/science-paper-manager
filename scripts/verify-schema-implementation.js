#!/usr/bin/env node

/**
 * Schema Implementation Verification Script
 * 
 * This script verifies that all database schema components are properly implemented
 * without requiring external dependencies.
 */

const fs = require('fs');
const path = require('path');

class SchemaVerifier {
  constructor() {
    this.results = [];
    this.migrationsDir = path.join(process.cwd(), 'database', 'migrations');
  }

  verify() {
    console.log('🔍 Verifying database schema implementation...');
    console.log('=' .repeat(60));

    this.verifyMigrationFiles();
    this.verifySchemaOptimization();
    this.verifyScripts();
    this.printSummary();
  }

  verifyMigrationFiles() {
    console.log('\n📁 Verifying migration files...');

    const requiredMigrations = [
      '001_initial_schema.sql',
      '004_background_jobs.sql',
      '006_performance_monitoring.sql',
      '008_notifications_system.sql',
      '010_api_usage_tracking.sql',
      '011_health_monitoring.sql',
      '012_schema_optimization_consolidation.sql'
    ];

    for (const migration of requiredMigrations) {
      const filePath = path.join(this.migrationsDir, migration);
      const exists = fs.existsSync(filePath);
      
      this.addResult('Migration Files', `${migration} exists`, exists);
      
      if (exists) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.verifyMigrationContent(migration, content);
      }
    }
  }

  verifyMigrationContent(fileName, content) {
    const checks = {
      'CREATE TABLE': content.includes('CREATE TABLE'),
      'CREATE INDEX': content.includes('CREATE INDEX'),
      'RLS Policies': content.includes('ROW LEVEL SECURITY') || content.includes('CREATE POLICY'),
      'Functions': content.includes('CREATE OR REPLACE FUNCTION'),
      'Comments': content.includes('COMMENT ON')
    };

    for (const [check, passed] of Object.entries(checks)) {
      this.addResult('Migration Content', `${fileName} - ${check}`, passed);
    }
  }

  verifySchemaOptimization() {
    console.log('\n🚀 Verifying schema optimization migration...');

    const optimizationFile = path.join(this.migrationsDir, '012_schema_optimization_consolidation.sql');
    
    if (!fs.existsSync(optimizationFile)) {
      this.addResult('Schema Optimization', 'Optimization migration exists', false);
      return;
    }

    const content = fs.readFileSync(optimizationFile, 'utf-8');

    const optimizationChecks = {
      'Advanced Indexing': content.includes('CREATE INDEX CONCURRENTLY'),
      'Partitioning': content.includes('PARTITION BY RANGE'),
      'Materialized Views': content.includes('CREATE MATERIALIZED VIEW'),
      'Maintenance Functions': content.includes('maintain_partitions'),
      'Performance Functions': content.includes('get_database_performance_metrics'),
      'Automated Cleanup': content.includes('cleanup_old_data'),
      'RLS Optimization': content.includes('Enhanced RLS'),
      'Grants and Permissions': content.includes('GRANT')
    };

    for (const [check, passed] of Object.entries(optimizationChecks)) {
      this.addResult('Schema Optimization', check, passed);
    }
  }

  verifyScripts() {
    console.log('\n📜 Verifying setup scripts...');

    const scripts = [
      'scripts/setup-optimized-database.ts',
      'scripts/validate-database-schema.ts'
    ];

    for (const script of scripts) {
      const filePath = path.join(process.cwd(), script);
      const exists = fs.existsSync(filePath);
      
      this.addResult('Setup Scripts', `${script} exists`, exists);
      
      if (exists) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.verifyScriptContent(script, content);
      }
    }
  }

  verifyScriptContent(scriptName, content) {
    const scriptChecks = {
      'TypeScript': content.includes('interface') && content.includes('async function'),
      'Error Handling': content.includes('try') && content.includes('catch'),
      'Supabase Integration': content.includes('@supabase/supabase-js'),
      'Migration Execution': content.includes('runMigration') || content.includes('validateTables'),
      'Logging': content.includes('console.log')
    };

    for (const [check, passed] of Object.entries(scriptChecks)) {
      this.addResult('Script Content', `${scriptName} - ${check}`, passed);
    }
  }

  addResult(category, test, passed) {
    this.results.push({ category, test, passed });
    
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${test}`);
  }

  printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Verification Summary');
    console.log('=' .repeat(60));

    const categories = [...new Set(this.results.map(r => r.category))];
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      
      console.log(`\n${category}: ${passed}/${total} passed`);
      
      const failed = categoryResults.filter(r => !r.passed);
      if (failed.length > 0) {
        failed.forEach(f => console.log(`  ❌ ${f.test}`));
      }
    }

    const totalPassed = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const successRate = Math.round((totalPassed / totalTests) * 100);

    console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed (${successRate}%)`);
    
    if (successRate === 100) {
      console.log('\n🎉 All verifications passed! Schema implementation is complete.');
    } else if (successRate >= 90) {
      console.log('\n⚠️  Most verifications passed, but some components may need attention.');
    } else {
      console.log('\n❌ Significant issues found. Schema implementation needs review.');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Run: npm run setup-db:optimized');
    console.log('2. Run: npm run validate-db:schema');
    console.log('3. Test the optimized schema with your application');
    console.log('4. Monitor performance improvements');
  }
}

// Run verification
const verifier = new SchemaVerifier();
verifier.verify();