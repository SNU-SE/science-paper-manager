#!/usr/bin/env tsx

/**
 * Production Deployment Verification Script
 * Verifies production environment setup and monitoring configuration
 */

import { createClient } from '@supabase/supabase-js'
import Redis from 'ioredis'
import { HealthCheckService } from '../src/services/health/HealthCheckService'
import { SecurityService } from '../src/services/security/SecurityService'
import { BackupService } from '../src/services/backup/BackupService'
import { PerformanceMonitor } from '../src/services/monitoring/PerformanceMonitor'

interface DeploymentCheck {
  category: string
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  critical: boolean
  details?: any
}

class ProductionDeploymentVerifier {
  private checks: DeploymentCheck[] = []
  private supabase: any
  private redis: Redis

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    this.redis = new Redis(process.env.REDIS_URL!)
  }

  async runAllChecks(): Promise<DeploymentCheck[]> {
    console.log('🚀 Running Production Deployment Verification...\n')

    await this.checkEnvironmentVariables()
    await this.checkDatabaseConfiguration()
    await this.checkRedisConfiguration()
    await this.checkSecurityConfiguration()
    await this.checkMonitoringSetup()
    await this.checkBackupConfiguration()
    await this.checkPerformanceSettings()
    await this.checkHealthChecks()
    await this.checkSSLConfiguration()
    await this.checkRateLimiting()
    await this.checkLoggingConfiguration()
    await this.checkResourceLimits()

    return this.checks
  }

  private async checkEnvironmentVariables(): Promise<void> {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REDIS_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'ENCRYPTION_KEY',
      'BACKUP_ENCRYPTION_KEY',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD'
    ]

    const productionEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'MONITORING_ENABLED',
      'BACKUP_STORAGE_PATH',
      'LOG_LEVEL'
    ]

    let missingVars: string[] = []
    let productionIssues: string[] = []

    // Check required variables
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar)
      }
    }

    // Check production-specific variables
    for (const envVar of productionEnvVars) {
      if (!process.env[envVar]) {
        productionIssues.push(envVar)
      }
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.addCheck({
        category: 'Environment',
        name: 'NODE_ENV Setting',
        status: 'warning',
        message: `NODE_ENV is set to '${process.env.NODE_ENV}', should be 'production'`,
        critical: true
      })
    } else {
      this.addCheck({
        category: 'Environment',
        name: 'NODE_ENV Setting',
        status: 'pass',
        message: 'NODE_ENV correctly set to production',
        critical: true
      })
    }

    if (missingVars.length > 0) {
      this.addCheck({
        category: 'Environment',
        name: 'Required Environment Variables',
        status: 'fail',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        critical: true,
        details: { missingVars }
      })
    } else {
      this.addCheck({
        category: 'Environment',
        name: 'Required Environment Variables',
        status: 'pass',
        message: 'All required environment variables are set',
        critical: true
      })
    }

    if (productionIssues.length > 0) {
      this.addCheck({
        category: 'Environment',
        name: 'Production Environment Variables',
        status: 'warning',
        message: `Missing production-specific variables: ${productionIssues.join(', ')}`,
        critical: false,
        details: { productionIssues }
      })
    }
  }

  private async checkDatabaseConfiguration(): Promise<void> {
    try {
      // Check database connection
      const { data, error } = await this.supabase.from('papers').select('count').limit(1)
      
      if (error) throw error

      this.addCheck({
        category: 'Database',
        name: 'Connection',
        status: 'pass',
        message: 'Database connection successful',
        critical: true
      })

      // Check RLS policies
      const { data: rlsPolicies } = await this.supabase.rpc('check_rls_policies')
      
      if (!rlsPolicies || rlsPolicies.length === 0) {
        this.addCheck({
          category: 'Database',
          name: 'RLS Policies',
          status: 'fail',
          message: 'No RLS policies found - security risk',
          critical: true
        })
      } else {
        this.addCheck({
          category: 'Database',
          name: 'RLS Policies',
          status: 'pass',
          message: `${rlsPolicies.length} RLS policies active`,
          critical: true,
          details: { policyCount: rlsPolicies.length }
        })
      }

      // Check database indexes
      const { data: indexes } = await this.supabase.rpc('check_performance_indexes')
      
      const criticalIndexes = [
        'idx_papers_search_vector',
        'idx_user_evaluations_rating_tags',
        'idx_background_jobs_status',
        'idx_api_metrics_performance'
      ]

      const missingIndexes = criticalIndexes.filter(idx => 
        !indexes?.some(i => i.indexname === idx)
      )

      if (missingIndexes.length > 0) {
        this.addCheck({
          category: 'Database',
          name: 'Performance Indexes',
          status: 'warning',
          message: `Missing performance indexes: ${missingIndexes.join(', ')}`,
          critical: false,
          details: { missingIndexes }
        })
      } else {
        this.addCheck({
          category: 'Database',
          name: 'Performance Indexes',
          status: 'pass',
          message: 'All critical performance indexes are present',
          critical: false
        })
      }

    } catch (error) {
      this.addCheck({
        category: 'Database',
        name: 'Configuration',
        status: 'fail',
        message: `Database configuration check failed: ${error.message}`,
        critical: true
      })
    }
  }

  private async checkRedisConfiguration(): Promise<void> {
    try {
      // Check Redis connection
      await this.redis.ping()
      
      this.addCheck({
        category: 'Redis',
        name: 'Connection',
        status: 'pass',
        message: 'Redis connection successful',
        critical: true
      })

      // Check Redis configuration
      const config = await this.redis.config('GET', '*')
      const configMap = new Map()
      
      for (let i = 0; i < config.length; i += 2) {
        configMap.set(config[i], config[i + 1])
      }

      // Check memory policy
      const maxMemoryPolicy = configMap.get('maxmemory-policy')
      if (maxMemoryPolicy !== 'allkeys-lru' && maxMemoryPolicy !== 'volatile-lru') {
        this.addCheck({
          category: 'Redis',
          name: 'Memory Policy',
          status: 'warning',
          message: `Memory policy is '${maxMemoryPolicy}', recommend 'allkeys-lru' or 'volatile-lru'`,
          critical: false
        })
      } else {
        this.addCheck({
          category: 'Redis',
          name: 'Memory Policy',
          status: 'pass',
          message: `Memory policy correctly set to '${maxMemoryPolicy}'`,
          critical: false
        })
      }

      // Check persistence
      const save = configMap.get('save')
      if (!save || save === '') {
        this.addCheck({
          category: 'Redis',
          name: 'Persistence',
          status: 'warning',
          message: 'Redis persistence not configured - data loss risk',
          critical: false
        })
      } else {
        this.addCheck({
          category: 'Redis',
          name: 'Persistence',
          status: 'pass',
          message: 'Redis persistence configured',
          critical: false
        })
      }

    } catch (error) {
      this.addCheck({
        category: 'Redis',
        name: 'Configuration',
        status: 'fail',
        message: `Redis configuration check failed: ${error.message}`,
        critical: true
      })
    }
  }

  private async checkSecurityConfiguration(): Promise<void> {
    try {
      const security = new SecurityService()

      // Test encryption/decryption
      const testData = 'test-encryption-data'
      const encrypted = await security.encryptAPIKey(testData, 'test-user')
      const decrypted = await security.decryptAPIKey(encrypted, 'test-user')

      if (decrypted === testData) {
        this.addCheck({
          category: 'Security',
          name: 'Encryption',
          status: 'pass',
          message: 'Encryption/decryption working correctly',
          critical: true
        })
      } else {
        this.addCheck({
          category: 'Security',
          name: 'Encryption',
          status: 'fail',
          message: 'Encryption/decryption test failed',
          critical: true
        })
      }

      // Check CSRF token generation
      const csrfToken = security.generateCSRFToken('test-session')
      const isValid = security.validateCSRFToken(csrfToken, 'test-session')

      if (isValid) {
        this.addCheck({
          category: 'Security',
          name: 'CSRF Protection',
          status: 'pass',
          message: 'CSRF token generation and validation working',
          critical: true
        })
      } else {
        this.addCheck({
          category: 'Security',
          name: 'CSRF Protection',
          status: 'fail',
          message: 'CSRF token validation failed',
          critical: true
        })
      }

      // Check encryption key strength
      const encryptionKey = process.env.ENCRYPTION_KEY
      if (!encryptionKey || encryptionKey.length < 32) {
        this.addCheck({
          category: 'Security',
          name: 'Encryption Key Strength',
          status: 'fail',
          message: 'Encryption key is too weak (should be at least 32 characters)',
          critical: true
        })
      } else {
        this.addCheck({
          category: 'Security',
          name: 'Encryption Key Strength',
          status: 'pass',
          message: 'Encryption key meets security requirements',
          critical: true
        })
      }

    } catch (error) {
      this.addCheck({
        category: 'Security',
        name: 'Configuration',
        status: 'fail',
        message: `Security configuration check failed: ${error.message}`,
        critical: true
      })
    }
  }

  private async checkMonitoringSetup(): Promise<void> {
    try {
      const monitor = new PerformanceMonitor()

      // Test metric recording
      await monitor.recordAPIMetric({
        endpoint: '/health',
        method: 'GET',
        statusCode: 200,
        responseTime: 50,
        userId: 'system',
        ipAddress: '127.0.0.1'
      })

      // Test metric retrieval
      const metrics = await monitor.getMetrics({
        start: new Date(Date.now() - 60000),
        end: new Date()
      })

      this.addCheck({
        category: 'Monitoring',
        name: 'Performance Monitoring',
        status: 'pass',
        message: 'Performance monitoring system operational',
        critical: false
      })

      // Check if monitoring is enabled
      if (process.env.MONITORING_ENABLED !== 'true') {
        this.addCheck({
          category: 'Monitoring',
          name: 'Monitoring Enabled',
          status: 'warning',
          message: 'Performance monitoring is disabled',
          critical: false
        })
      } else {
        this.addCheck({
          category: 'Monitoring',
          name: 'Monitoring Enabled',
          status: 'pass',
          message: 'Performance monitoring is enabled',
          critical: false
        })
      }

    } catch (error) {
      this.addCheck({
        category: 'Monitoring',
        name: 'Setup',
        status: 'fail',
        message: `Monitoring setup check failed: ${error.message}`,
        critical: false
      })
    }
  }

  private async checkBackupConfiguration(): Promise<void> {
    try {
      const backup = new BackupService()

      // Check backup storage path
      const backupPath = process.env.BACKUP_STORAGE_PATH
      if (!backupPath) {
        this.addCheck({
          category: 'Backup',
          name: 'Storage Path',
          status: 'fail',
          message: 'Backup storage path not configured',
          critical: true
        })
      } else {
        // Check if path is accessible
        const fs = require('fs')
        try {
          fs.accessSync(backupPath, fs.constants.W_OK)
          this.addCheck({
            category: 'Backup',
            name: 'Storage Path',
            status: 'pass',
            message: 'Backup storage path is accessible',
            critical: true
          })
        } catch {
          this.addCheck({
            category: 'Backup',
            name: 'Storage Path',
            status: 'fail',
            message: 'Backup storage path is not writable',
            critical: true
          })
        }
      }

      // Check backup encryption key
      const backupEncryptionKey = process.env.BACKUP_ENCRYPTION_KEY
      if (!backupEncryptionKey || backupEncryptionKey.length < 32) {
        this.addCheck({
          category: 'Backup',
          name: 'Encryption Key',
          status: 'fail',
          message: 'Backup encryption key is missing or too weak',
          critical: true
        })
      } else {
        this.addCheck({
          category: 'Backup',
          name: 'Encryption Key',
          status: 'pass',
          message: 'Backup encryption key is properly configured',
          critical: true
        })
      }

      // Test backup listing
      const backups = await backup.listBackups()
      this.addCheck({
        category: 'Backup',
        name: 'System Functionality',
        status: 'pass',
        message: `Backup system operational (${backups.length} backups found)`,
        critical: false,
        details: { backupCount: backups.length }
      })

    } catch (error) {
      this.addCheck({
        category: 'Backup',
        name: 'Configuration',
        status: 'fail',
        message: `Backup configuration check failed: ${error.message}`,
        critical: true
      })
    }
  }

  private async checkPerformanceSettings(): Promise<void> {
    // Check Node.js performance settings
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1))

    if (majorVersion < 18) {
      this.addCheck({
        category: 'Performance',
        name: 'Node.js Version',
        status: 'warning',
        message: `Node.js version ${nodeVersion} is outdated, recommend v18+`,
        critical: false
      })
    } else {
      this.addCheck({
        category: 'Performance',
        name: 'Node.js Version',
        status: 'pass',
        message: `Node.js version ${nodeVersion} is supported`,
        critical: false
      })
    }

    // Check memory limits
    const memoryUsage = process.memoryUsage()
    const heapLimit = memoryUsage.heapTotal

    if (heapLimit < 512 * 1024 * 1024) { // 512MB
      this.addCheck({
        category: 'Performance',
        name: 'Memory Allocation',
        status: 'warning',
        message: 'Low memory allocation may impact performance',
        critical: false,
        details: { heapLimit: Math.round(heapLimit / 1024 / 1024) + 'MB' }
      })
    } else {
      this.addCheck({
        category: 'Performance',
        name: 'Memory Allocation',
        status: 'pass',
        message: 'Memory allocation is adequate',
        critical: false,
        details: { heapLimit: Math.round(heapLimit / 1024 / 1024) + 'MB' }
      })
    }
  }

  private async checkHealthChecks(): Promise<void> {
    try {
      const health = new HealthCheckService()
      const status = await health.getSystemHealth()

      if (status.overall === 'healthy') {
        this.addCheck({
          category: 'Health',
          name: 'System Health',
          status: 'pass',
          message: 'All system components are healthy',
          critical: true,
          details: status
        })
      } else {
        this.addCheck({
          category: 'Health',
          name: 'System Health',
          status: 'warning',
          message: `System health status: ${status.overall}`,
          critical: true,
          details: status
        })
      }

    } catch (error) {
      this.addCheck({
        category: 'Health',
        name: 'Health Checks',
        status: 'fail',
        message: `Health check failed: ${error.message}`,
        critical: true
      })
    }
  }

  private async checkSSLConfiguration(): Promise<void> {
    const nextAuthUrl = process.env.NEXTAUTH_URL
    
    if (!nextAuthUrl) {
      this.addCheck({
        category: 'SSL',
        name: 'NEXTAUTH_URL',
        status: 'fail',
        message: 'NEXTAUTH_URL not configured',
        critical: true
      })
    } else if (!nextAuthUrl.startsWith('https://')) {
      this.addCheck({
        category: 'SSL',
        name: 'HTTPS Configuration',
        status: 'fail',
        message: 'NEXTAUTH_URL should use HTTPS in production',
        critical: true
      })
    } else {
      this.addCheck({
        category: 'SSL',
        name: 'HTTPS Configuration',
        status: 'pass',
        message: 'HTTPS properly configured',
        critical: true
      })
    }
  }

  private async checkRateLimiting(): Promise<void> {
    // Check if rate limiting is configured
    const rateLimitConfig = process.env.RATE_LIMIT_ENABLED
    
    if (rateLimitConfig !== 'true') {
      this.addCheck({
        category: 'Security',
        name: 'Rate Limiting',
        status: 'warning',
        message: 'Rate limiting is not enabled',
        critical: false
      })
    } else {
      this.addCheck({
        category: 'Security',
        name: 'Rate Limiting',
        status: 'pass',
        message: 'Rate limiting is enabled',
        critical: false
      })
    }
  }

  private async checkLoggingConfiguration(): Promise<void> {
    const logLevel = process.env.LOG_LEVEL || 'info'
    
    if (logLevel === 'debug') {
      this.addCheck({
        category: 'Logging',
        name: 'Log Level',
        status: 'warning',
        message: 'Debug logging enabled in production - may impact performance',
        critical: false
      })
    } else {
      this.addCheck({
        category: 'Logging',
        name: 'Log Level',
        status: 'pass',
        message: `Log level set to '${logLevel}'`,
        critical: false
      })
    }
  }

  private async checkResourceLimits(): Promise<void> {
    // Check worker concurrency
    const workerConcurrency = parseInt(process.env.WORKER_CONCURRENCY || '5')
    
    if (workerConcurrency > 20) {
      this.addCheck({
        category: 'Resources',
        name: 'Worker Concurrency',
        status: 'warning',
        message: 'High worker concurrency may cause resource exhaustion',
        critical: false,
        details: { concurrency: workerConcurrency }
      })
    } else if (workerConcurrency < 2) {
      this.addCheck({
        category: 'Resources',
        name: 'Worker Concurrency',
        status: 'warning',
        message: 'Low worker concurrency may impact performance',
        critical: false,
        details: { concurrency: workerConcurrency }
      })
    } else {
      this.addCheck({
        category: 'Resources',
        name: 'Worker Concurrency',
        status: 'pass',
        message: `Worker concurrency set to ${workerConcurrency}`,
        critical: false,
        details: { concurrency: workerConcurrency }
      })
    }
  }

  private addCheck(check: DeploymentCheck): void {
    this.checks.push(check)
    
    const statusIcon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
    const criticalIcon = check.critical ? '🔴' : '🟡'
    
    console.log(`${statusIcon} ${criticalIcon} [${check.category}] ${check.name}: ${check.message}`)
  }

  async generateDeploymentReport(): Promise<string> {
    const checks = await this.runAllChecks()
    
    let report = '# Production Deployment Verification Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`

    // Summary
    const passed = checks.filter(c => c.status === 'pass').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const failed = checks.filter(c => c.status === 'fail').length
    const critical = checks.filter(c => c.critical && c.status === 'fail').length

    report += '## Summary\n\n'
    report += `- **Total Checks**: ${checks.length}\n`
    report += `- **Passed**: ${passed}\n`
    report += `- **Warnings**: ${warnings}\n`
    report += `- **Failed**: ${failed}\n`
    report += `- **Critical Failures**: ${critical}\n\n`

    if (critical > 0) {
      report += '⚠️ **CRITICAL ISSUES FOUND - DEPLOYMENT NOT RECOMMENDED**\n\n'
    } else if (failed > 0) {
      report += '⚠️ **Issues found - Review before deployment**\n\n'
    } else {
      report += '✅ **All checks passed - Ready for deployment**\n\n'
    }

    // Group by category
    const categories = [...new Set(checks.map(c => c.category))]
    
    for (const category of categories) {
      report += `## ${category}\n\n`
      
      const categoryChecks = checks.filter(c => c.category === category)
      
      for (const check of categoryChecks) {
        const statusIcon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
        const criticalIcon = check.critical ? ' (Critical)' : ''
        
        report += `### ${statusIcon} ${check.name}${criticalIcon}\n\n`
        report += `**Status**: ${check.status}\n\n`
        report += `**Message**: ${check.message}\n\n`
        
        if (check.details) {
          report += `**Details**: \`\`\`json\n${JSON.stringify(check.details, null, 2)}\n\`\`\`\n\n`
        }
      }
    }

    return report
  }

  async cleanup(): Promise<void> {
    await this.redis.disconnect()
  }
}

async function main() {
  const verifier = new ProductionDeploymentVerifier()

  try {
    const report = await verifier.generateDeploymentReport()
    
    // Save report to file
    const fs = require('fs')
    const reportPath = `production-deployment-report-${Date.now()}.md`
    fs.writeFileSync(reportPath, report)
    
    console.log(`\n📊 Production deployment report saved to: ${reportPath}`)
    
    const checks = verifier.checks
    const criticalFailures = checks.filter(c => c.critical && c.status === 'fail').length
    
    if (criticalFailures > 0) {
      console.log('\n❌ Critical issues found - deployment not recommended!')
      process.exit(1)
    } else {
      console.log('\n🎉 Production deployment verification completed!')
    }

  } catch (error) {
    console.error('❌ Production deployment verification failed:', error)
    process.exit(1)
  } finally {
    await verifier.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { ProductionDeploymentVerifier, type DeploymentCheck }