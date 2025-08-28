'use client'

import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useErrorStore } from '@/stores/errorStore'
import { useErrorToast } from '@/hooks/useErrorToast'
import { AppError } from '@/types'
import { ErrorBoundary } from './ErrorBoundary'
import { AsyncErrorBoundary } from './AsyncErrorBoundary'

interface ErrorContextValue {
  handleError: (error: unknown) => AppError
  showErrorToast: (error: unknown, options?: { onRetry?: () => void }) => void
  clearErrors: () => void
  errors: AppError[]
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

interface ErrorProviderProps {
  children: ReactNode
  enableGlobalErrorHandling?: boolean
  enableErrorBoundary?: boolean
  enableAsyncErrorBoundary?: boolean
}

export function ErrorProvider({ 
  children, 
  enableGlobalErrorHandling = true,
  enableErrorBoundary = true,
  enableAsyncErrorBoundary = true
}: ErrorProviderProps) {
  const { 
    addError, 
    clearErrors, 
    errors, 
    setGlobalErrorHandling 
  } = useErrorStore()
  
  const { showError } = useErrorToast()

  useEffect(() => {
    setGlobalErrorHandling(enableGlobalErrorHandling)
  }, [enableGlobalErrorHandling, setGlobalErrorHandling])

  // Global error handlers
  useEffect(() => {
    if (!enableGlobalErrorHandling) return

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault()
      const error = addError(event.reason)
      showError(error)
    }

    const handleError = (event: ErrorEvent) => {
      event.preventDefault()
      const error = addError(event.error || event.message)
      showError(error)
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [enableGlobalErrorHandling, addError, showError])

  const handleError = (error: unknown): AppError => {
    const appError = addError(error)
    return appError
  }

  const showErrorToast = (error: unknown, options?: { onRetry?: () => void }) => {
    const appError = handleError(error)
    showError(appError, options)
  }

  const contextValue: ErrorContextValue = {
    handleError,
    showErrorToast,
    clearErrors,
    errors
  }

  let content = (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  )

  if (enableAsyncErrorBoundary) {
    content = (
      <AsyncErrorBoundary onError={handleError}>
        {content}
      </AsyncErrorBoundary>
    )
  }

  if (enableErrorBoundary) {
    content = (
      <ErrorBoundary onError={handleError}>
        {content}
      </ErrorBoundary>
    )
  }

  return content
}

export function useErrorContext() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider')
  }
  return context
}

// Higher-order component for automatic error handling
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode
    onError?: (error: AppError) => void
  }
) {
  const WrappedComponent = (props: P) => {
    const { handleError } = useErrorContext()

    const handleComponentError = (error: AppError) => {
      handleError(error)
      options?.onError?.(error)
    }

    return (
      <ErrorBoundary 
        fallback={options?.fallback}
        onError={handleComponentError}
      >
        <Component {...props} />
      </ErrorBoundary>
    )
  }

  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name})`
  
  return WrappedComponent
}