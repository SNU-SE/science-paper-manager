/**
 * Global teardown for integration tests
 * Runs once after all test suites complete
 */

const { createClient } = require('@supabase/supabase-js')
const Redis = require('ioredis')

module.exports = async () => {
  console.log('🧹 Cleaning up integration test environment...')

  try {
    const config = global.__TEST_CONFIG__

    if (config) {
      // Clean up test database
      const supabase = createClient(config.supabase.url, config.supabase.key)
      
      // Clean up test data (be careful with this in production!)
      if (process.env.NODE_ENV === 'test') {
        try {
          await supabase.from('background_jobs').delete().like('data', '%test%')
          await supabase.from('notifications').delete().like('title', '%test%')
          await supabase.from('user_evaluations').delete().like('notes', '%test%')
          await supabase.from('papers').delete().like('title', '%Test%')
          console.log('✅ Test data cleaned up')
        } catch (error) {
          console.warn('⚠️  Failed to clean up test data:', error.message)
        }
      }

      // Clean up Redis test data
      const redis = new Redis(config.redis.url)
      await redis.flushdb()
      await redis.quit()
      console.log('✅ Redis test data cleaned up')
    }

    console.log('✅ Integration test environment cleanup complete')

  } catch (error) {
    console.error('❌ Failed to cleanup integration test environment:', error)
  }
}