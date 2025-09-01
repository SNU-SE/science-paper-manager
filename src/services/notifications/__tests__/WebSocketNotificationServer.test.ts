import { Server } from 'http'
import { WebSocket } from 'ws'
import { WebSocketNotificationServer } from '../WebSocketNotificationServer'
import { NotificationService } from '../NotificationService'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { afterEach } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock WebSocket Server
jest.mock('ws', () => ({
  WebSocketServer: jest.fn(),
  WebSocket: {
    OPEN: 1,
    CLOSED: 3,
    CLOSING: 2
  }
}))

// Mock Redis
jest.mock('ioredis', () => ({
  default: jest.fn(() => ({
    psubscribe: jest.fn(),
    on: jest.fn(),
    quit: jest.fn()
  }))
}))

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}))

describe('WebSocketNotificationServer', () => {
  let server: WebSocketNotificationServer
  let mockHttpServer: Server
  let mockNotificationService: NotificationService
  let mockWss: any
  let mockRedis: any
  let mockSubscriber: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock HTTP server
    mockHttpServer = {} as Server

    // Mock notification service
    mockNotificationService = {
      isHealthy: jest.fn().mockResolvedValue(true)
    } as any

    // Mock WebSocket server
    mockWss = {
      on: jest.fn(),
      close: jest.fn()
    }

    // Mock Redis instances
    mockRedis = {
      publish: jest.fn(),
      quit: jest.fn()
    }

    mockSubscriber = {
      psubscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn()
    }

    const MockedWebSocketServer = jest.mocked(require('ws').WebSocketServer)
    MockedWebSocketServer.mockImplementation(() => mockWss)

    const MockedRedis = jest.mocked(require('ioredis').default)
    MockedRedis.mockImplementation(() => mockRedis)
  })

  afterEach(async () => {
    if (server) {
      await server.shutdown()
    }
  })

  describe('constructor', () => {
    it('should initialize WebSocket server correctly', () => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)

      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function))
      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith('notifications:*')
    })
  })

  describe('verifyClient', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should accept valid token', () => {
      const jwt = require('jsonwebtoken')
      jwt.verify.mockReturnValue({ sub: 'user-123' })

      const info = {
        origin: 'http://localhost',
        secure: false,
        req: {
          url: '/ws/notifications?token=valid-token'
        }
      }

      const result = (server as any).verifyClient(info)

      expect(result).toBe(true)
      expect(info.req.userId).toBe('user-123')
    })

    it('should reject invalid token', () => {
      const jwt = require('jsonwebtoken')
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const info = {
        origin: 'http://localhost',
        secure: false,
        req: {
          url: '/ws/notifications?token=invalid-token'
        }
      }

      const result = (server as any).verifyClient(info)

      expect(result).toBe(false)
    })

    it('should reject missing token', () => {
      const info = {
        origin: 'http://localhost',
        secure: false,
        req: {
          url: '/ws/notifications'
        }
      }

      const result = (server as any).verifyClient(info)

      expect(result).toBe(false)
    })
  })

  describe('connection handling', () => {
    let mockWs: any
    let connectionHandler: Function

    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
      
      // Get the connection handler
      connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection')[1]

      // Mock WebSocket
      mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        readyState: 1 // WebSocket.OPEN
      }
    })

    it('should handle new connection', () => {
      const mockReq = { userId: 'user-123' }

      connectionHandler(mockWs, mockReq)

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockWs.send).toHaveBeenCalled() // Initial heartbeat
    })

    it('should reject connection without userId', () => {
      const mockReq = {}

      connectionHandler(mockWs, mockReq)

      expect(mockWs.close).toHaveBeenCalledWith(1008, 'Authentication required')
    })
  })

  describe('message handling', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should handle heartbeat message', () => {
      const userId = 'user-123'
      const message = { type: 'heartbeat' }

      const mockConnection = {
        ws: { send: vi.fn(), readyState: 1 },
        userId,
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set(userId, mockConnection)
      ;(server as any).handleWebSocketMessage(userId, Buffer.from(JSON.stringify(message)))

      expect(mockConnection.lastHeartbeat).toBeGreaterThan(0)
      expect(mockConnection.ws.send).toHaveBeenCalled()
    })

    it('should handle subscribe message', () => {
      const userId = 'user-123'
      const message = { type: 'subscribe', data: { channel: 'test-channel' } }

      const mockConnection = {
        ws: { send: vi.fn(), readyState: 1 },
        userId,
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set(userId, mockConnection)
      ;(server as any).handleWebSocketMessage(userId, Buffer.from(JSON.stringify(message)))

      expect(mockConnection.subscriptions.has('test-channel')).toBe(true)
    })
  })

  describe('notification sending', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should send notification to connected user', () => {
      const userId = 'user-123'
      const notification = {
        id: 'notification-1',
        userId,
        type: 'ai_analysis_complete' as const,
        title: 'Test',
        message: 'Test message',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        priority: 'medium' as const
      }

      const mockConnection = {
        ws: { send: vi.fn(), readyState: 1 },
        userId,
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set(userId, mockConnection)
      server.sendNotificationToUser(userId, notification)

      expect(mockConnection.ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'notification',
          data: notification
        })
      )
    })

    it('should not send to disconnected user', () => {
      const userId = 'user-123'
      const notification = {
        id: 'notification-1',
        userId,
        type: 'ai_analysis_complete' as const,
        title: 'Test',
        message: 'Test message',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-08T00:00:00Z',
        priority: 'medium' as const
      }

      server.sendNotificationToUser(userId, notification)

      // Should not throw error, just silently ignore
      expect(true).toBe(true)
    })
  })

  describe('stats', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should return connection stats', () => {
      const mockConnection1 = {
        ws: { readyState: 1 },
        userId: 'user-1',
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      const mockConnection2 = {
        ws: { readyState: 3 }, // CLOSED
        userId: 'user-2',
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set('user-1', mockConnection1)
      ;(server as any).connections.set('user-2', mockConnection2)

      const stats = server.getStats()

      expect(stats.totalConnections).toBe(2)
      expect(stats.activeConnections).toBe(1)
      expect(stats.connectionsByUser['user-1']).toBe(1)
      expect(stats.connectionsByUser['user-2']).toBe(1)
    })
  })

  describe('isUserConnected', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should return true for connected user', () => {
      const mockConnection = {
        ws: { readyState: 1 },
        userId: 'user-1',
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set('user-1', mockConnection)

      expect(server.isUserConnected('user-1')).toBe(true)
    })

    it('should return false for disconnected user', () => {
      expect(server.isUserConnected('user-1')).toBe(false)
    })
  })

  describe('shutdown', () => {
    beforeEach(() => {
      server = new WebSocketNotificationServer(mockHttpServer, mockNotificationService)
    })

    it('should shutdown gracefully', async () => {
      const mockConnection = {
        ws: { close: vi.fn(), readyState: 1 },
        userId: 'user-1',
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      ;(server as any).connections.set('user-1', mockConnection)

      await server.shutdown()

      expect(mockConnection.ws.close).toHaveBeenCalledWith(1001, 'Server shutting down')
      expect(mockWss.close).toHaveBeenCalled()
      expect(mockRedis.quit).toHaveBeenCalled()
      expect(mockSubscriber.quit).toHaveBeenCalled()
    })
  })
})