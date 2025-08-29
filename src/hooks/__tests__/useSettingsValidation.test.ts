import { renderHook, act } from '@testing-library/react'
import { useSettingsValidation, useApiKeyValidation, useSettingsSave } from '../useSettingsValidation'

// Mock the error handler
jest.mock('@/lib/settings-error-handler', () => ({
  SettingsErrorHandler: {
    retrySettingsOperation: jest.fn(),
    handleSettingsError: jest.fn()
  }
}))

jest.mock('../useErrorToast', () => ({
  useErrorToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn()
  })
}))

import { SettingsErrorHandler } from '@/lib/settings-error-handler'

describe('useSettingsValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateSetting', () => {
    it('should handle successful validation', async () => {
      const { result } = renderHook(() => useSettingsValidation())
      const mockValidator = jest.fn().mockResolvedValue(true)
      
      // Mock successful retry operation
      ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockResolvedValue(true)

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateSetting(mockValidator, {
          provider: 'openai',
          field: 'apiKey'
        })
      })

      expect(isValid!).toBe(true)
      expect(result.current.validationState.isValid).toBe(true)
      expect(result.current.validationState.isValidating).toBe(false)
      expect(result.current.validationState.error).toBeNull()
    })

    it('should handle validation failure', async () => {
      const mockError = new Error('Invalid API key')
      const { result } = renderHook(() => useSettingsValidation())
      const mockValidator = jest.fn().mockRejectedValue(mockError)

      // Mock the error handler to return a settings error
      const mockSettingsError = {
        type: 'API_KEY_INVALID',
        message: 'Invalid API key',
        settingsType: 'API_KEY_INVALID',
        retryable: false,
        timestamp: new Date()
      }
      ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockRejectedValue(mockSettingsError)

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.validateSetting(mockValidator, {
          provider: 'openai',
          field: 'apiKey'
        })
      })

      expect(isValid!).toBe(false)
      expect(result.current.validationState.isValid).toBe(false)
      expect(result.current.validationState.error).toBe(mockSettingsError)
    })

    it('should update validation state during validation', async () => {
      const { result } = renderHook(() => useSettingsValidation())
      const mockValidator = jest.fn()
      
      // Mock a delayed response
      ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      )

      act(() => {
        result.current.validateSetting(mockValidator)
      })

      expect(result.current.validationState.isValidating).toBe(true)

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })

      expect(result.current.validationState.isValidating).toBe(false)
    })
  })

  describe('retryValidation', () => {
    it('should retry the last validation', async () => {
      const { result } = renderHook(() => useSettingsValidation())
      const mockValidator = jest.fn()

      // Mock first call to fail, second to succeed
      ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(true)

      // First validation fails
      await act(async () => {
        try {
          await result.current.validateSetting(mockValidator, {
            provider: 'openai'
          })
        } catch (e) {
          // Expected to fail
        }
      })

      // Retry should succeed
      let isValid: boolean
      await act(async () => {
        isValid = await result.current.retryValidation()
      })

      expect(isValid!).toBe(true)
    })

    it('should return false if no previous validation', async () => {
      const { result } = renderHook(() => useSettingsValidation())

      let isValid: boolean
      await act(async () => {
        isValid = await result.current.retryValidation()
      })

      expect(isValid!).toBe(false)
    })
  })

  describe('clearValidation', () => {
    it('should reset validation state', async () => {
      const { result } = renderHook(() => useSettingsValidation())
      const mockValidator = jest.fn()
      
      ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockResolvedValue(true)

      // Perform validation
      await act(async () => {
        await result.current.validateSetting(mockValidator)
      })

      // Clear validation
      act(() => {
        result.current.clearValidation()
      })

      expect(result.current.validationState.isValid).toBeNull()
      expect(result.current.validationState.error).toBeNull()
      expect(result.current.validationState.lastValidated).toBeNull()
    })
  })
})

describe('useApiKeyValidation', () => {
  it('should validate API key with provider context', async () => {
    const { result } = renderHook(() => useApiKeyValidation())
    const mockTestFunction = jest.fn().mockResolvedValue(true)
    
    ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockResolvedValue(true)

    let isValid: boolean
    await act(async () => {
      isValid = await result.current.validateApiKey(
        'openai',
        'sk-test-key',
        mockTestFunction
      )
    })

    expect(isValid!).toBe(true)
    expect(mockTestFunction).toHaveBeenCalledWith('sk-test-key')
  })

  it('should handle empty API key', async () => {
    const { result } = renderHook(() => useApiKeyValidation())
    const mockTestFunction = jest.fn()

    let isValid: boolean
    await act(async () => {
      isValid = await result.current.validateApiKey(
        'openai',
        '',
        mockTestFunction
      )
    })

    expect(isValid!).toBe(false)
    expect(mockTestFunction).not.toHaveBeenCalled()
  })
})

describe('useSettingsSave', () => {
  it('should handle successful save operation', async () => {
    const { result } = renderHook(() => useSettingsSave())
    const mockSaveOperation = jest.fn().mockResolvedValue({ id: '123' })
    
    ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockResolvedValue({ id: '123' })

    let savedResult: any
    await act(async () => {
      savedResult = await result.current.saveSettings(mockSaveOperation, {
        provider: 'openai'
      })
    })

    expect(savedResult).toEqual({ id: '123' })
    expect(result.current.saveState.isSaving).toBe(false)
    expect(result.current.saveState.lastSaved).toBeTruthy()
    expect(result.current.saveState.error).toBeNull()
  })

  it('should handle save operation failure', async () => {
    const mockError = new Error('Save failed')
    const { result } = renderHook(() => useSettingsSave())
    const mockSaveOperation = jest.fn().mockRejectedValue(mockError)

    const mockSettingsError = {
      type: 'DATABASE_ERROR',
      message: 'Save failed',
      settingsType: 'SAVE_PERMISSION_DENIED',
      retryable: false,
      timestamp: new Date()
    }
    ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockRejectedValue(mockSettingsError)

    let savedResult: any
    await act(async () => {
      savedResult = await result.current.saveSettings(mockSaveOperation)
    })

    expect(savedResult).toBeNull()
    expect(result.current.saveState.error).toBe(mockSettingsError)
  })

  it('should update saving state during operation', async () => {
    const { result } = renderHook(() => useSettingsSave())
    const mockSaveOperation = jest.fn()
    
    ;(SettingsErrorHandler.retrySettingsOperation as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({}), 100))
    )

    act(() => {
      result.current.saveSettings(mockSaveOperation)
    })

    expect(result.current.saveState.isSaving).toBe(true)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    expect(result.current.saveState.isSaving).toBe(false)
  })
})