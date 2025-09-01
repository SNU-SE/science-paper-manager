/**
 * Global setup for integration tests
 * Runs once before all test suites
 */

const { createClient } = require('@supabase/supabase-js')
const Redis = require('ioredis')

module.exports = async () => {
  console.log('🚀 Setting up integration test environment...')

  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321'
  process.env.TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
  process.env.TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'

  try {
    // Verify database connection
    const supabase = createClient(
      process.env.TEST_SUPABASE_URL,
      process.env.TEST_SUPABASE_ANON_KEY
    )
    
    const { data, error } = await supabase.from('papers').select('count').limit(1)
    if (error && !error.message.includes('relation "papers" does not exist')) {
      throw error
    }
    console.log('✅ Database connection verified')

    // Verify Redis connection
    const redis = new Redis(process.env.TEST_REDIS_URL)
    await redis.ping()
    await redis.quit()
    console.log('✅ Redis connection verified')

    // Store global test configuration
    global.__TEST_CONFIG__ = {
      supabase: {
        url: process.env.TEST_SUPABASE_URL,
        key: process.env.TEST_SUPABASE_ANON_KEY
      },
      redis: {
        url: process.env.TEST_REDIS_URL
      }
    }

    console.log('✅ Integration test environment setup complete')

  } catch (error) {
    console.error('❌ Failed to setup integration test environment:', error)
    throw error
  }
}