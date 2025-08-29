import { renderHook, act } from '@testing-library/react'
import { useAIModelManager } from '../useAIModelManager'
import { UserAiModelService } from '@/services/settings/UserAiModelService'
import { UserApiKeyService } from '@/services/settings/UserApiKeyService'

// Mock the services
jest.mock('@/services/settings/UserAiModelService')
jest.mock('@/services/settings/UserApiKeyService')

// Mock auth provider
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
    session: {}
  })
}))

const mockAiModelService = UserAiModelService as jest.MockedClass<typeof UserAiModelService>
const mockApiKeyService = UserApiKeyService as jest.MockedClass<typeof UserApiKeyService>

describe('useAIModelManager', () => {
  let mockAiModelServiceInstance: jest.Mocked<UserAiModelService>
  let mockApiKeyServiceInstance: jest.Mocked<UserApiKeyService>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockAiModelServiceInstance = {
      getUserModelPreferences: jest.fn(),
      saveModelPreference: jest.fn(),
      getDefaultModel: jest.fn(),
      setDefaultModel: jest.fn(),
      deleteModelPreference: jest.fn(),
      bulkUpdatePreferences: jest.fn()
    } as any

    mockApiKeyServiceInstance = {
      getUserApiKeys: jest.fn(),
      saveApiKey: jest.fn(),
      validateApiKey: jest.fn(),
      deleteApiKey: jest.fn()
    } as any

    mockAiModelService.mockImplementation(() => mockAiModelServiceInstance)
    mockApiKeyService.mockImplementation(() => mockApiKeyServiceInstance)
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useAIModelManager())

    expect(result.current.models).toEqual([])
    expect(result.current.apiKeys).toEqual({})
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should load user preferences on mount', async () => {
    const mockPreferences = [
      {
        id: '1',
        provider: 'openai' as const,
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        isEnabled: true,
        parameters: { temperature: 0.7 },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    const mockApiKeys = [
      {
        id: '1',
        provider: 'openai' as const,
        isValid: true,
        hasKey: true,
        lastValidatedAt: new Date(),
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue(mockPreferences)
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue(mockApiKeys)

    const { result } = renderHook(() => useAIModelManager())

    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.models).toEqual(mockPreferences)
    expect(result.current.apiKeys).toEqual({ openai: mockApiKeys[0] })
    expect(result.current.loading).toBe(false)
  })

  it('should handle loading errors', async () => {
    const error = new Error('Failed to load preferences')
    mockAiModelServiceInstance.getUserModelPreferences.mockRejectedValue(error)

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(result.current.error).toBe(error.message)
    expect(result.current.loading).toBe(false)
  })

  it('should save model preference', async () => {
    const mockSavedPreference = {
      id: '1',
      provider: 'anthropic' as const,
      modelName: 'claude-3-sonnet',
      displayName: 'Claude 3 Sonnet',
      isDefault: false,
      isEnabled: true,
      parameters: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])
    mockAiModelServiceInstance.saveModelPreference.mockResolvedValue(mockSavedPreference)

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await result.current.saveModelPreference('anthropic', 'claude-3-sonnet', {
        isEnabled: true
      })
    })

    expect(mockAiModelServiceInstance.saveModelPreference).toHaveBeenCalledWith(
      'test-user-123',
      'anthropic',
      'claude-3-sonnet',
      { isEnabled: true }
    )
  })

  it('should validate API key', async () => {
    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])
    mockApiKeyServiceInstance.validateApiKey.mockResolvedValue({
      isValid: true,
      provider: 'openai',
      model: 'gpt-4o'
    })

    const { result } = renderHook(() => useAIModelManager())

    let validationResult: any
    await act(async () => {
      validationResult = await result.current.validateApiKey('openai', 'test-key')
    })

    expect(validationResult.isValid).toBe(true)
    expect(mockApiKeyServiceInstance.validateApiKey).toHaveBeenCalledWith(
      'test-user-123',
      'openai',
      'test-key'
    )
  })

  it('should handle API key validation errors', async () => {
    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])
    mockApiKeyServiceInstance.validateApiKey.mockRejectedValue(new Error('Invalid key'))

    const { result } = renderHook(() => useAIModelManager())

    let validationResult: any
    await act(async () => {
      validationResult = await result.current.validateApiKey('openai', 'invalid-key')
    })

    expect(validationResult.isValid).toBe(false)
    expect(validationResult.error).toBe('Invalid key')
  })

  it('should toggle model enabled state', async () => {
    const mockPreference = {
      id: '1',
      provider: 'openai' as const,
      modelName: 'gpt-4o',
      displayName: 'GPT-4o',
      isDefault: true,
      isEnabled: true,
      parameters: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([mockPreference])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])
    mockAiModelServiceInstance.saveModelPreference.mockResolvedValue({
      ...mockPreference,
      isEnabled: false
    })

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.toggleModel('openai', 'gpt-4o')
    })

    expect(mockAiModelServiceInstance.saveModelPreference).toHaveBeenCalledWith(
      'test-user-123',
      'openai',
      'gpt-4o',
      expect.objectContaining({ isEnabled: false })
    )
  })

  it('should set default model', async () => {
    const mockPreference = {
      id: '1',
      provider: 'openai' as const,
      modelName: 'gpt-4o',
      displayName: 'GPT-4o',
      isDefault: false,
      isEnabled: true,
      parameters: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([mockPreference])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])
    mockAiModelServiceInstance.setDefaultModel.mockResolvedValue({
      ...mockPreference,
      isDefault: true
    })

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.setDefaultModel('openai', 'gpt-4o')
    })

    expect(mockAiModelServiceInstance.setDefaultModel).toHaveBeenCalledWith(
      'test-user-123',
      'openai',
      'gpt-4o'
    )
  })

  it('should get active models with valid keys', async () => {
    const mockPreferences = [
      {
        id: '1',
        provider: 'openai' as const,
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        isEnabled: true,
        parameters: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        provider: 'anthropic' as const,
        modelName: 'claude-3-sonnet',
        displayName: 'Claude 3 Sonnet',
        isDefault: false,
        isEnabled: true,
        parameters: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    const mockApiKeys = [
      {
        id: '1',
        provider: 'openai' as const,
        isValid: true,
        hasKey: true,
        lastValidatedAt: new Date(),
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // No API key for anthropic
    ]

    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue(mockPreferences)
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue(mockApiKeys)

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const activeModels = result.current.getActiveModelsWithKeys()
    
    // Only OpenAI should be active (has valid key)
    expect(activeModels).toHaveLength(1)
    expect(activeModels[0].provider).toBe('openai')
  })

  it('should refresh data', async () => {
    mockAiModelServiceInstance.getUserModelPreferences.mockResolvedValue([])
    mockApiKeyServiceInstance.getUserApiKeys.mockResolvedValue([])

    const { result } = renderHook(() => useAIModelManager())

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockAiModelServiceInstance.getUserModelPreferences).toHaveBeenCalledTimes(2) // Initial load + refresh
    expect(mockApiKeyServiceInstance.getUserApiKeys).toHaveBeenCalledTimes(2)
  })
})