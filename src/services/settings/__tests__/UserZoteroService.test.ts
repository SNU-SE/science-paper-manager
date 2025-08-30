import { UserZoteroService } from '../UserZoteroService'
import { getSupabaseClient } from '@/lib/database'

// Mock Supabase client
jest.mock('@/lib/database', () => ({
  getSupabaseClient: jest.fn()
}))

// Mock console methods to suppress error logs in tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

// Create a more comprehensive mock that supports chaining
const createMockSupabaseQuery = (returnValue: any) => ({
  eq: jest.fn(() => createMockSupabaseQuery(returnValue)),
  select: jest.fn(() => createMockSupabaseQuery(returnValue)),
  insert: jest.fn(() => createMockSupabaseQuery(returnValue)),
  update: jest.fn(() => createMockSupabaseQuery(returnValue)),
  delete: jest.fn(() => createMockSupabaseQuery(returnValue)),
  single: jest.fn(() => returnValue),
  // Add any other methods the service might use
})

const mockSupabase = {
  from: jest.fn(() => createMockSupabaseQuery({ data: null, error: null }))
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
    mockConsoleError.mockClear()
    mockGetSupabaseClient.mockReturnValue(mockSupabase as any)
    service = new UserZoteroService()
  })

  afterEach(() => {
    // Restore console after each test if needed for debugging
    // mockConsoleError.mockRestore()
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
        auto_sync: true,
        sync_interval: 3600,
        sync_status: 'inactive',
        is_active: true,
        last_sync_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      // Set up the mock to return the data
      const mockQuery = createMockSupabaseQuery({
        data: mockSettings,
        error: null
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await service.getUserZoteroSettings(mockUserId)

      expect(result).toEqual({
        id: '1',
        userIdZotero: 'zotero-user-123',
        libraryType: 'user',
        libraryId: null,
        autoSync: true,
        syncInterval: 3600,
        syncStatus: 'inactive',
        isActive: true,
        lastSyncAt: new Date('2023-01-01T00:00:00Z'),
        hasApiKey: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
    })

    it('should return null when no settings exist', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await service.getUserZoteroSettings(mockUserId)

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: { message: 'Database error', code: 'SOME_ERROR' }
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await expect(service.getUserZoteroSettings(mockUserId))
        .rejects.toThrow()
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
        auto_sync: true,
        sync_interval: 3600,
        sync_status: 'inactive',
        is_active: true,
        last_sync_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      // Mock the update query (for deactivating existing settings)
      const mockUpdateQuery = createMockSupabaseQuery({ data: null, error: null })
      // Mock the insert query (for inserting new settings)
      const mockInsertQuery = createMockSupabaseQuery({
        data: mockSavedSettings,
        error: null
      })
      
      // First call is for update, second call is for insert
      mockSupabase.from
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce(mockInsertQuery)

      const result = await service.saveZoteroSettings(mockUserId, {
        userIdZotero: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'user',
        autoSync: true
      })

      expect(result).toEqual({
        id: '1',
        userIdZotero: 'zotero-user-123',
        libraryType: 'user',
        libraryId: null,
        autoSync: true,
        syncInterval: 3600,
        syncStatus: 'inactive',
        isActive: true,
        lastSyncAt: null,
        hasApiKey: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledTimes(2)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
    })

    it('should handle group library settings', async () => {
      const mockSavedSettings = {
        id: '1',
        user_id: mockUserId,
        user_id_zotero: 'zotero-user-123',
        api_key_encrypted: 'encrypted-key',
        library_type: 'group',
        library_id: 'group-123',
        auto_sync: false,
        sync_interval: 3600,
        sync_status: 'inactive',
        is_active: true,
        last_sync_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      const mockUpdateQuery = createMockSupabaseQuery({ data: null, error: null })
      const mockInsertQuery = createMockSupabaseQuery({
        data: mockSavedSettings,
        error: null
      })
      
      mockSupabase.from
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce(mockInsertQuery)

      const result = await service.saveZoteroSettings(mockUserId, {
        userIdZotero: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'group',
        libraryId: 'group-123',
        autoSync: false
      })

      expect(result.libraryType).toBe('group')
      expect(result.libraryId).toBe('group-123')
      expect(result.autoSync).toBe(false)
    })

    it('should handle save errors', async () => {
      const mockUpdateQuery = createMockSupabaseQuery({ data: null, error: null })
      const mockInsertQuery = createMockSupabaseQuery({
        data: null,
        error: { message: 'Save failed', code: 'INSERT_ERROR' }
      })
      
      mockSupabase.from
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce(mockInsertQuery)

      await expect(service.saveZoteroSettings(mockUserId, {
        userIdZotero: 'zotero-user-123',
        apiKey: 'test-api-key',
        libraryType: 'user'
      })).rejects.toThrow()
    })
  })

  describe('testZoteroConnection', () => {
    it('should test connection successfully', async () => {
      // Mock getZoteroApiKey call (first call)
      const apiKeyQuery = createMockSupabaseQuery({
        data: { api_key_encrypted: 'encrypted-key' },
        error: null
      })
      // Mock getUserZoteroSettings call (second call)
      const settingsQuery = createMockSupabaseQuery({
        data: {
          id: '1',
          user_id_zotero: 'zotero-user-123',
          library_type: 'user',
          library_id: null,
          auto_sync: true,
          sync_interval: 3600,
          sync_status: 'inactive',
          is_active: true,
          last_sync_at: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        error: null
      })
      
      mockSupabase.from
        .mockReturnValueOnce(apiKeyQuery)
        .mockReturnValueOnce(settingsQuery)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      const result = await service.testZoteroConnection(mockUserId)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zotero.org/users/zotero-user-123/items?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Zotero-API-Key': expect.any(String)
          })
        })
      )
    })

    it('should return false for failed connection', async () => {
      // Mock successful API key and settings retrieval
      const apiKeyQuery = createMockSupabaseQuery({
        data: { api_key_encrypted: 'encrypted-key' },
        error: null
      })
      const settingsQuery = createMockSupabaseQuery({
        data: {
          id: '1',
          user_id_zotero: 'zotero-user-123',
          library_type: 'user',
          library_id: null,
          auto_sync: true,
          sync_interval: 3600,
          sync_status: 'inactive',
          is_active: true,
          last_sync_at: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        error: null
      })
      
      mockSupabase.from
        .mockReturnValueOnce(apiKeyQuery)
        .mockReturnValueOnce(settingsQuery)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403
      } as Response)

      const result = await service.testZoteroConnection(mockUserId)

      expect(result).toBe(false)
    })

    it('should return false when no settings exist', async () => {
      // Mock failed API key retrieval
      const apiKeyQuery = createMockSupabaseQuery({
        data: null,
        error: { code: 'PGRST116' }
      })
      mockSupabase.from.mockReturnValueOnce(apiKeyQuery)

      const result = await service.testZoteroConnection(mockUserId)

      expect(result).toBe(false)
    })
  })

  describe('deleteZoteroSettings', () => {
    it('should delete Zotero settings successfully', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: [{ id: '1' }],
        error: null
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await service.deleteZoteroSettings(mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
    })

    it('should handle delete errors', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: { message: 'Delete failed', code: 'DELETE_ERROR' }
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await expect(service.deleteZoteroSettings(mockUserId))
        .rejects.toThrow()
    })
  })

  describe('updateSyncSettings', () => {
    it('should update sync settings successfully', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: null
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await service.updateSyncSettings(mockUserId, {
        autoSync: false,
        syncInterval: 7200
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
    })

    it('should handle update errors', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' }
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await expect(service.updateSyncSettings(mockUserId, {
        autoSync: true
      })).rejects.toThrow()
    })
  })

  describe('updateSyncStatus', () => {
    it('should update sync status successfully', async () => {
      const syncTime = new Date('2023-01-02T00:00:00Z')
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: null
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await service.updateSyncStatus(mockUserId, 'completed', syncTime)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_zotero_settings')
    })

    it('should handle update errors', async () => {
      const mockQuery = createMockSupabaseQuery({
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_ERROR' }
      })
      mockSupabase.from.mockReturnValue(mockQuery)

      await expect(service.updateSyncStatus(mockUserId, 'failed'))
        .rejects.toThrow()
    })
  })
})