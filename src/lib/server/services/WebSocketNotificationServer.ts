import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import { parse } from 'url'
import jwt from 'jsonwebtoken'
import { Notification } from '@/types/notifications'
import type { NotificationService } from './NotificationService'

export interface WebSocketConnection {
  ws: WebSocket
  userId: string
  lastHeartbeat: number
  subscriptions: Set<string>
}

export interface NotificationWebSocketMessage {
  type: 'notification' | 'read' | 'read_all' | 'deleted' | 'settings_updated' | 'heartbeat' | 'subscribe' | 'unsubscribe'
  data?: any
}

/**
 * WebSocket server for real-time notification delivery
 */
export class WebSocketNotificationServer {
  private wss: WebSocketServer
  private connections: Map<string, WebSocketConnection> = new Map()
  private redis: any
  private subscriber: any
  private redisInitialized = false
  private notificationService: NotificationService
  private heartbeatInterval: NodeJS.Timeout
  private cleanupInterval: NodeJS.Timeout

  constructor(server: Server, notificationService: NotificationService) {
    this.notificationService = notificationService
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: '/ws/notifications',
      verifyClient: this.verifyClient.bind(this)
    })

    this.setupWebSocketHandlers()
    this.initializeRedis()
    this.startHeartbeat()
    this.startCleanup()

    console.log('WebSocket Notification Server initialized')
  }

  private async initializeRedis() {
    if (this.redisInitialized) return
    
    try {
      // Completely prevent Redis import during build/static generation
      const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                         process.env.NODE_ENV !== 'production' ||
                         typeof window !== 'undefined' ||
                         !process.env.VERCEL_ENV ||
                         process.env.VERCEL_ENV !== 'production'

      if (isBuildTime) {
        const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
        this.redis = new MockRedis()
        this.subscriber = new MockRedis()
        this.setupRedisSubscriptions()
        this.redisInitialized = true
        return
      }

      // Only import real Redis in production runtime with valid Redis URL
      if (process.env.REDIS_URL && typeof process.env.REDIS_URL === 'string') {
        const Redis = (await import('ioredis')).default
        this.redis = new Redis(process.env.REDIS_URL)
        this.subscriber = new Redis(process.env.REDIS_URL)
      } else {
        // Fallback to mock if no Redis URL
        const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
        this.redis = new MockRedis()
        this.subscriber = new MockRedis()
      }
      this.setupRedisSubscriptions()
      this.redisInitialized = true
    } catch (error) {
      console.warn('Redis initialization failed for WebSocket server:', error)
      const MockRedis = (await import('@/lib/__mocks__/ioredis')).default
      this.redis = new MockRedis()
      this.subscriber = new MockRedis()
      this.redisInitialized = true
    }
  }

  /**
   * Verify client authentication
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    try {
      const url = parse(info.req.url || '', true)
      const token = url.query.token as string

      if (!token) {
        console.log('WebSocket connection rejected: No token provided')
        return false
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
      
      if (!decoded.sub) {
        console.log('WebSocket connection rejected: Invalid token')
        return false
      }

      // Store user ID in request for later use
      ;(info.req as any).userId = decoded.sub
      return true
    } catch (error) {
      console.log('WebSocket connection rejected: Token verification failed', error)
      return false
    }
  }

  /**
   * Setup WebSocket connection handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const userId = (req as any).userId
      
      if (!userId) {
        ws.close(1008, 'Authentication required')
        return
      }

      console.log(`WebSocket connected: User ${userId}`)

      // Create connection record
      const connection: WebSocketConnection = {
        ws,
        userId,
        lastHeartbeat: Date.now(),
        subscriptions: new Set()
      }

      this.connections.set(userId, connection)

      // Setup message handlers
      ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(userId, data)
      })

      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`WebSocket disconnected: User ${userId}, Code: ${code}, Reason: ${reason.toString()}`)
        this.connections.delete(userId)
      })

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for user ${userId}:`, error)
        this.connections.delete(userId)
      })

      // Send initial connection confirmation
      this.sendToUser(userId, {
        type: 'heartbeat',
        data: { connected: true, timestamp: Date.now() }
      })

      // Subscribe to user's notification channels
      this.subscribeToUserChannels(userId)
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(userId: string, data: Buffer): void {
    try {
      const message: NotificationWebSocketMessage = JSON.parse(data.toString())
      const connection = this.connections.get(userId)

      if (!connection) {
        return
      }

      switch (message.type) {
        case 'heartbeat':
          connection.lastHeartbeat = Date.now()
          this.sendToUser(userId, {
            type: 'heartbeat',
            data: { timestamp: Date.now() }
          })
          break

        case 'subscribe':
          if (message.data?.channel) {
            connection.subscriptions.add(message.data.channel)
            console.log(`User ${userId} subscribed to ${message.data.channel}`)
          }
          break

        case 'unsubscribe':
          if (message.data?.channel) {
            connection.subscriptions.delete(message.data.channel)
            console.log(`User ${userId} unsubscribed from ${message.data.channel}`)
          }
          break

        default:
          console.log(`Unknown message type from user ${userId}:`, message.type)
      }
    } catch (error) {
      console.error(`Failed to handle WebSocket message from user ${userId}:`, error)
    }
  }

  /**
   * Setup Redis subscriptions for real-time notifications
   */
  private setupRedisSubscriptions(): void {
    if (!this.redisInitialized || !this.subscriber) {
      return
    }
    
    // Subscribe to all notification channels
    this.subscriber.psubscribe('notifications:*')

    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      try {
        const channelParts = channel.split(':')
        const userId = channelParts[1]
        const eventType = channelParts[2] || 'notification'

        if (!userId) {
          return
        }

        const connection = this.connections.get(userId)
        if (!connection) {
          return
        }

        let messageData: NotificationWebSocketMessage

        switch (eventType) {
          case 'read':
            messageData = {
              type: 'read',
              data: JSON.parse(message)
            }
            break

          case 'read_all':
            messageData = {
              type: 'read_all',
              data: JSON.parse(message)
            }
            break

          case 'deleted':
            messageData = {
              type: 'deleted',
              data: JSON.parse(message)
            }
            break

          case 'settings_updated':
            messageData = {
              type: 'settings_updated',
              data: JSON.parse(message)
            }
            break

          default:
            // Regular notification
            messageData = {
              type: 'notification',
              data: JSON.parse(message)
            }
        }

        this.sendToUser(userId, messageData)
      } catch (error) {
        console.error('Failed to handle Redis message:', error)
      }
    })
  }

  /**
   * Subscribe to user-specific notification channels
   */
  private subscribeToUserChannels(userId: string): void {
    // These subscriptions are handled by the pattern subscription above
    // This method is kept for potential future specific channel subscriptions
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, message: NotificationWebSocketMessage): void {
    const connection = this.connections.get(userId)
    
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      connection.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error(`Failed to send message to user ${userId}:`, error)
      this.connections.delete(userId)
    }
  }

  /**
   * Broadcast message to all connected users
   */
  public broadcast(message: NotificationWebSocketMessage): void {
    for (const [userId, connection] of this.connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendToUser(userId, message)
      }
    }
  }

  /**
   * Send notification to specific user if connected
   */
  public sendNotificationToUser(userId: string, notification: Notification): void {
    this.sendToUser(userId, {
      type: 'notification',
      data: notification
    })
  }

  /**
   * Start heartbeat mechanism to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      const timeout = 30000 // 30 seconds

      for (const [userId, connection] of this.connections) {
        if (now - connection.lastHeartbeat > timeout) {
          console.log(`Removing stale connection for user ${userId}`)
          connection.ws.terminate()
          this.connections.delete(userId)
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          this.sendToUser(userId, {
            type: 'heartbeat',
            data: { ping: true, timestamp: now }
          })
        }
      }
    }, 15000) // Check every 15 seconds
  }

  /**
   * Start cleanup mechanism for closed connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      for (const [userId, connection] of this.connections) {
        if (connection.ws.readyState === WebSocket.CLOSED || connection.ws.readyState === WebSocket.CLOSING) {
          console.log(`Cleaning up closed connection for user ${userId}`)
          this.connections.delete(userId)
        }
      }
    }, 60000) // Check every minute
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number
    connectionsByUser: Record<string, number>
    activeConnections: number
  } {
    const stats = {
      totalConnections: this.connections.size,
      connectionsByUser: {} as Record<string, number>,
      activeConnections: 0
    }

    for (const [userId, connection] of this.connections) {
      stats.connectionsByUser[userId] = 1
      if (connection.ws.readyState === WebSocket.OPEN) {
        stats.activeConnections++
      }
    }

    return stats
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    const connection = this.connections.get(userId)
    return connection ? connection.ws.readyState === WebSocket.OPEN : false
  }

  /**
   * Gracefully shutdown the WebSocket server
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket Notification Server...')

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Close all connections
    for (const [userId, connection] of this.connections) {
      connection.ws.close(1001, 'Server shutting down')
    }

    // Close WebSocket server
    this.wss.close()

    // Close Redis connections if initialized
    if (this.redisInitialized && this.redis) {
      await this.redis.quit()
    }
    if (this.redisInitialized && this.subscriber) {
      await this.subscriber.quit()
    }

    console.log('WebSocket Notification Server shutdown complete')
  }
}