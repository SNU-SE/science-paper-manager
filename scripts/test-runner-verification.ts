#!/usr/bin/env tsx

/**
 * Test Runner Verification Script
 * 
 * Verifies that all test configurations and dependencies are properly set up
 * and can run basic test scenarios.
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

interface TestVerification {
  name: string
  command: string
  args: string[]
  expectedOutput?: string
  timeout: number
}

class TestRunnerVerifier {
  private verifications: TestVerification[] = [
    {
      name: 'Jest Configuration',
      command: 'npx',
      args: ['jest', '--showConfig'],
      timeout: 10000
    },
    {
      name: 'Integration Test Configuration',
      command: 'npx',
      args: ['jest', '--config', 'jest.integration.config.js', '--showConfig'],
      timeout: 10000
    },
    {
      name: 'TypeScript Compilation',
      command: 'npx',
      args: ['tsc', '--noEmit', '--project', '.'],
      timeout: 30000
    },
    {
      name: 'Playwright Configuration',
      command: 'npx',
      args: ['playwright', '--version'],
      timeout: 10000
    }
  ]

  async verify(): Promise<void> {
    console.log('🔍 Verifying test runner setup...')
    console.log('=====================================')

    let allPassed = true

    for (const verification of this.verifications) {
      try {
        console.log(`\n📋 Checking ${verification.name}...`)
        await this.runVerification(verification)
        console.log(`✅ ${verification.name} - PASSED`)
      } catch (error) {
        console.error(`❌ ${verification.name} - FAILED:`, error)
        allPassed = false
      }
    }

    // Check file structure
    console.log('\n📁 Checking test file structure...')
    await this.verifyFileStructure()

    // Check dependencies
    console.log('\n📦 Checking test dependencies...')
    await this.verifyDependencies()

    if (allPassed) {
      console.log('\n✅ All verifications passed! Test runner is ready.')
      console.log('\nYou can now run:')
      console.log('  npm run test:integration')
      console.log('  npm run test:performance')
      console.log('  npm run test:system')
      console.log('  npm run test:e2e:system')
    } else {
      console.log('\n❌ Some verifications failed. Please fix the issues above.')
      process.exit(1)
    }
  }

  private async runVerification(verification: TestVerification): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(verification.command, verification.args, {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      })

      let output = ''
      let errorOutput = ''

      process.stdout?.on('data', (data) => {
        output += data.toString()
      })

      process.stderr?.on('data', (data) => {
        errorOutput += data.toString()
      })

      const timeout = setTimeout(() => {
        process.kill('SIGKILL')
        reject(new Error(`Verification timed out after ${verification.timeout}ms`))
      }, verification.timeout)

      process.on('close', (code) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          if (verification.expectedOutput && !output.includes(verification.expectedOutput)) {
            reject(new Error(`Expected output not found: ${verification.expectedOutput}`))
          } else {
            resolve()
          }
        } else {
          reject(new Error(`Process failed with code ${code}. Error: ${errorOutput}`))
        }
      })

      process.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private async verifyFileStructure(): Promise<void> {
    const requiredFiles = [
      'src/services/__tests__/system-integration.test.ts',
      'src/services/__tests__/performance.test.ts',
      'e2e/system-enhancement.spec.ts',
      'scripts/run-integration-tests.ts',
      'jest.integration.config.js',
      'jest.integration.setup.js',
      'jest.integration.teardown.js',
      'jest.integration.env.js',
      'TESTING_INTEGRATION.md'
    ]

    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(process.cwd(), file))
        console.log(`  ✅ ${file}`)
      } catch (error) {
        console.error(`  ❌ ${file} - Missing`)
        throw new Error(`Required test file missing: ${file}`)
      }
    }
  }

  private async verifyDependencies(): Promise<void> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
      )

      const requiredDeps = [
        'jest',
        'jest-environment-jsdom',
        'jest-environment-node',
        '@testing-library/jest-dom',
        '@testing-library/react',
        '@playwright/test'
      ]

      const requiredOptionalDeps = [
        'jest-junit',
        'jest-html-reporters'
      ]

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const dep of requiredDeps) {
        if (!allDeps[dep]) {
          throw new Error(`Required dependency missing: ${dep}`)
        }
        console.log(`  ✅ ${dep}`)
      }

      for (const dep of requiredOptionalDeps) {
        if (allDeps[dep]) {
          console.log(`  ✅ ${dep} (optional)`)
        } else {
          console.log(`  ⚠️  ${dep} (optional, recommended for better reporting)`)
        }
      }

      // Check scripts
      const requiredScripts = [
        'test:integration',
        'test:performance',
        'test:system',
        'test:e2e:system'
      ]

      for (const script of requiredScripts) {
        if (!packageJson.scripts[script]) {
          throw new Error(`Required script missing: ${script}`)
        }
        console.log(`  ✅ npm run ${script}`)
      }

    } catch (error) {
      throw new Error(`Failed to verify dependencies: ${error}`)
    }
  }
}

// Main execution
async function main() {
  const verifier = new TestRunnerVerifier()
  await verifier.verify()
}

if (require.main === module) {
  main().catch(console.error)
}

export { TestRunnerVerifier }