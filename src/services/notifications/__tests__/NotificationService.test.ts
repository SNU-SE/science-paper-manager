import Redis from 'ioredis'
import { NotificationService } from '../NotificationService'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { afterEach } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock Redis
jest.mock('ioredis')
const MockedRedis = Redis as jest.MockedClass<typeof Redis>

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn()
            }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      })),
      upsert: vi.fn()
    })),
    rpc: jest.fn()
  }))
}))

describe('NotificationService', () => {
  let notificationService: NotificationService
  let mockRedis: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Create mock Redis instance
    mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      lpush: jest.fn(),
      expire: jest.fn(),
      publish: jest.fn(),
      lrange: jest.fn(),
      lrem: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn()
    }
    
    MockedRedis.mockImplementation(() => mockRedis)
    
    notificationService = new NotificationService()
  })

  afterEach(async () => {
    await notificationService.close()
  })

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const userId = 'user-123'
      const notification = {
        type: 'ai_analysis_complete' as const,
        title: 'Analysis Complete',
        message: 'Your AI analysis is ready',
        priority: 'medium' as const
      }

      // Mock database response
      const mockDbNotification = {
        id: 'notification-123',
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: {},
        priority: notification.priority,
        created_at: '2024-01-01T00:00:00Z',
        read_at: null,
        expires_at: '2024-01-08T00:00:00Z'
      }

      // Mock Supabase calls
      const mockSupabase = (notificationService as any).supabase
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ type: notification.type, enabled: true, delivery_method: 'web' }],
            error: null
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDbNotification,
              error: null
            })
          })
        })
      })

      const result = await notificationService.sendNotification(userId, notification)

      expect(result).toBe('notification-123')
      expect(mockRedis.setex).toHaveBeenCalled()
      expect(mockRedis.lpush).toHaveBeenCalled()
      expect(mockRedis.publish).toHaveBeenCalled()
    })

    it('should not send notification if type is disabled', async () => {
      const userId = 'user-123'
      const notification = {
        type: 'ai_analysis_complete' as const,
        title: 'Analysis Complete',
        message: 'Your AI analysis is ready',
        priority: 'medium' as const
      }

      // Mock disabled setting
      const mockSupabase = (notificationService as any).supabase
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ type: notification.type, enabled: false, delivery_method: 'web' }],
            error: null
          })
        })
      })

      const result = await notificationService.sendNotification(userId, notification)

      expect(result).toBe('')
    })
  })

  describe('getUserNotifications', () => {
    it('should return cached notifications if available', async () => {
      const userId = 'user-123'
      const cachedNotifications = [
        {
          id: 'notification-1',
          userId,
          type: 'ai_analysis_complete',
          title: 'Test',
          message: 'Test message',
          createdAt: '2024-01-01T00:00:00Z',
          readAt: null,
          expiresAt: '2024-01-08T00:00:00Z',
          priority: 'medium'
        }
      ]

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedNotifications))

      const result = await notificationService.getUserNotifications(userId)

      expect(result).toEqual(cachedNotifications)
      expect(mockRedis.get).toHaveBeenCalledWith('user:user-123:notifications:50:0')
    })

    it('should fetch from database if not cached', async () => {
      const userId = 'user-123'
      const dbNotifications = [
        {
          id: 'notification-1',
          user_id: userId,
          type: 'ai_analysis_complete',
          title: 'Test',
          message: 'Test message',
          data: {},
          priority: 'medium',
          created_at: '2024-01-01T00:00:00Z',
          read_at: null,
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]

      mockRedis.get.mockResolvedValue(null)

      const mockSupabase = (notificationService as any).supabase
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: dbNotifications,
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await notificationService.getUserNotifications(userId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('notification-1')
      expect(mockRedis.setex).toHaveBeenCalled() // Should cache the result
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notification-123'
      const userId = 'user-123'

      const mockSupabase = (notificationService as any).supabase
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null })

      mockRedis.get.mockResolvedValue(JSON.stringify({
        id: notificationId,
        userId,
        readAt: null
      }))
      mockRedis.ttl.mockResolvedValue(3600)

      const result = await notificationService.markAsRead(notificationId, userId)

      expect(result).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: userId
      })
      expect(mockRedis.setex).toHaveBeenCalled()
      expect(mockRedis.publish).toHaveBeenCalled()
    })
  })

  describe('getUnreadCount', () => {
    it('should return cached count if available', async () => {
      const userId = 'user-123'
      mockRedis.get.mockResolvedValue('5')

      const result = await notificationService.getUnreadCount(userId)

      expect(result).toBe(5)
      expect(mockRedis.get).toHaveBeenCalledWith('user:user-123:unread_count')
    })

    it('should fetch from database if not cached', async () => {
      const userId = 'user-123'
      mockRedis.get.mockResolvedValue(null)

      const mockSupabase = (notificationService as any).supabase
      mockSupabase.rpc.mockResolvedValue({ data: 3, error: null })

      const result = await notificationService.getUnreadCount(userId)

      expect(result).toBe(3)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_unread_notification_count', {
        p_user_id: userId
      })
      expect(mockRedis.setex).toHaveBeenCalledWith('user:user-123:unread_count', 60, '3')
    })
  })

  describe('updateNotificationSettings', () => {
    it('should update notification settings', async () => {
      const userId = 'user-123'
      const type = 'ai_analysis_complete'
      const enabled = false

      const mockSupabase = (notificationService as any).supabase
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null })
      })

      const result = await notificationService.updateNotificationSettings(
        userId,
        type as any,
        enabled
      )

      expect(result).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('user:user-123:settings')
      expect(mockRedis.publish).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredNotifications', () => {
    it('should clean up expired notifications', async () => {
      const mockSupabase = (notificationService as any).supabase
      mockSupabase.rpc.mockResolvedValue({ data: 10, error: null })

      const result = await notificationService.cleanupExpiredNotifications()

      expect(result).toBe(10)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_expired_notifications')
    })
  })

  describe('isHealthy', () => {
    it('should return true when Redis is healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG')

      const result = await notificationService.isHealthy()

      expect(result).toBe(true)
    })

    it('should return false when Redis is unhealthy', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'))

      const result = await notificationService.isHealthy()

      expect(result).toBe(false)
    })
  })
})