'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { AppError } from '@/types'
import { ErrorHandler } from '@/lib/error-handler'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: AppError) => void
}

// Hook to catch async errors that don't bubble up to error boundaries
export function useAsyncError() {
  const [, setError] = useState()
  
  return (error: unknown) => {
    setError(() => {
      throw ErrorHandler.handle(error)
    })
  }
}

// Component that can catch both sync and async errors
export function AsyncErrorBoundary({ children, fallback, onError }: AsyncErrorBoundaryProps) {
  const [asyncError, setAsyncError] = useState<Error | null>(null)

  // Reset async error when children change
  useEffect(() => {
    if (asyncError) {
      setAsyncError(null)
    }
  }, [children])

  // Throw async error to be caught by ErrorBoundary
  if (asyncError) {
    throw asyncError
  }

  return (
    <ErrorBoundary 
      fallback={fallback} 
      onError={(error, errorInfo) => {
        onError?.(error)
      }}
    >
      <AsyncErrorProvider onError={setAsyncError}>
        {children}
      </AsyncErrorProvider>
    </ErrorBoundary>
  )
}

// Context for handling async errors
const AsyncErrorContext = React.createContext<((error: Error) => void) | null>(null)

interface AsyncErrorProviderProps {
  children: ReactNode
  onError: (error: Error) => void
}

function AsyncErrorProvider({ children, onError }: AsyncErrorProviderProps) {
  return (
    <AsyncErrorContext.Provider value={onError}>
      {children}
    </AsyncErrorContext.Provider>
  )
}

// Hook to throw async errors
export function useThrowAsyncError() {
  const throwError = React.useContext(AsyncErrorContext)
  
  return (error: unknown) => {
    const appError = ErrorHandler.handle(error)
    const errorInstance = new Error(appError.message)
    errorInstance.name = appError.type
    throwError?.(errorInstance)
  }
}