#!/usr/bin/env tsx

/**
 * Simple Integration Check
 * Basic verification that core components are accessible
 */

interface CheckResult {
  component: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  duration: number
}

class SimpleIntegrationChecker {
  private results: CheckResult[] = []

  async runChecks(): Promise<CheckResult[]> {
    console.log('🔍 Running Simple Integration Checks...\n')

    await this.checkEnvironmentVariables()
    await this.checkDatabaseConnection()
    await this.checkRedisConnection()
    await this.checkFileSystem()
    await this.checkNodeModules()

    return this.results
  }

  private async checkEnvironmentVariables(): Promise<void> {
    const startTime = Date.now()
    
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REDIS_URL',
      'NEXTAUTH_SECRET'
    ]

    const missingVars = requiredVars.filter(varName => !process.env[varName])

    if (missingVars.length === 0) {
      this.addResult({
        component: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables are set',
        duration: Date.now() - startTime
      })
    } else {
      this.addResult({
        component: 'Environment Variables',
        status: 'fail',
        message: `Missing variables: ${missingVars.join(', ')}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async checkDatabaseConnection(): Promise<void> {
    const startTime = Date.now()

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.addResult({
        component: 'Database Connection',
        status: 'skip',
        message: 'Skipped - environment variables not configured',
        duration: Date.now() - startTime
      })
      return
    }

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data, error } = await supabase
        .from('papers')
        .select('count')
        .limit(1)

      if (error) throw error

      this.addResult({
        component: 'Database Connection',
        status: 'pass',
        message: 'Database connection successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Database Connection',
        status: 'fail',
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async checkRedisConnection(): Promise<void> {
    const startTime = Date.now()

    if (!process.env.REDIS_URL) {
      this.addResult({
        component: 'Redis Connection',
        status: 'skip',
        message: 'Skipped - REDIS_URL not configured',
        duration: Date.now() - startTime
      })
      return
    }

    try {
      const Redis = (await import('ioredis')).default
      const redis = new Redis(process.env.REDIS_URL!)

      await redis.ping()
      await redis.disconnect()

      this.addResult({
        component: 'Redis Connection',
        status: 'pass',
        message: 'Redis connection successful',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Redis Connection',
        status: 'fail',
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async checkFileSystem(): Promise<void> {
    const startTime = Date.now()

    try {
      const fs = await import('fs')
      const path = await import('path')

      // Check if key directories exist
      const directories = [
        'src/services',
        'src/components',
        'src/app',
        'database/migrations',
        'scripts'
      ]

      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          throw new Error(`Directory ${dir} does not exist`)
        }
      }

      // Check if key files exist
      const files = [
        'package.json',
        'next.config.ts',
        'tsconfig.json',
        'tailwind.config.ts'
      ]

      for (const file of files) {
        if (!fs.existsSync(file)) {
          throw new Error(`File ${file} does not exist`)
        }
      }

      this.addResult({
        component: 'File System',
        status: 'pass',
        message: 'All required directories and files exist',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'File System',
        status: 'fail',
        message: `File system check failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private async checkNodeModules(): Promise<void> {
    const startTime = Date.now()

    try {
      // Try to import key dependencies
      await import('@supabase/supabase-js')
      await import('ioredis')
      await import('next')
      await import('react')
      await import('bullmq')

      this.addResult({
        component: 'Node Modules',
        status: 'pass',
        message: 'All key dependencies are available',
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.addResult({
        component: 'Node Modules',
        status: 'fail',
        message: `Dependency check failed: ${error.message}`,
        duration: Date.now() - startTime
      })
    }
  }

  private addResult(result: CheckResult): void {
    this.results.push(result)
    
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌'
    console.log(`${statusIcon} ${result.component}: ${result.message} (${result.duration}ms)`)
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'pass').length
    const failed = this.results.filter(r => r.status === 'fail').length
    const skipped = this.results.filter(r => r.status === 'skip').length

    let report = '# Simple Integration Check Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`
    report += `- **Passed**: ${passed}\n`
    report += `- **Failed**: ${failed}\n`
    report += `- **Skipped**: ${skipped}\n`
    report += `- **Total**: ${this.results.length}\n\n`

    if (failed === 0) {
      report += '✅ **All available checks passed**\n\n'
    } else {
      report += '❌ **Some checks failed**\n\n'
    }

    report += '## Check Results\n\n'
    
    for (const result of this.results) {
      const statusIcon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌'
      report += `### ${statusIcon} ${result.component}\n\n`
      report += `- **Status**: ${result.status}\n`
      report += `- **Message**: ${result.message}\n`
      report += `- **Duration**: ${result.duration}ms\n\n`
    }

    return report
  }
}

async function main() {
  const checker = new SimpleIntegrationChecker()
  
  try {
    const results = await checker.runChecks()
    const report = checker.generateReport()
    
    console.log('\n📊 Integration Check Summary:')
    console.log('=' .repeat(40))
    
    const passed = results.filter(r => r.status === 'pass').length
    const failed = results.filter(r => r.status === 'fail').length
    const skipped = results.filter(r => r.status === 'skip').length
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`📈 Total: ${results.length}`)
    
    if (failed > 0) {
      console.log('\n❌ Some checks failed - review configuration')
      process.exit(1)
    } else {
      console.log('\n🎉 All available checks passed!')
    }
    
  } catch (error) {
    console.error('❌ Integration check failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { SimpleIntegrationChecker }