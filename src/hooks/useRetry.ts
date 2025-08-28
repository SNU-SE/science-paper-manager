'use client'

import { useState, useCallback } from 'react'
import { ErrorHandler } from '@/lib/error-handler'
import { AppError } from '@/types'

interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: AppError) => boolean
  onRetry?: (attempt: number, error: AppError) => void
}

interface RetryState {
  isRetrying: boolean
  retryCount: number
  lastError: AppError | null
}

export function useRetry<T>(
  asyncFunction: () => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = () => true,
    onRetry
  } = options

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null
  })

  const execute = useCallback(async (): Promise<T> => {
    setState(prev => ({ ...prev, isRetrying: true, lastError: null }))

    try {
      const result = await ErrorHandler.retryWithBackoff(
        asyncFunction,
        maxRetries,
        baseDelay
      )
      
      setState(prev => ({ ...prev, isRetrying: false, retryCount: 0 }))
      return result
    } catch (error) {
      const appError = ErrorHandler.handle(error)
      setState(prev => ({ 
        ...prev, 
        isRetrying: false, 
        lastError: appError,
        retryCount: prev.retryCount + 1
      }))
      throw appError
    }
  }, [asyncFunction, maxRetries, baseDelay])

  const retry = useCallback(async (): Promise<T> => {
    if (state.retryCount >= maxRetries) {
      throw ErrorHandler.createError(
        'NETWORK_ERROR' as any,
        `Maximum retry attempts (${maxRetries}) exceeded`
      )
    }

    if (state.lastError && !retryCondition(state.lastError)) {
      throw state.lastError
    }

    onRetry?.(state.retryCount + 1, state.lastError!)
    return execute()
  }, [state, maxRetries, retryCondition, onRetry, execute])

  const reset = useCallback(() => {
    setState({
      isRetrying: false,
      retryCount: 0,
      lastError: null
    })
  }, [])

  return {
    execute,
    retry,
    reset,
    ...state,
    canRetry: state.retryCount < maxRetries && state.lastError !== null
  }
}

// Hook for automatic retry with exponential backoff
export function useAutoRetry<T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList,
  options: RetryOptions & { autoRetry?: boolean } = {}
) {
  const { autoRetry = false, ...retryOptions } = options
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const { execute, retry, reset, isRetrying, retryCount, lastError, canRetry } = useRetry(
    asyncFunction,
    retryOptions
  )

  const executeWithState = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await execute()
      setData(result)
      return result
    } catch (error) {
      if (autoRetry && canRetry) {
        // Auto retry after a delay
        setTimeout(() => {
          retry().then(setData).catch(() => {})
        }, 2000)
      }
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [execute, autoRetry, canRetry, retry])

  const retryWithState = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await retry()
      setData(result)
      return result
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [retry])

  return {
    data,
    isLoading: isLoading || isRetrying,
    error: lastError,
    retryCount,
    canRetry,
    execute: executeWithState,
    retry: retryWithState,
    reset: () => {
      reset()
      setData(null)
    }
  }
}

// Utility function for creating retry-enabled API calls
export function createRetryableFunction<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
) {
  return async (): Promise<T> => {
    return ErrorHandler.retryWithBackoff(fn, options.maxRetries, options.baseDelay)
  }
}