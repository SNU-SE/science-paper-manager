import { UserAiModelService } from '../UserAiModelService'
import { getSupabaseClient } from '@/lib/database'
import { AIProvider } from '@/services/ai/AIServiceFactory'

// Mock Supabase client
jest.mock('@/lib/database', () => ({
  getSupabaseClient: jest.fn()
}))

const createMockChain = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  data: [],
  error: null
})

const mockSupabase = {
  from: jest.fn(() => createMockChain())
}

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>

describe('UserAiModelService', () => {
  let service: UserAiModelService
  const mockUserId = 'test-user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSupabaseClient.mockReturnValue(mockSupabase as any)
    service = new UserAiModelService()
  })

  describe('getUserModelPreferences', () => {
    it('should fetch user model preferences successfully', async () => {
      const mockPreferences = [
        {
          id: '1',
          user_id: mockUserId,
          provider: 'openai',
          model_name: 'gpt-4o',
          display_name: 'GPT-4o',
          is_default: true,
          parameters: { temperature: 0.7 },
          is_enabled: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      const mockChain = mockSupabase.from()
      mockChain.order.mockReturnValue({
        data: mockPreferences,
        error: null
      })

      const result = await service.getUserModelPreferences(mockUserId)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: '1',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        parameters: { temperature: 0.7 },
        isEnabled: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_ai_model_preferences')
      expect(mockSupabase.from().select).toHaveBeenCalledWith('*')
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('user_id', mockUserId)
    })

    it('should handle database errors', async () => {
      const mockChain = mockSupabase.from()
      mockChain.order.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect(service.getUserModelPreferences(mockUserId))
        .rejects.toThrow('Failed to fetch user model preferences: Database error')
    })

    it('should return empty array when no preferences exist', async () => {
      const mockChain = mockSupabase.from()
      mockChain.order.mockReturnValue({
        data: [],
        error: null
      })

      const result = await service.getUserModelPreferences(mockUserId)

      expect(result).toEqual([])
    })
  })

  describe('saveModelPreference', () => {
    it('should save new model preference successfully', async () => {
      const mockSavedPreference = {
        id: '1',
        user_id: mockUserId,
        provider: 'openai',
        model_name: 'gpt-4o',
        display_name: 'GPT-4o',
        is_default: true,
        parameters: { temperature: 0.7 },
        is_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: mockSavedPreference,
        error: null
      })

      const result = await service.saveModelPreference(
        mockUserId,
        'openai' as AIProvider,
        'gpt-4o',
        {
          isDefault: true,
          parameters: { temperature: 0.7 },
          isEnabled: true
        }
      )

      expect(result).toEqual({
        id: '1',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        parameters: { temperature: 0.7 },
        isEnabled: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_ai_model_preferences')
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith({
        user_id: mockUserId,
        provider: 'openai',
        model_name: 'gpt-4o',
        display_name: 'GPT-4o',
        is_default: true,
        parameters: { temperature: 0.7 },
        is_enabled: true
      })
    })

    it('should handle save errors', async () => {
      mockSupabase.from().upsert().select().single.mockReturnValue({
        data: null,
        error: { message: 'Save failed' }
      })

      await expect(service.saveModelPreference(
        mockUserId,
        'openai' as AIProvider,
        'gpt-4o',
        { isDefault: true }
      )).rejects.toThrow('Failed to save model preference: Save failed')
    })
  })

  describe('getDefaultModel', () => {
    it('should return default model for provider', async () => {
      const mockPreference = {
        id: '1',
        user_id: mockUserId,
        provider: 'openai',
        model_name: 'gpt-4o',
        display_name: 'GPT-4o',
        is_default: true,
        parameters: { temperature: 0.7 },
        is_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().select().eq().eq().single.mockReturnValue({
        data: mockPreference,
        error: null
      })

      const result = await service.getDefaultModel(mockUserId, 'openai' as AIProvider)

      expect(result).toEqual({
        id: '1',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        parameters: { temperature: 0.7 },
        isEnabled: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })
    })

    it('should return null when no default model exists', async () => {
      mockSupabase.from().select().eq().eq().single.mockReturnValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      })

      const result = await service.getDefaultModel(mockUserId, 'openai' as AIProvider)

      expect(result).toBeNull()
    })
  })

  describe('setDefaultModel', () => {
    it('should set model as default successfully', async () => {
      // Mock clearing existing defaults
      mockSupabase.from().update().eq.mockReturnValue({
        data: [],
        error: null
      })

      // Mock setting new default
      const mockUpdatedPreference = {
        id: '1',
        user_id: mockUserId,
        provider: 'openai',
        model_name: 'gpt-4o',
        display_name: 'GPT-4o',
        is_default: true,
        parameters: { temperature: 0.7 },
        is_enabled: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: mockUpdatedPreference,
        error: null
      })

      const result = await service.setDefaultModel(
        mockUserId,
        'openai' as AIProvider,
        'gpt-4o'
      )

      expect(result).toEqual({
        id: '1',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        parameters: { temperature: 0.7 },
        isEnabled: true,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })
    })

    it('should handle errors when setting default', async () => {
      mockSupabase.from().update().eq().select().single.mockReturnValue({
        data: null,
        error: { message: 'Update failed' }
      })

      await expect(service.setDefaultModel(
        mockUserId,
        'openai' as AIProvider,
        'gpt-4o'
      )).rejects.toThrow('Failed to set default model: Update failed')
    })
  })

  describe('deleteModelPreference', () => {
    it('should delete model preference successfully', async () => {
      mockSupabase.from().delete().eq.mockReturnValue({
        data: [{ id: '1' }],
        error: null
      })

      await service.deleteModelPreference(mockUserId, '1')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_ai_model_preferences')
      expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('id', '1')
    })

    it('should handle delete errors', async () => {
      mockSupabase.from().delete().eq.mockReturnValue({
        data: null,
        error: { message: 'Delete failed' }
      })

      await expect(service.deleteModelPreference(mockUserId, '1'))
        .rejects.toThrow('Failed to delete model preference: Delete failed')
    })
  })

  describe('bulkUpdatePreferences', () => {
    it('should update multiple preferences successfully', async () => {
      const preferences = [
        {
          provider: 'openai' as AIProvider,
          modelName: 'gpt-4o',
          isDefault: true,
          isEnabled: true
        },
        {
          provider: 'anthropic' as AIProvider,
          modelName: 'claude-3-sonnet',
          isDefault: false,
          isEnabled: true
        }
      ]

      // Mock successful saves
      mockSupabase.from().upsert().select().single
        .mockReturnValueOnce({
          data: {
            id: '1',
            user_id: mockUserId,
            provider: 'openai',
            model_name: 'gpt-4o',
            display_name: 'GPT-4o',
            is_default: true,
            is_enabled: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          },
          error: null
        })
        .mockReturnValueOnce({
          data: {
            id: '2',
            user_id: mockUserId,
            provider: 'anthropic',
            model_name: 'claude-3-sonnet',
            display_name: 'Claude 3 Sonnet',
            is_default: false,
            is_enabled: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          },
          error: null
        })

      const result = await service.bulkUpdatePreferences(mockUserId, preferences)

      expect(result).toHaveLength(2)
      expect(result[0].provider).toBe('openai')
      expect(result[1].provider).toBe('anthropic')
    })
  })
})