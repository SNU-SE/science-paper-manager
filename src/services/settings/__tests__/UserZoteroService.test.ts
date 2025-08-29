import { UserZoteroService } from '../UserZoteroService'
import { getSupabaseClient } from '@/lib/database'

// Mock Supabase client
jest.mock('@/lib/database', () => ({
  getSupabaseClient: jest.fn()
}))

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: null,
          error: null
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>

// Mock fetch for Zotero API calls
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('UserZoteroService', () => {
  let service: UserZoteroService
  const mockUserId = 'test-user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSupabaseClient.mockReturnValue(mockSupabase as any)
    service = new UserZoteroService()
  })

  describe('getUserZoteroSettings', () => {
    it('should fetch user Zotero settings successfully', async () => {
      const mockSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'user',
        library_id: null,
        auto_sync_enabled: true,
        last_sync_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().select().eq().single.mockReturnValue({
        data: mockSettings,
        error: null
      })

      const result = await service.getUserZoteroSettings(mockUserId)

      expect(result).toEqual({
        id: '1',
        userId: 'zotero-user-123',
        libraryType: 'user',
        libraryId: null,
        autoSyncEnabled: true,
        lastSyncAt: new Date('2023-01-01T00:00:00Z'),
        hasApiKey: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('user_id', mockUserId)
    })

    it('should return null when no settings exist', async () => {
      mockSupabase.from().select().eq().single.mockReturnValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      })

      const result = await service.getUserZoteroSettings(mockUserId)

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSupabase.from().select().eq().single.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect(service.getUserZoteroSettings(mockUserId))
        .rejects.toThrow('Failed to fetch Zotero settings: Database error')
    })
  })

  describe('saveZoteroSettings', () => {
    it('should save Zotero settings successfully', async () => {
      const mockSavedSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'user',
        library_id: null,
        auto_sync_enabled: true,
        last_sync_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: mockSavedSettings,
        error: null
      })

      const result = await service.saveZoteroSettings(mockUserId, {
        userId: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'user',
        autoSyncEnabled: true
      })

      expect(result).toEqual({
        id: '1',
        userId: 'zotero-user-123',
        libraryType: 'user',
        libraryId: null,
        autoSyncEnabled: true,
        lastSyncAt: null,
        hasApiKey: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          user_id_zotero: 'zotero-user-123',
          library_type: 'user',
          auto_sync_enabled: true
        })
      )
    })

    it('should handle group library settings', async () => {
      const mockSavedSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'group',
        library_id: 'group-123',
        auto_sync_enabled: false,
        last_sync_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: mockSavedSettings,
        error: null
      })

      const result = await service.saveZoteroSettings(mockUserId, {
        userId: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'group',
        libraryId: 'group-123',
        autoSyncEnabled: false
      })

      expect(result.libraryType).toBe('group')
      expect(result.libraryId).toBe('group-123')
      expect(result.autoSyncEnabled).toBe(false)
    })

    it('should handle save errors', async () => {
      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: null,
        error: { message: 'Save failed' }
      })

      await expect(service.saveZoteroSettings(mockUserId, {
        userId: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'user'
      })).rejects.toThrow('Failed to save Zotero settings: Save failed')
    })
  })

  describe('validateZoteroCredentials', () => {
    it('should validate credentials successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userID: 'zotero-user-123',
          username: 'testuser'
        })
      } as Response)

      const result = await service.validateZoteroCredentials(
        'zotero-user-123',
        'test-api-key'
      )

      expect(result.isValid).toBe(true)
      expect(result.userInfo).toEqual({
        userID: 'zotero-user-123',
        username: 'testuser'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zotero.org/keys/current',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      )
    })

    it('should return invalid for unauthorized credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      } as Response)

      const result = await service.validateZoteroCredentials(
        'zotero-user-123',
        'invalid-key'
      )

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid API key or insufficient permissions')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.validateZoteroCredentials(
        'zotero-user-123',
        'test-api-key'
      )

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Network error occurred while validating credentials')
    })

    it('should validate user ID mismatch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userID: 'different-user-123',
          username: 'testuser'
        })
      } as Response)

      const result = await service.validateZoteroCredentials(
        'zotero-user-123',
        'test-api-key'
      )

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('User ID mismatch. Expected: zotero-user-123, Got: different-user-123')
    })
  })

  describe('deleteZoteroSettings', () => {
    it('should delete Zotero settings successfully', async () => {
      mockSupabase.from().delete().eq.mockReturnValue({
        data: [{ id: '1' }],
        error: null
      })

      await service.deleteZoteroSettings(mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
      expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('user_id', mockUserId)
    })

    it('should handle delete errors', async () => {
      mockSupabase.from().delete().eq.mockReturnValue({
        data: null,
        error: { message: 'Delete failed' }
      })

      await expect(service.deleteZoteroSettings(mockUserId))
        .rejects.toThrow('Failed to delete Zotero settings: Delete failed')
    })
  })

  describe('updateAutoSync', () => {
    it('should update auto sync setting successfully', async () => {
      const mockUpdatedSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'user',
        library_id: null,
        auto_sync_enabled: false,
        last_sync_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: mockUpdatedSettings,
        error: null
      })

      const result = await service.updateAutoSync(mockUserId, false)

      expect(result.autoSyncEnabled).toBe(false)
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        auto_sync_enabled: false
      })
    })

    it('should handle update errors', async () => {
      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: null,
        error: { message: 'Update failed' }
      })

      await expect(service.updateAutoSync(mockUserId, true))
        .rejects.toThrow('Failed to update auto sync setting: Update failed')
    })
  })

  describe('updateLastSyncTime', () => {
    it('should update last sync time successfully', async () => {
      const syncTime = new Date('2023-01-02T00:00:00Z')
      const mockUpdatedSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'user',
        library_id: null,
        auto_sync_enabled: true,
        last_sync_at: '2023-01-02T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: mockUpdatedSettings,
        error: null
      })

      const result = await service.updateLastSyncTime(mockUserId, syncTime)

      expect(result.lastSyncAt).toEqual(syncTime)
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        last_sync_at: syncTime.toISOString()
      })
    })
  })
})