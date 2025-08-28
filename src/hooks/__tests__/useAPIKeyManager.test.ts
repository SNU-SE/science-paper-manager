import { renderHook, act } from '@testing-library/react'
import { useAPIKeyManager } from '../useAPIKeyManager'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('useAPIKeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  it('initializes with empty API keys', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.apiKeys).toEqual({
      openai: { key: '', isValid: false, isEnabled: false, usage: { tokensUsed: 0, cost: 0, requestCount: 0 } },
      anthropic: { key: '', isValid: false, isEnabled: false, usage: { tokensUsed: 0, cost: 0, requestCount: 0 } },
      xai: { key: '', isValid: false, isEnabled: false, usage: { tokensUsed: 0, cost: 0, requestCount: 0 } },
      gemini: { key: '', isValid: false, isEnabled: false, usage: { tokensUsed: 0, cost: 0, requestCount: 0 } }
    })
  })

  it('loads existing API keys from localStorage', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'true'
      if (key === 'apiUsage_openai') return JSON.stringify({
        tokensUsed: 1000,
        cost: 0.02,
        requestCount: 5
      })
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    expect(result.current.apiKeys.openai).toEqual({
      key: 'sk-test-key',
      isValid: false,
      isEnabled: true,
      usage: { tokensUsed: 1000, cost: 0.02, requestCount: 5 }
    })
  })

  it('returns API key for service', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    expect(result.current.getApiKey('openai')).toBe('sk-test-key')
    expect(result.current.getApiKey('anthropic')).toBe('')
  })

  it('checks if service is enabled', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'true'
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    // Update to make it valid
    act(() => {
      result.current.updateApiKey('openai', 'sk-test-key', true)
    })

    expect(result.current.isServiceEnabled('openai')).toBe(true)
    expect(result.current.isServiceEnabled('anthropic')).toBe(false)
  })

  it('returns enabled services', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'true'
      if (key === 'apiKey_anthropic') return 'sk-ant-test'
      if (key === 'apiEnabled_anthropic') return 'true'
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    // Update to make them valid
    act(() => {
      result.current.updateApiKey('openai', 'sk-test-key', true)
      result.current.updateApiKey('anthropic', 'sk-ant-test', true)
    })

    const enabledServices = result.current.getEnabledServices()
    expect(enabledServices).toContain('openai')
    expect(enabledServices).toContain('anthropic')
    expect(enabledServices).not.toContain('xai')
    expect(enabledServices).not.toContain('gemini')
  })

  it('updates API key and stores in localStorage', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.updateApiKey('openai', 'sk-new-key', true)
    })

    expect(result.current.apiKeys.openai.key).toBe('sk-new-key')
    expect(result.current.apiKeys.openai.isValid).toBe(true)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiKey_openai', 'sk-new-key')
  })

  it('removes API key when empty string is provided', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.updateApiKey('openai', '', false)
    })

    expect(result.current.apiKeys.openai.key).toBe('')
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('apiKey_openai')
  })

  it('toggles service enabled state', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.toggleService('openai', true)
    })

    expect(result.current.apiKeys.openai.isEnabled).toBe(true)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiEnabled_openai', 'true')
  })

  it('records usage stats', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.recordUsage('openai', {
        tokensUsed: 100,
        processingTimeMs: 1000,
        cost: 0.002
      })
    })

    expect(result.current.apiKeys.openai.usage).toEqual({
      tokensUsed: 100,
      cost: 0.002,
      requestCount: 1
    })
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'apiUsage_openai',
      JSON.stringify({ tokensUsed: 100, cost: 0.002, requestCount: 1 })
    )
  })

  it('accumulates usage stats', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.recordUsage('openai', {
        tokensUsed: 100,
        processingTimeMs: 1000,
        cost: 0.002
      })
    })

    act(() => {
      result.current.recordUsage('openai', {
        tokensUsed: 50,
        processingTimeMs: 500,
        cost: 0.001
      })
    })

    expect(result.current.apiKeys.openai.usage).toEqual({
      tokensUsed: 150,
      cost: 0.003,
      requestCount: 2
    })
  })

  it('returns usage stats for service', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiUsage_openai') return JSON.stringify({
        tokensUsed: 1000,
        cost: 0.02,
        requestCount: 5
      })
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    const usage = result.current.getUsageStats('openai')
    expect(usage).toEqual({
      tokensUsed: 1000,
      cost: 0.02,
      requestCount: 5
    })
  })

  it('calculates total usage across all services', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiUsage_openai') return JSON.stringify({
        tokensUsed: 1000,
        cost: 0.02,
        requestCount: 5
      })
      if (key === 'apiUsage_anthropic') return JSON.stringify({
        tokensUsed: 500,
        cost: 0.01,
        requestCount: 3
      })
      return null
    })

    const { result } = renderHook(() => useAPIKeyManager())
    
    const totalUsage = result.current.getTotalUsage()
    expect(totalUsage).toEqual({
      tokensUsed: 1500,
      cost: 0.03,
      requestCount: 8
    })
  })

  it('resets usage stats for service', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    // First add some usage
    act(() => {
      result.current.recordUsage('openai', {
        tokensUsed: 100,
        processingTimeMs: 1000,
        cost: 0.002
      })
    })

    // Then reset
    act(() => {
      result.current.resetUsageStats('openai')
    })

    expect(result.current.apiKeys.openai.usage).toEqual({
      tokensUsed: 0,
      cost: 0,
      requestCount: 0
    })
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('apiUsage_openai')
  })

  it('resets all usage stats', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    // Add usage to multiple services
    act(() => {
      result.current.recordUsage('openai', { tokensUsed: 100, processingTimeMs: 1000, cost: 0.002 })
      result.current.recordUsage('anthropic', { tokensUsed: 50, processingTimeMs: 500, cost: 0.001 })
    })

    // Reset all
    act(() => {
      result.current.resetAllUsageStats()
    })

    expect(result.current.apiKeys.openai.usage).toEqual({
      tokensUsed: 0,
      cost: 0,
      requestCount: 0
    })
    expect(result.current.apiKeys.anthropic.usage).toEqual({
      tokensUsed: 0,
      cost: 0,
      requestCount: 0
    })
  })

  it('returns valid services', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    act(() => {
      result.current.updateApiKey('openai', 'sk-test-key', true)
      result.current.updateApiKey('anthropic', 'sk-ant-test', false) // Invalid
    })

    const validServices = result.current.getValidServices()
    expect(validServices).toContain('openai')
    expect(validServices).not.toContain('anthropic')
  })

  it('checks if any valid key exists', () => {
    const { result } = renderHook(() => useAPIKeyManager())
    
    expect(result.current.hasAnyValidKey()).toBe(false)
    
    act(() => {
      result.current.updateApiKey('openai', 'sk-test-key', true)
    })

    expect(result.current.hasAnyValidKey()).toBe(true)
  })
})