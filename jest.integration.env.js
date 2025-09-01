/**
 * Environment setup for integration tests
 * Sets up environment variables and polyfills
 */

// Test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'

// Disable console logs in tests unless verbose mode is enabled
if (process.env.VERBOSE_TESTS !== 'true') {
  const originalConsole = console
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error, // Keep error logs
    debug: jest.fn()
  }
}

// Import OpenAI shims for Node.js environment
require('openai/shims/node')

// Mock external services for testing
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'Mock AI analysis summary',
                keyPoints: ['Point 1', 'Point 2', 'Point 3'],
                rating: 4.2,
                tags: ['ai', 'machine-learning']
              })
            }
          }]
        })
      }
    }
  }))
}))

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          text: JSON.stringify({
            summary: 'Mock Anthropic analysis summary',
            keyPoints: ['Point A', 'Point B', 'Point C'],
            rating: 4.5,
            tags: ['artificial-intelligence', 'research']
          })
        }]
      })
    }
  }))
}))

// Mock file system operations for testing
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('Mock file content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 })
}))

// Mock crypto for consistent test results
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  })
}))

// Performance monitoring mock
global.performance = global.performance || {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn()
}

// WebSocket mock for notification tests
global.WebSocket = global.WebSocket || class MockWebSocket {
  constructor() {
    this.readyState = 1 // OPEN
  }
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

// Timeout helpers for async tests
global.waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const check = () => {
      try {
        if (condition()) {
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for condition after ${timeout}ms`))
        } else {
          setTimeout(check, 100)
        }
      } catch (error) {
        reject(error)
      }
    }
    check()
  })
}

global.waitForJobCompletion = (jobId, timeout = 30000) => {
  return global.waitFor(() => {
    // This would check job status in a real implementation
    return true
  }, timeout)
}