'use client'

import { useState, useCallback, useRef } from 'react'
import { SettingsErrorHandler, SettingsError, SettingsErrorType } from '@/lib/settings-error-handler'
import { useErrorToast } from './useErrorToast'

export interface ValidationState {
  isValidating: boolean
  isValid: boolean | null
  error: SettingsError | null
  lastValidated: Date | null
  retryCount: number
}

export interface ValidationOptions {
  showToast?: boolean
  autoRetry?: boolean
  maxRetries?: number
  retryDelay?: number
  onSuccess?: () => void
  onError?: (error: SettingsError) => void
  onRetry?: (attempt: number) => void
}

export interface UseSettingsValidationReturn {
  validationState: ValidationState
  validateSetting: (
    validator: () => Promise<boolean>,
    context?: { provider?: string; field?: string },
    options?: ValidationOptions
  ) => Promise<boolean>
  retryValidation: () => Promise<boolean>
  clearValidation: () => void
  isRetryable: boolean
}

export function useSettingsValidation(): UseSettingsValidationReturn {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    isValid: null,
    error: null,
    lastValidated: null,
    retryCount: 0
  })

  const { showError, showSuccess } = useErrorToast()
  const lastValidatorRef = useRef<{
    validator: () => Promise<boolean>
    context?: { provider?: string; field?: string }
    options?: ValidationOptions
  } | null>(null)

  const validateSetting = useCallback(async (
    validator: () => Promise<boolean>,
    context?: { provider?: string; field?: string },
    options: ValidationOptions = {}
  ): Promise<boolean> => {
    const {
      showToast = true,
      autoRetry = false,
      maxRetries = 3,
      retryDelay = 1000,
      onSuccess,
      onError,
      onRetry
    } = options

    // Store for potential retry
    lastValidatorRef.current = { validator, context, options }

    setValidationState(prev => ({
      ...prev,
      isValidating: true,
      error: null
    }))

    try {
      const result = await SettingsErrorHandler.retrySettingsOperation(
        validator,
        {
          maxRetries: autoRetry ? maxRetries : 0,
          baseDelay: retryDelay,
          retryableErrors: [
            'NETWORK_TIMEOUT' as SettingsErrorType,
            'NETWORK_OFFLINE' as SettingsErrorType,
            'API_KEY_RATE_LIMITED' as SettingsErrorType,
            'SERVICE_UNAVAILABLE' as SettingsErrorType
          ]
        },
        { ...context, operation: 'validation' }
      )

      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        isValid: result,
        lastValidated: new Date(),
        retryCount: 0
      }))

      if (result && showToast) {
        showSuccess(
          `${context?.provider || 'Settings'} validation successful`,
          { title: 'Validation Complete' }
        )
      }

      if (result) {
        onSuccess?.()
      }

      return result
    } catch (error) {
      const settingsError = error as SettingsError

      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        isValid: false,
        error: settingsError,
        lastValidated: new Date(),
        retryCount: prev.retryCount + 1
      }))

      if (showToast) {
        showError(settingsError, {
          title: `${context?.provider || 'Settings'} Validation Failed`,
          onRetry: settingsError.retryable ? () => retryValidation() : undefined
        })
      }

      onError?.(settingsError)
      return false
    }
  }, [showError, showSuccess])

  const retryValidation = useCallback(async (): Promise<boolean> => {
    if (!lastValidatorRef.current) {
      return false
    }

    const { validator, context, options } = lastValidatorRef.current
    
    options?.onRetry?.(validationState.retryCount + 1)
    
    return validateSetting(validator, context, {
      ...options,
      showToast: true // Always show toast on manual retry
    })
  }, [validateSetting, validationState.retryCount])

  const clearValidation = useCallback(() => {
    setValidationState({
      isValidating: false,
      isValid: null,
      error: null,
      lastValidated: null,
      retryCount: 0
    })
    lastValidatorRef.current = null
  }, [])

  const isRetryable = validationState.error?.retryable ?? false

  return {
    validationState,
    validateSetting,
    retryValidation,
    clearValidation,
    isRetryable
  }
}

// Specialized hook for API key validation
export function useApiKeyValidation() {
  const baseValidation = useSettingsValidation()

  const validateApiKey = useCallback(async (
    provider: string,
    apiKey: string,
    testFunction: (key: string) => Promise<boolean>,
    options?: ValidationOptions
  ): Promise<boolean> => {
    if (!apiKey.trim()) {
      const error = SettingsErrorHandler.handleSettingsError(
        new Error('API key is required'),
        { provider, field: 'apiKey' }
      )
      
      if (options?.showToast !== false) {
        baseValidation.validationState.error = error
      }
      
      return false
    }

    return baseValidation.validateSetting(
      () => testFunction(apiKey),
      { provider, field: 'apiKey' },
      {
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 2000,
        ...options
      }
    )
  }, [baseValidation])

  return {
    ...baseValidation,
    validateApiKey
  }
}

// Specialized hook for settings save operations
export function useSettingsSave() {
  const [saveState, setSaveState] = useState({
    isSaving: false,
    lastSaved: null as Date | null,
    error: null as SettingsError | null
  })

  const { showError, showSuccess } = useErrorToast()

  const saveSettings = useCallback(async <T>(
    saveOperation: () => Promise<T>,
    context?: { provider?: string; operation?: string },
    options: {
      showToast?: boolean
      onSuccess?: (result: T) => void
      onError?: (error: SettingsError) => void
    } = {}
  ): Promise<T | null> => {
    const { showToast = true, onSuccess, onError } = options

    setSaveState(prev => ({
      ...prev,
      isSaving: true,
      error: null
    }))

    try {
      const result = await SettingsErrorHandler.retrySettingsOperation(
        saveOperation,
        {
          maxRetries: 2,
          baseDelay: 1000,
          retryableErrors: [
            'NETWORK_TIMEOUT' as SettingsErrorType,
            'SAVE_CONFLICT' as SettingsErrorType,
            'SERVICE_UNAVAILABLE' as SettingsErrorType
          ]
        },
        { ...context, operation: 'save' }
      )

      setSaveState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date()
      }))

      if (showToast) {
        showSuccess(
          `${context?.provider || 'Settings'} saved successfully`,
          { title: 'Settings Saved' }
        )
      }

      onSuccess?.(result)
      return result
    } catch (error) {
      const settingsError = error as SettingsError

      setSaveState(prev => ({
        ...prev,
        isSaving: false,
        error: settingsError
      }))

      if (showToast) {
        showError(settingsError, {
          title: `Failed to Save ${context?.provider || 'Settings'}`,
          onRetry: settingsError.retryable ? () => saveSettings(saveOperation, context, options) : undefined
        })
      }

      onError?.(settingsError)
      return null
    }
  }, [showError, showSuccess])

  return {
    saveState,
    saveSettings
  }
}