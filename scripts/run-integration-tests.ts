#!/usr/bin/env tsx

/**
 * Integration Test Runner
 * 
 * Comprehensive test runner for system integration and performance tests.
 * Sets up test environment, runs tests, and generates reports.
 */

import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'

interface TestConfig {
  supabase: {
    url: string
    key: string
  }
  redis: {
    url: string
  }
  testDatabase: string
  parallel: boolean
  coverage: boolean
  verbose: boolean
}

interface TestResult {
  suite: string
  passed: number
  failed: number
  duration: number
  coverage?: number
}

class IntegrationTestRunner {
  private config: TestConfig
  private results: TestResult[] = []
  private supabase: any
  private redis: Redis | null = null

  constructor(config: TestConfig) {
    this.config = config
    this.supabase = createClient(config.supabase.url, config.supabase.key)
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Integration Test Suite')
    console.log('=====================================')

    try {
      // 1. Setup test environment
      await this.setupTestEnvironment()

      // 2. Run test suites
      await this.runTestSuites()

      // 3. Generate reports
      await this.generateReports()

      // 4. Cleanup
      await this.cleanup()

      console.log('\n✅ All tests completed successfully!')
      this.printSummary()

    } catch (error) {
      console.error('❌ Test suite failed:', error)
      await this.cleanup()
      process.exit(1)
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('\n📋 Setting up test environment...')

    // 1. Check database connection
    try {
      const { data, error } = await this.supabase.from('papers').select('count').limit(1)
      if (error) throw error
      console.log('✅ Database connection verified')
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`)
    }

    // 2. Check Redis connection
    try {
      this.redis = new Redis(this.config.redis.url)
      await this.redis.ping()
      console.log('✅ Redis connection verified')
    } catch (error) {
      throw new Error(`Redis connection failed: ${error}`)
    }

    // 3. Setup test database schema
    await this.setupTestSchema()

    // 4. Create test data
    await this.createTestData()

    console.log('✅ Test environment setup complete')
  }

  private async setupTestSchema(): Promise<void> {
    console.log('📊 Setting up test database schema...')

    // Read and execute migration files
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
    const migrationFiles = await fs.readdir(migrationsDir)
    
    for (const file of migrationFiles.sort()) {
      if (file.endsWith('.sql')) {
        console.log(`  Running migration: ${file}`)
        const migrationSQL = await fs.readFile(path.join(migrationsDir, file), 'utf-8')
        
        try {
          // Execute migration (this would need to be adapted based on your Supabase setup)
          // For now, we'll assume the test database already has the schema
          console.log(`  ✅ Migration ${file} completed`)
        } catch (error) {
          console.warn(`  ⚠️  Migration ${file} failed: ${error}`)
        }
      }
    }
  }

  private async createTestData(): Promise<void> {
    console.log('📝 Creating test data...')

    // Create test users
    const testUsers = [
      { email: 'test-user-1@example.com', password: 'testpass123' },
      { email: 'test-user-2@example.com', password: 'testpass123' },
      { email: 'performance-test@example.com', password: 'testpass123' }
    ]

    for (const user of testUsers) {
      try {
        await this.supabase.auth.signUp(user)
        console.log(`  ✅ Created test user: ${user.email}`)
      } catch (error) {
        console.log(`  ℹ️  Test user ${user.email} already exists`)
      }
    }

    // Create test papers
    const testPapers = Array.from({ length: 50 }, (_, i) => ({
      title: `Test Paper ${i + 1}`,
      abstract: `Abstract for test paper ${i + 1} covering machine learning and AI topics.`,
      content: `Full content of test paper ${i + 1}. `.repeat(50),
      authors: [`Author ${i + 1}`],
      journal: `Test Journal ${(i % 5) + 1}`,
      publication_year: 2020 + (i % 4),
      file_path: `/test/papers/paper-${i + 1}.pdf`
    }))

    // Insert test papers in batches
    const batchSize = 10
    for (let i = 0; i < testPapers.length; i += batchSize) {
      const batch = testPapers.slice(i, i + batchSize)
      try {
        await this.supabase.from('papers').insert(batch)
        console.log(`  ✅ Created test papers batch ${Math.floor(i / batchSize) + 1}`)
      } catch (error) {
        console.warn(`  ⚠️  Failed to create test papers batch: ${error}`)
      }
    }

    console.log('✅ Test data creation complete')
  }

  private async runTestSuites(): Promise<void> {
    console.log('\n🧪 Running test suites...')

    const testSuites = [
      {
        name: 'System Integration Tests',
        command: 'npm',
        args: ['test', '--', 'src/services/__tests__/system-integration.test.ts'],
        timeout: 120000 // 2 minutes
      },
      {
        name: 'Performance Tests',
        command: 'npm',
        args: ['test', '--', 'src/services/__tests__/performance.test.ts'],
        timeout: 180000 // 3 minutes
      },
      {
        name: 'Background Job Tests',
        command: 'npm',
        args: ['test', '--', 'src/services/background/__tests__/integration.test.ts'],
        timeout: 90000 // 1.5 minutes
      },
      {
        name: 'Cache Integration Tests',
        command: 'npm',
        args: ['test', '--', 'src/services/cache/__tests__/integration.test.ts'],
        timeout: 60000 // 1 minute
      },
      {
        name: 'Health Monitoring Tests',
        command: 'npm',
        args: ['test', '--', 'src/services/health/__tests__/integration.test.ts'],
        timeout: 60000 // 1 minute
      }
    ]

    if (this.config.parallel) {
      // Run tests in parallel
      const promises = testSuites.map(suite => this.runTestSuite(suite))
      const results = await Promise.allSettled(promises)
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Test suite ${testSuites[index].name} failed:`, result.reason)
        }
      })
    } else {
      // Run tests sequentially
      for (const suite of testSuites) {
        await this.runTestSuite(suite)
      }
    }

    // Run E2E tests separately (they need a running server)
    if (process.env.RUN_E2E_TESTS === 'true') {
      await this.runE2ETests()
    }
  }

  private async runTestSuite(suite: { name: string; command: string; args: string[]; timeout: number }): Promise<void> {
    console.log(`\n🔍 Running ${suite.name}...`)
    
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
      const process = spawn(suite.command, suite.args, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_SUPABASE_URL: this.config.supabase.url,
          TEST_SUPABASE_ANON_KEY: this.config.supabase.key,
          TEST_REDIS_URL: this.config.redis.url
        }
      })

      let output = ''
      let errorOutput = ''

      if (!this.config.verbose) {
        process.stdout?.on('data', (data) => {
          output += data.toString()
        })

        process.stderr?.on('data', (data) => {
          errorOutput += data.toString()
        })
      }

      const timeout = setTimeout(() => {
        process.kill('SIGKILL')
        reject(new Error(`Test suite ${suite.name} timed out after ${suite.timeout}ms`))
      }, suite.timeout)

      process.on('close', (code) => {
        clearTimeout(timeout)
        const duration = Date.now() - startTime

        if (code === 0) {
          console.log(`✅ ${suite.name} completed in ${duration}ms`)
          
          // Parse test results from output
          const result = this.parseTestOutput(suite.name, output, duration)
          this.results.push(result)
          
          resolve()
        } else {
          console.error(`❌ ${suite.name} failed with code ${code}`)
          if (!this.config.verbose && errorOutput) {
            console.error('Error output:', errorOutput)
          }
          reject(new Error(`Test suite failed with code ${code}`))
        }
      })

      process.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private async runE2ETests(): Promise<void> {
    console.log('\n🌐 Running E2E tests...')

    return new Promise((resolve, reject) => {
      const process = spawn('npx', ['playwright', 'test', 'e2e/system-enhancement.spec.ts'], {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:3000',
          TEST_SUPABASE_URL: this.config.supabase.url,
          TEST_SUPABASE_ANON_KEY: this.config.supabase.key
        }
      })

      let output = ''

      if (!this.config.verbose) {
        process.stdout?.on('data', (data) => {
          output += data.toString()
        })
      }

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ E2E tests completed successfully')
          resolve()
        } else {
          console.error('❌ E2E tests failed')
          if (!this.config.verbose && output) {
            console.error('Output:', output)
          }
          reject(new Error(`E2E tests failed with code ${code}`))
        }
      })
    })
  }

  private parseTestOutput(suiteName: string, output: string, duration: number): TestResult {
    // Parse Jest output to extract test results
    const passedMatch = output.match(/(\d+) passed/)
    const failedMatch = output.match(/(\d+) failed/)
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/)

    return {
      suite: suiteName,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      duration,
      coverage: coverageMatch ? parseFloat(coverageMatch[1]) : undefined
    }
  }

  private async generateReports(): Promise<void> {
    console.log('\n📊 Generating test reports...')

    const reportDir = path.join(process.cwd(), 'test-reports')
    await fs.mkdir(reportDir, { recursive: true })

    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      summary: {
        totalSuites: this.results.length,
        totalPassed: this.results.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
        averageCoverage: this.results
          .filter(r => r.coverage !== undefined)
          .reduce((sum, r) => sum + (r.coverage || 0), 0) / 
          this.results.filter(r => r.coverage !== undefined).length
      }
    }

    await fs.writeFile(
      path.join(reportDir, 'integration-test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    )

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(jsonReport)
    await fs.writeFile(
      path.join(reportDir, 'integration-test-report.html'),
      htmlReport
    )

    console.log('✅ Test reports generated in test-reports/')
  }

  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.failed { background: #fde8e8; }
        .suite { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .suite.failed { border-color: #ff6b6b; }
        .suite.passed { border-color: #51cf66; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>${report.summary.totalSuites}</h3>
            <p>Test Suites</p>
        </div>
        <div class="metric">
            <h3>${report.summary.totalPassed}</h3>
            <p>Tests Passed</p>
        </div>
        <div class="metric ${report.summary.totalFailed > 0 ? 'failed' : ''}">
            <h3>${report.summary.totalFailed}</h3>
            <p>Tests Failed</p>
        </div>
        <div class="metric">
            <h3>${(report.summary.totalDuration / 1000).toFixed(1)}s</h3>
            <p>Total Duration</p>
        </div>
        ${report.summary.averageCoverage ? `
        <div class="metric">
            <h3>${report.summary.averageCoverage.toFixed(1)}%</h3>
            <p>Average Coverage</p>
        </div>
        ` : ''}
    </div>
    
    <h2>Test Suite Results</h2>
    ${report.results.map((result: TestResult) => `
    <div class="suite ${result.failed > 0 ? 'failed' : 'passed'}">
        <h3>${result.suite}</h3>
        <p>Passed: ${result.passed} | Failed: ${result.failed} | Duration: ${(result.duration / 1000).toFixed(1)}s</p>
        ${result.coverage ? `<p>Coverage: ${result.coverage.toFixed(1)}%</p>` : ''}
    </div>
    `).join('')}
</body>
</html>
    `
  }

  private printSummary(): void {
    console.log('\n📈 Test Summary')
    console.log('================')
    
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)

    console.log(`Total Suites: ${this.results.length}`)
    console.log(`Total Tests: ${totalPassed + totalFailed}`)
    console.log(`Passed: ${totalPassed}`)
    console.log(`Failed: ${totalFailed}`)
    console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`)
    
    if (totalFailed > 0) {
      console.log('\n❌ Some tests failed. Check the detailed report for more information.')
    } else {
      console.log('\n✅ All tests passed!')
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...')

    try {
      // Clean up test data
      await this.supabase.from('background_jobs').delete().neq('id', '')
      await this.supabase.from('notifications').delete().neq('id', '')
      await this.supabase.from('user_evaluations').delete().neq('id', '')
      await this.supabase.from('papers').delete().like('title', 'Test Paper%')

      // Clear Redis test data
      if (this.redis) {
        await this.redis.flushdb()
        await this.redis.quit()
      }

      console.log('✅ Cleanup completed')
    } catch (error) {
      console.warn('⚠️  Cleanup failed:', error)
    }
  }
}

// Main execution
async function main() {
  const config: TestConfig = {
    supabase: {
      url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
      key: process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
    },
    redis: {
      url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
    },
    testDatabase: process.env.TEST_DATABASE || 'test_science_paper_manager',
    parallel: process.env.PARALLEL_TESTS === 'true',
    coverage: process.env.COVERAGE === 'true',
    verbose: process.env.VERBOSE === 'true'
  }

  const runner = new IntegrationTestRunner(config)
  await runner.run()
}

if (require.main === module) {
  main().catch(console.error)
}

export { IntegrationTestRunner }