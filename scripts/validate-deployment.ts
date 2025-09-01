#!/usr/bin/env tsx

/**
 * Deployment validation script
 * Validates that all necessary components are properly configured
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(level: 'info' | 'warn' | 'error' | 'success', message: string) {
  const color = {
    info: colors.blue,
    warn: colors.yellow,
    error: colors.red,
    success: colors.green
  }[level]
  
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]'
  }[level]
  
  console.log(`${color}${prefix}${colors.reset} ${message}`)
}

interface ValidationResult {
  passed: boolean
  message: string
}

class DeploymentValidator {
  private errors: string[] = []
  private warnings: string[] = []

  async validate(): Promise<boolean> {
    log('info', '🔍 Starting deployment validation...')
    console.log('')

    // Validate environment configuration
    this.validateEnvironmentConfig()
    
    // Validate Docker configuration
    this.validateDockerConfig()
    
    // Validate package.json scripts
    this.validatePackageScripts()
    
    // Validate required files
    this.validateRequiredFiles()
    
    // Validate TypeScript configuration
    this.validateTypeScriptConfig()
    
    // Print summary
    this.printSummary()
    
    return this.errors.length === 0
  }

  private validateEnvironmentConfig(): void {
    log('info', 'Validating environment configuration...')
    
    const requiredFiles = [
      '.env.example',
      '.env.production',
      'src/config/environment.ts'
    ]
    
    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        this.errors.push(`Missing required file: ${file}`)
      } else {
        log('success', `✅ Found ${file}`)
      }
    }
    
    // Validate environment.ts structure
    if (existsSync('src/config/environment.ts')) {
      const content = readFileSync('src/config/environment.ts', 'utf-8')
      
      const requiredExports = ['env', 'config', 'isFeatureEnabled', 'getDatabaseUrl', 'getRedisUrl']
      for (const exportName of requiredExports) {
        if (!content.includes(`export ${exportName}`) && !content.includes(`export const ${exportName}`) && !content.includes(`export function ${exportName}`)) {
          this.errors.push(`Missing export in environment.ts: ${exportName}`)
        }
      }
    }
    
    console.log('')
  }

  private validateDockerConfig(): void {
    log('info', 'Validating Docker configuration...')
    
    const dockerFiles = [
      'Dockerfile',
      'Dockerfile.worker',
      'Dockerfile.dev',
      'docker-compose.yml',
      'docker-compose.dev.yml',
      'docker-compose.prod.yml',
      '.dockerignore'
    ]
    
    for (const file of dockerFiles) {
      if (!existsSync(file)) {
        this.errors.push(`Missing Docker file: ${file}`)
      } else {
        log('success', `✅ Found ${file}`)
      }
    }
    
    // Validate Docker Compose structure
    if (existsSync('docker-compose.prod.yml')) {
      const content = readFileSync('docker-compose.prod.yml', 'utf-8')
      const requiredServices = ['redis', 'web', 'worker']
      
      for (const service of requiredServices) {
        if (!content.includes(`${service}:`)) {
          this.errors.push(`Missing service in docker-compose.prod.yml: ${service}`)
        }
      }
    }
    
    console.log('')
  }

  private validatePackageScripts(): void {
    log('info', 'Validating package.json scripts...')
    
    if (!existsSync('package.json')) {
      this.errors.push('Missing package.json')
      return
    }
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
    const scripts = packageJson.scripts || {}
    
    const requiredScripts = [
      'dev',
      'build',
      'start',
      'worker',
      'worker:dev',
      'setup-db:optimized',
      'deploy:prod',
      'setup:dev',
      'health:check',
      'monitor',
      'docker:dev',
      'docker:prod'
    ]
    
    for (const script of requiredScripts) {
      if (!scripts[script]) {
        this.errors.push(`Missing package.json script: ${script}`)
      } else {
        log('success', `✅ Found script: ${script}`)
      }
    }
    
    // Check for zod dependency
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    if (!dependencies.zod) {
      this.errors.push('Missing required dependency: zod')
    }
    
    console.log('')
  }

  private validateRequiredFiles(): void {
    log('info', 'Validating required files...')
    
    const requiredFiles = [
      'scripts/deploy.sh',
      'scripts/setup-dev.sh',
      'scripts/health-check.sh',
      'scripts/monitor.sh',
      'scripts/worker.ts',
      'config/redis.conf',
      'config/nginx.conf',
      'DEPLOYMENT.md'
    ]
    
    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        this.errors.push(`Missing required file: ${file}`)
      } else {
        log('success', `✅ Found ${file}`)
      }
    }
    
    // Check if shell scripts are executable
    const shellScripts = [
      'scripts/deploy.sh',
      'scripts/setup-dev.sh',
      'scripts/health-check.sh',
      'scripts/monitor.sh'
    ]
    
    for (const script of shellScripts) {
      if (existsSync(script)) {
        try {
          const stats = require('fs').statSync(script)
          if (!(stats.mode & parseInt('111', 8))) {
            this.warnings.push(`Script ${script} is not executable. Run: chmod +x ${script}`)
          }
        } catch (error) {
          this.warnings.push(`Could not check permissions for ${script}`)
        }
      }
    }
    
    console.log('')
  }

  private validateTypeScriptConfig(): void {
    log('info', 'Validating TypeScript configuration...')
    
    if (!existsSync('tsconfig.json')) {
      this.errors.push('Missing tsconfig.json')
      return
    }
    
    const tsConfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8'))
    
    // Check for important compiler options
    const compilerOptions = tsConfig.compilerOptions || {}
    
    if (compilerOptions.strict !== true) {
      this.warnings.push('TypeScript strict mode is not enabled')
    }
    
    if (!compilerOptions.moduleResolution) {
      this.warnings.push('TypeScript moduleResolution is not set')
    }
    
    log('success', '✅ TypeScript configuration validated')
    console.log('')
  }

  private printSummary(): void {
    console.log('=' .repeat(50))
    log('info', 'Validation Summary')
    console.log('=' .repeat(50))
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      log('success', '🎉 All validations passed! Deployment is ready.')
    } else {
      if (this.errors.length > 0) {
        log('error', `❌ Found ${this.errors.length} error(s):`)
        this.errors.forEach(error => log('error', `  - ${error}`))
        console.log('')
      }
      
      if (this.warnings.length > 0) {
        log('warn', `⚠️  Found ${this.warnings.length} warning(s):`)
        this.warnings.forEach(warning => log('warn', `  - ${warning}`))
        console.log('')
      }
      
      if (this.errors.length > 0) {
        log('error', '❌ Deployment validation failed. Please fix the errors above.')
      } else {
        log('warn', '⚠️  Deployment validation passed with warnings. Consider addressing them.')
      }
    }
    
    console.log('')
    log('info', 'Next steps:')
    console.log('  1. Fix any errors or warnings above')
    console.log('  2. Configure your environment files (.env.local, .env.production.local)')
    console.log('  3. Run deployment: npm run deploy:prod')
    console.log('  4. Monitor system: npm run monitor')
  }
}

// Run validation
async function main() {
  const validator = new DeploymentValidator()
  const success = await validator.validate()
  process.exit(success ? 0 : 1)
}

if (require.main === module) {
  main().catch(console.error)
}