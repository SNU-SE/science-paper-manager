/**
 * Mock ioredis for build-time to prevent client-side bundling
 */

export default class MockRedis {
  constructor() {
    // Mock constructor - do nothing during build
  }

  async ping() {
    return 'PONG'
  }

  async set() {
    return 'OK'
  }

  async get() {
    return null
  }

  async del() {
    return 1
  }

  async exists() {
    return 0
  }

  async expire() {
    return 1
  }

  async keys() {
    return []
  }

  async flushall() {
    return 'OK'
  }

  async quit() {
    return 'OK'
  }

  disconnect() {
    // Mock disconnect
  }

  // WebSocket server specific methods
  psubscribe() {
    return this
  }

  on() {
    return this
  }
}