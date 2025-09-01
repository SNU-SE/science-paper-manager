import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the notification service
jest.mock('@/services/notifications/NotificationService', () => ({
  getNotificationService: jest.fn(() => ({
    getUserNotifications: jest.fn(),
    sendNotification: jest.fn()
  }))
}))

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}))

describe('/api/notifications', () => {
  let mockNotificationService: any
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockNotificationService = {
      getUserNotifications: jest.fn(),
      sendNotification: jest.fn()
    }

    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }

    const { getNotificationService } = require('@/services/notifications/NotificationService')
    getNotificationService.mockReturnValue(mockNotificationService)

    const { createClient } = require('@supabase/supabase-js')
    createClient.mockReturnValue(mockSupabase)
  })

  describe('GET', () => {
    it('should return user notifications', async () => {
      const mockUser = { id: 'user-123' }
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-123',
          type: 'ai_analysis_complete',
          title: 'Analysis Complete',
          message: 'Your analysis is ready',
          createdAt: '2024-01-01T00:00:00Z',
          readAt: null,
          expiresAt: '2024-01-08T00:00:00Z',
          priority: 'medium'
        }
      ]

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockNotificationService.getUserNotifications.mockResolvedValue(mockNotifications)

      const request = new NextRequest('http://localhost/api/notifications', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.notifications).toEqual(mockNotifications)
      expect(data.pagination).toBeDefined()
      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith('user-123', 50, 0)
    })

    it('should return 401 for missing authorization', async () => {
      const request = new NextRequest('http://localhost/api/notifications')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      })

      const request = new NextRequest('http://localhost/api/notifications', {
        headers: {
          'authorization': 'Bearer invalid-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid token')
    })

    it('should handle query parameters', async () => {
      const mockUser = { id: 'user-123' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockNotificationService.getUserNotifications.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/notifications?limit=10&offset=20', {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      })

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith('user-123', 10, 20)
    })
  })

  describe('POST', () => {
    it('should send notification as admin', async () => {
      const mockUser = { id: 'admin-123' }
      const mockProfile = { role: 'admin' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      })

      mockNotificationService.sendNotification.mockResolvedValue('notification-123')

      const requestBody = {
        userId: 'user-456',
        type: 'system_update',
        title: 'System Update',
        message: 'System will be updated tonight',
        priority: 'high'
      }

      const request = new NextRequest('http://localhost/api/notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.notificationId).toBe('notification-123')
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith('user-456', {
        type: 'system_update',
        title: 'System Update',
        message: 'System will be updated tonight',
        priority: 'high'
      })
    })

    it('should return 403 for non-admin user', async () => {
      const mockUser = { id: 'user-123' }
      const mockProfile = { role: 'user' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      })

      const requestBody = {
        userId: 'user-456',
        type: 'system_update',
        title: 'System Update',
        message: 'System will be updated tonight'
      }

      const request = new NextRequest('http://localhost/api/notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer user-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Admin access required')
    })

    it('should return 400 for missing required fields', async () => {
      const mockUser = { id: 'admin-123' }
      const mockProfile = { role: 'admin' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      })

      const requestBody = {
        userId: 'user-456',
        type: 'system_update'
        // Missing title and message
      }

      const request = new NextRequest('http://localhost/api/notifications', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })
  })
})