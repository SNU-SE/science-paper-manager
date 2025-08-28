// Error handling utilities

import { AppError, ErrorType } from '@/types'
import { ERROR_MESSAGES } from './constants'

export class ErrorHandler {
  /**
   * Handle and categorize errors
   */
  static handle(error: unknown): AppError {
    // Check if error is already an AppError by checking its structure
    if (error && typeof error === 'object' && 'type' in error && 'message' in error && 'timestamp' in error) {
      return error as AppError
    }

    if (error instanceof Error) {
      return this.categorizeError(error)
    }

    return {
      type: ErrorType.NETWORK_ERROR,
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
      timestamp: new Date()
    }
  }

  /**
   * Categorize error based on error message and type
   */
  private static categorizeError(error: Error): AppError {
    const message = error.message.toLowerCase()

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('invalid credentials')) {
      return {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
        details: { originalError: error.message },
        timestamp: new Date()
      }
    }

    // API key errors
    if (message.includes('api key') || message.includes('invalid key')) {
      return {
        type: ErrorType.API_KEY_INVALID,
        message: ERROR_MESSAGES.INVALID_API_KEY,
        details: { originalError: error.message },
        timestamp: new Date()
      }
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: ERROR_MESSAGES.NETWORK_ERROR,
        details: { originalError: error.message },
        timestamp: new Date()
      }
    }

    // Upload errors
    if (message.includes('upload') || message.includes('file')) {
      return {
        type: ErrorType.UPLOAD_ERROR,
        message: ERROR_MESSAGES.UPLOAD_FAILED,
        details: { originalError: error.message },
        timestamp: new Date()
      }
    }

    // Database errors
    if (message.includes('database') || message.includes('sql')) {
      return {
        type: ErrorType.DATABASE_ERROR,
        message: 'Database operation failed',
        details: { originalError: error.message },
        timestamp: new Date()
      }
    }

    // Default to network error
    return {
      type: ErrorType.NETWORK_ERROR,
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
      details: { originalError: error.message },
      timestamp: new Date()
    }
  }

  /**
   * Retry function with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === maxRetries) {
          throw this.handle(lastError)
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw this.handle(lastError!)
  }

  /**
   * Create a custom AppError
   */
  static createError(
    type: ErrorType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return {
      type,
      message,
      details,
      timestamp: new Date()
    }
  }

  /**
   * Log error to console (in development) or external service (in production)
   */
  static logError(error: AppError): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('Application Error:', {
        type: error.type,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp
      })
    } else {
      // In production, you might want to send to an error tracking service
      // like Sentry, LogRocket, etc.
      console.error('Error:', error.message)
    }
  }
}