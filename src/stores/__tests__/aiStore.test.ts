import { renderHook, act } from '@testing-library/react'
import { useAIStore } from '../aiStore'
import { AIModel, UsageStats } from '@/types'

// Mock fetch
global.fetch = jest.fn()

const mockUsageStats: UsageStats = {
  tokensUsed: 100,
  requestCount: 5,
  estimatedCost: 0.02,
  lastUsed: new Date('2023-01-01')
}

describe('aiStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    useAIStore.setState({
      apiKeys: {},
      activeModels: new Set(),
      usage: {},
      isValidating: false,
      validationErrors: {}
    })
  })

  describe('updateApiKey', () => {
    it('should update API key', () => {
      const { result } = renderHook(() => useAIStore())

      act(() => {
        result.current.updateApiKey('openai', 'test-key')
      })

      expect(result.current.apiKeys.openai).toBe('test-key')
    })

    it('should clear validation error when updating key', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial validation error
      act(() => {
        useAIStore.setState({ 
          validationErrors: { openai: 'Invalid key' }
        })
      })

      act(() => {
        result.current.updateApiKey('openai', 'new-key')
      })

      expect(result.current.validationErrors.openai).toBeUndefined()
    })
  })

  describe('removeApiKey', () => {
    it('should remove API key and deactivate model', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial state
      act(() => {
        useAIStore.setState({
          apiKeys: { openai: 'test-key' },
          activeModels: new Set(['openai']),
          validationErrors: { openai: 'Some error' }
        })
      })

      act(() => {
        result.current.removeApiKey('openai')
      })

      expect(result.current.apiKeys.openai).toBeUndefined()
      expect(result.current.activeModels.has('openai')).toBe(false)
      expect(result.current.validationErrors.openai).toBeUndefined()
    })
  })

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true })
      } as Response)

      const { result } = renderHook(() => useAIStore())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateApiKey('openai', 'valid-key')
      })

      expect(isValid!).toBe(true)
      expect(result.current.isValidating).toBe(false)
      expect(result.current.validationErrors.openai).toBeUndefined()
    })

    it('should handle invalid API key', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, error: 'Invalid key' })
      } as Response)

      const { result } = renderHook(() => useAIStore())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateApiKey('openai', 'invalid-key')
      })

      expect(isValid!).toBe(false)
      expect(result.current.validationErrors.openai).toBe('Invalid key')
    })

    it('should handle validation error', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAIStore())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateApiKey('openai', 'test-key')
      })

      expect(isValid!).toBe(false)
      expect(result.current.validationErrors.openai).toBe('Failed to validate API key')
    })
  })

  describe('toggleModel', () => {
    it('should activate inactive model', () => {
      const { result } = renderHook(() => useAIStore())

      act(() => {
        result.current.toggleModel('openai')
      })

      expect(result.current.activeModels.has('openai')).toBe(true)
    })

    it('should deactivate active model', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial active model
      act(() => {
        useAIStore.setState({ activeModels: new Set(['openai']) })
      })

      act(() => {
        result.current.toggleModel('openai')
      })

      expect(result.current.activeModels.has('openai')).toBe(false)
    })
  })

  describe('setActiveModels', () => {
    it('should set active models', () => {
      const { result } = renderHook(() => useAIStore())

      act(() => {
        result.current.setActiveModels(['openai', 'anthropic'])
      })

      expect(result.current.activeModels.has('openai')).toBe(true)
      expect(result.current.activeModels.has('anthropic')).toBe(true)
      expect(result.current.activeModels.size).toBe(2)
    })
  })

  describe('updateUsage', () => {
    it('should update usage stats', () => {
      const { result } = renderHook(() => useAIStore())

      act(() => {
        result.current.updateUsage('openai', {
          tokensUsed: 50,
          requestCount: 1,
          estimatedCost: 0.01
        })
      })

      const usage = result.current.getUsage('openai')
      expect(usage?.tokensUsed).toBe(50)
      expect(usage?.requestCount).toBe(1)
      expect(usage?.estimatedCost).toBe(0.01)
    })

    it('should accumulate usage stats', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial usage
      act(() => {
        useAIStore.setState({
          usage: { openai: mockUsageStats }
        })
      })

      act(() => {
        result.current.updateUsage('openai', {
          tokensUsed: 50,
          requestCount: 2,
          estimatedCost: 0.01
        })
      })

      const usage = result.current.getUsage('openai')
      expect(usage?.tokensUsed).toBe(150) // 100 + 50
      expect(usage?.requestCount).toBe(7) // 5 + 2
      expect(usage?.estimatedCost).toBe(0.03) // 0.02 + 0.01
    })
  })

  describe('resetUsage', () => {
    it('should reset usage for specific service', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial usage
      act(() => {
        useAIStore.setState({
          usage: { 
            openai: mockUsageStats,
            anthropic: mockUsageStats
          }
        })
      })

      act(() => {
        result.current.resetUsage('openai')
      })

      expect(result.current.getUsage('openai')).toBeUndefined()
      expect(result.current.getUsage('anthropic')).toBeDefined()
    })

    it('should reset all usage when no service specified', () => {
      const { result } = renderHook(() => useAIStore())
      
      // Set initial usage
      act(() => {
        useAIStore.setState({
          usage: { 
            openai: mockUsageStats,
            anthropic: mockUsageStats
          }
        })
      })

      act(() => {
        result.current.resetUsage()
      })

      expect(Object.keys(result.current.usage)).toHaveLength(0)
    })
  })

  describe('utility methods', () => {
    it('should check if model is active', () => {
      const { result } = renderHook(() => useAIStore())
      
      act(() => {
        useAIStore.setState({ activeModels: new Set(['openai']) })
      })

      expect(result.current.isModelActive('openai')).toBe(true)
      expect(result.current.isModelActive('anthropic')).toBe(false)
    })

    it('should check if model has valid key', () => {
      const { result } = renderHook(() => useAIStore())
      
      act(() => {
        useAIStore.setState({
          apiKeys: { openai: 'test-key', anthropic: 'test-key' },
          validationErrors: { anthropic: 'Invalid key' }
        })
      })

      expect(result.current.hasValidKey('openai')).toBe(true)
      expect(result.current.hasValidKey('anthropic')).toBe(false)
      expect(result.current.hasValidKey('xai')).toBe(false)
    })

    it('should get active models with valid keys', () => {
      const { result } = renderHook(() => useAIStore())
      
      act(() => {
        useAIStore.setState({
          activeModels: new Set(['openai', 'anthropic', 'xai']),
          apiKeys: { openai: 'key1', anthropic: 'key2' },
          validationErrors: { anthropic: 'Invalid key' }
        })
      })

      const activeWithKeys = result.current.getActiveModelsWithKeys()
      expect(activeWithKeys).toEqual(['openai'])
    })

    it('should clear validation errors', () => {
      const { result } = renderHook(() => useAIStore())
      
      act(() => {
        useAIStore.setState({
          validationErrors: { openai: 'Error 1', anthropic: 'Error 2' }
        })
      })

      act(() => {
        result.current.clearValidationErrors()
      })

      expect(Object.keys(result.current.validationErrors)).toHaveLength(0)
    })
  })
})