// Enhanced error handling specifically for settings operations

import { AppError, ErrorType } from '@/types'
import { ErrorHandler } from './error-handler'

export enum SettingsErrorType {
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_KEY_EXPIRED = 'API_KEY_EXPIRED',
  API_KEY_INSUFFICIENT_PERMISSIONS = 'API_KEY_INSUFFICIENT_PERMISSIONS',
  API_KEY_RATE_LIMITED = 'API_KEY_RATE_LIMITED',
  API_KEY_MALFORMED = 'API_KEY_MALFORMED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_DNS_ERROR = 'NETWORK_DNS_ERROR',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  SAVE_PERMISSION_DENIED = 'SAVE_PERMISSION_DENIED',
  SAVE_QUOTA_EXCEEDED = 'SAVE_QUOTA_EXCEEDED',
  SAVE_CONFLICT = 'SAVE_CONFLICT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_MAINTENANCE = 'SERVICE_MAINTENANCE'
}

export interface SettingsError extends AppError {
  settingsType: SettingsErrorType
  provider?: string
  field?: string
  retryable: boolean
  suggestedAction?: string
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: SettingsErrorType[]
}

export class SettingsErrorHandler extends ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      SettingsErrorType.NETWORK_TIMEOUT,
      SettingsErrorType.NETWORK_OFFLINE,
      SettingsErrorType.NETWORK_DNS_ERROR,
      SettingsErrorType.API_KEY_RATE_LIMITED,
      SettingsErrorType.SERVICE_UNAVAILABLE
    ]
  }

  /**
   * Enhanced error handling for settings operations
   */
  static handleSettingsError(error: unknown, context?: {
    provider?: string
    field?: string
    operation?: string
  }): SettingsError {
    const baseError = this.handle(error)
    
    if (error instanceof Error) {
      return this.categorizeSettingsError(error, context)
    }

    return {
      ...baseError,
      settingsType: SettingsErrorType.SERVICE_UNAVAILABLE,
      provider: context?.provider,
      field: context?.field,
      retryable: false,
      suggestedAction: 'Please try again later or contact support'
    } as SettingsError
  }

  /**
   * Categorize settings-specific errors with detailed context
   */
  private static categorizeSettingsError(
    error: Error, 
    context?: { provider?: string; field?: string; operation?: string }
  ): SettingsError {
    const message = error.message.toLowerCase()
    const statusCode = this.extractStatusCode(error)

    // API Key specific errors
    if (this.isApiKeyError(message, statusCode)) {
      return this.createApiKeyError(error, message, statusCode, context)
    }

    // Network specific errors
    if (this.isNetworkError(message, statusCode)) {
      return this.createNetworkError(error, message, statusCode, context)
    }

    // Validation errors
    if (this.isValidationError(message, statusCode)) {
      return this.createValidationError(error, message, context)
    }

    // Save operation errors
    if (this.isSaveError(message, statusCode)) {
      return this.createSaveError(error, message, statusCode, context)
    }

    // Service availability errors
    if (this.isServiceError(message, statusCode)) {
      return this.createServiceError(error, message, statusCode, context)
    }

    // Default fallback
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: 'An unexpected error occurred while managing settings',
      settingsType: SettingsErrorType.SERVICE_UNAVAILABLE,
      provider: context?.provider,
      field: context?.field,
      retryable: false,
      timestamp: new Date(),
      details: { originalError: error.message, context }
    } as SettingsError
  }

  /**
   * Create API key specific error with detailed messaging
   */
  private static createApiKeyError(
    error: Error, 
    message: string, 
    statusCode?: number,
    context?: { provider?: string; field?: string }
  ): SettingsError {
    let settingsType: SettingsErrorType
    let userMessage: string
    let suggestedAction: string
    let retryable = false

    if (statusCode === 401 || message.includes('unauthorized') || message.includes('invalid')) {
      settingsType = SettingsErrorType.API_KEY_INVALID
      userMessage = `Invalid API key for ${context?.provider || 'this service'}`
      suggestedAction = 'Please check your API key and ensure it\'s correctly copied from the provider\'s dashboard'
    } else if (statusCode === 403 || message.includes('forbidden') || message.includes('permission')) {
      settingsType = SettingsErrorType.API_KEY_INSUFFICIENT_PERMISSIONS
      userMessage = `API key lacks required permissions for ${context?.provider || 'this service'}`
      suggestedAction = 'Please ensure your API key has the necessary permissions enabled'
    } else if (statusCode === 429 || message.includes('rate limit') || message.includes('quota')) {
      settingsType = SettingsErrorType.API_KEY_RATE_LIMITED
      userMessage = `Rate limit exceeded for ${context?.provider || 'this service'}`
      suggestedAction = 'Please wait a few minutes before trying again'
      retryable = true
    } else if (message.includes('expired') || message.includes('revoked')) {
      settingsType = SettingsErrorType.API_KEY_EXPIRED
      userMessage = `API key has expired for ${context?.provider || 'this service'}`
      suggestedAction = 'Please generate a new API key from the provider\'s dashboard'
    } else if (message.includes('malformed') || message.includes('format')) {
      settingsType = SettingsErrorType.API_KEY_MALFORMED
      userMessage = `API key format is invalid for ${context?.provider || 'this service'}`
      suggestedAction = 'Please check the API key format and ensure it matches the expected pattern'
    } else {
      settingsType = SettingsErrorType.API_KEY_INVALID
      userMessage = `API key validation failed for ${context?.provider || 'this service'}`
      suggestedAction = 'Please verify your API key is correct and active'
    }

    return {
      type: ErrorType.API_KEY_INVALID,
      message: userMessage,
      settingsType,
      provider: context?.provider,
      field: context?.field,
      retryable,
      suggestedAction,
      timestamp: new Date(),
      details: { originalError: error.message, statusCode, context }
    } as SettingsError
  }

  /**
   * Create network specific error with retry guidance
   */
  private static createNetworkError(
    error: Error,
    message: string,
    statusCode?: number,
    context?: { provider?: string; field?: string }
  ): SettingsError {
    let settingsType: SettingsErrorType
    let userMessage: string
    let suggestedAction: string

    if (message.includes('timeout') || statusCode === 408) {
      settingsType = SettingsErrorType.NETWORK_TIMEOUT
      userMessage = 'Request timed out while validating settings'
      suggestedAction = 'Please check your internet connection and try again'
    } else if (message.includes('offline') || message.includes('no internet')) {
      settingsType = SettingsErrorType.NETWORK_OFFLINE
      userMessage = 'No internet connection available'
      suggestedAction = 'Please check your internet connection and try again'
    } else if (message.includes('dns') || message.includes('resolve')) {
      settingsType = SettingsErrorType.NETWORK_DNS_ERROR
      userMessage = 'Unable to connect to the service'
      suggestedAction = 'Please check your internet connection or try again later'
    } else {
      settingsType = SettingsErrorType.NETWORK_TIMEOUT
      userMessage = 'Network error occurred while processing settings'
      suggestedAction = 'Please check your connection and try again'
    }

    return {
      type: ErrorType.NETWORK_ERROR,
      message: userMessage,
      settingsType,
      provider: context?.provider,
      field: context?.field,
      retryable: true,
      suggestedAction,
      timestamp: new Date(),
      details: { originalError: error.message, statusCode, context }
    } as SettingsError
  }

  /**
   * Create validation specific error
   */
  private static createValidationError(
    error: Error,
    message: string,
    context?: { provider?: string; field?: string }
  ): SettingsError {
    let settingsType: SettingsErrorType
    let userMessage: string
    let suggestedAction: string

    if (message.includes('required') || message.includes('missing')) {
      settingsType = SettingsErrorType.VALIDATION_REQUIRED_FIELD
      userMessage = `${context?.field || 'This field'} is required`
      suggestedAction = 'Please provide a value for this field'
    } else if (message.includes('format') || message.includes('invalid')) {
      settingsType = SettingsErrorType.VALIDATION_INVALID_FORMAT
      userMessage = `Invalid format for ${context?.field || 'this field'}`
      suggestedAction = 'Please check the format and try again'
    } else if (message.includes('range') || message.includes('limit')) {
      settingsType = SettingsErrorType.VALIDATION_OUT_OF_RANGE
      userMessage = `Value is out of acceptable range for ${context?.field || 'this field'}`
      suggestedAction = 'Please provide a value within the acceptable range'
    } else {
      settingsType = SettingsErrorType.VALIDATION_INVALID_FORMAT
      userMessage = `Validation failed for ${context?.field || 'settings'}`
      suggestedAction = 'Please check your input and try again'
    }

    return {
      type: ErrorType.VALIDATION_ERROR,
      message: userMessage,
      settingsType,
      provider: context?.provider,
      field: context?.field,
      retryable: false,
      suggestedAction,
      timestamp: new Date(),
      details: { originalError: error.message, context }
    } as SettingsError
  }

  /**
   * Create save operation specific error
   */
  private static createSaveError(
    error: Error,
    message: string,
    statusCode?: number,
    context?: { provider?: string; field?: string }
  ): SettingsError {
    let settingsType: SettingsErrorType
    let userMessage: string
    let suggestedAction: string
    let retryable = false

    if (statusCode === 403 || message.includes('permission') || message.includes('unauthorized')) {
      settingsType = SettingsErrorType.SAVE_PERMISSION_DENIED
      userMessage = 'Permission denied while saving settings'
      suggestedAction = 'Please ensure you\'re logged in and have permission to modify settings'
    } else if (statusCode === 413 || message.includes('quota') || message.includes('limit')) {
      settingsType = SettingsErrorType.SAVE_QUOTA_EXCEEDED
      userMessage = 'Storage quota exceeded'
      suggestedAction = 'Please contact support to increase your storage quota'
    } else if (statusCode === 409 || message.includes('conflict') || message.includes('concurrent')) {
      settingsType = SettingsErrorType.SAVE_CONFLICT
      userMessage = 'Settings were modified by another session'
      suggestedAction = 'Please refresh the page and try again'
      retryable = true
    } else {
      settingsType = SettingsErrorType.SERVICE_UNAVAILABLE
      userMessage = 'Failed to save settings'
      suggestedAction = 'Please try again or contact support if the problem persists'
      retryable = true
    }

    return {
      type: ErrorType.DATABASE_ERROR,
      message: userMessage,
      settingsType,
      provider: context?.provider,
      field: context?.field,
      retryable,
      suggestedAction,
      timestamp: new Date(),
      details: { originalError: error.message, statusCode, context }
    } as SettingsError
  }

  /**
   * Create service availability error
   */
  private static createServiceError(
    error: Error,
    message: string,
    statusCode?: number,
    context?: { provider?: string; field?: string }
  ): SettingsError {
    let settingsType: SettingsErrorType
    let userMessage: string
    let suggestedAction: string

    if (statusCode === 503 || message.includes('maintenance')) {
      settingsType = SettingsErrorType.SERVICE_MAINTENANCE
      userMessage = `${context?.provider || 'The service'} is currently under maintenance`
      suggestedAction = 'Please try again later'
    } else {
      settingsType = SettingsErrorType.SERVICE_UNAVAILABLE
      userMessage = `${context?.provider || 'The service'} is currently unavailable`
      suggestedAction = 'Please try again in a few minutes'
    }

    return {
      type: ErrorType.AI_SERVICE_ERROR,
      message: userMessage,
      settingsType,
      provider: context?.provider,
      field: context?.field,
      retryable: true,
      suggestedAction,
      timestamp: new Date(),
      details: { originalError: error.message, statusCode, context }
    } as SettingsError
  }

  /**
   * Retry operation with exponential backoff for retryable errors
   */
  static async retrySettingsOperation<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: { provider?: string; operation?: string }
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config }
    let lastError: SettingsError

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = this.handleSettingsError(error, context)
        
        // Don't retry if we've exhausted retries
        if (attempt === retryConfig.maxRetries) {
          throw lastError
        }

        // Don't retry if error is not retryable
        if (!lastError.retryable) {
          throw lastError
        }

        // Don't retry if error type is not in retryable list
        if (!retryConfig.retryableErrors.includes(lastError.settingsType)) {
          throw lastError
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        )
        const jitter = Math.random() * 0.1 * delay
        
        await new Promise(resolve => setTimeout(resolve, delay + jitter))
      }
    }

    throw lastError!
  }

  /**
   * Helper methods for error categorization
   */
  private static isApiKeyError(message: string, statusCode?: number): boolean {
    return (
      message.includes('api key') ||
      message.includes('invalid key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('permission') ||
      message.includes('expired') ||
      message.includes('malformed') ||
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 429
    )
  }

  private static isNetworkError(message: string, statusCode?: number): boolean {
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('offline') ||
      message.includes('dns') ||
      message.includes('connection') ||
      statusCode === 408 ||
      statusCode === 0
    )
  }

  private static isValidationError(message: string, statusCode?: number): boolean {
    return (
      message.includes('validation') ||
      message.includes('required') ||
      message.includes('invalid format') ||
      message.includes('out of range') ||
      statusCode === 400
    )
  }

  private static isSaveError(message: string, statusCode?: number): boolean {
    return (
      message.includes('save') ||
      message.includes('update') ||
      message.includes('insert') ||
      message.includes('permission denied') ||
      message.includes('quota exceeded') ||
      message.includes('conflict') ||
      statusCode === 409 ||
      statusCode === 413
    )
  }

  private static isServiceError(message: string, statusCode?: number): boolean {
    return (
      message.includes('service unavailable') ||
      message.includes('maintenance') ||
      message.includes('server error') ||
      statusCode === 500 ||
      statusCode === 502 ||
      statusCode === 503 ||
      statusCode === 504
    )
  }

  private static extractStatusCode(error: Error): number | undefined {
    // Try to extract status code from various error formats
    const errorStr = error.message
    
    // Check for HTTP status codes in error message
    const statusMatch = errorStr.match(/status:?\s*(\d{3})/i) || 
                       errorStr.match(/(\d{3})\s*error/i) ||
                       errorStr.match(/HTTP\s*(\d{3})/i)
    
    if (statusMatch) {
      return parseInt(statusMatch[1], 10)
    }

    // Check if error object has status property
    if ('status' in error && typeof (error as any).status === 'number') {
      return (error as any).status
    }

    // Check if error object has statusCode property
    if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
      return (error as any).statusCode
    }

    return undefined
  }
}