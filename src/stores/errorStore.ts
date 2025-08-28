import { create } from 'zustand'
import { AppError, ErrorType } from '@/types'
import { ErrorHandler } from '@/lib/error-handler'

interface ErrorState {
  errors: AppError[]
  isGlobalErrorHandlingEnabled: boolean
  maxErrors: number
}

interface ErrorActions {
  addError: (error: unknown) => AppError
  removeError: (index: number) => void
  clearErrors: () => void
  clearErrorsByType: (type: ErrorType) => void
  setGlobalErrorHandling: (enabled: boolean) => void
  getErrorsByType: (type: ErrorType) => AppError[]
  hasErrors: () => boolean
  getLatestError: () => AppError | null
}

export type ErrorStore = ErrorState & ErrorActions

export const useErrorStore = create<ErrorStore>((set, get) => ({
  // State
  errors: [],
  isGlobalErrorHandlingEnabled: true,
  maxErrors: 10,

  // Actions
  addError: (error: unknown) => {
    const appError = ErrorHandler.handle(error)
    ErrorHandler.logError(appError)

    set((state) => {
      const newErrors = [appError, ...state.errors].slice(0, state.maxErrors)
      return { errors: newErrors }
    })

    return appError
  },

  removeError: (index: number) => {
    set((state) => ({
      errors: state.errors.filter((_, i) => i !== index)
    }))
  },

  clearErrors: () => {
    set({ errors: [] })
  },

  clearErrorsByType: (type: ErrorType) => {
    set((state) => ({
      errors: state.errors.filter(error => error.type !== type)
    }))
  },

  setGlobalErrorHandling: (enabled: boolean) => {
    set({ isGlobalErrorHandlingEnabled: enabled })
  },

  getErrorsByType: (type: ErrorType) => {
    return get().errors.filter(error => error.type === type)
  },

  hasErrors: () => {
    return get().errors.length > 0
  },

  getLatestError: () => {
    const errors = get().errors
    return errors.length > 0 ? errors[0] : null
  }
}))

// Hook for handling errors with automatic store integration
export function useErrorHandler() {
  const { addError, removeError, clearErrors } = useErrorStore()

  const handleError = (error: unknown, options?: {
    showToast?: boolean
    logError?: boolean
  }) => {
    const appError = addError(error)
    
    // Additional error handling logic can be added here
    // For example, sending to external error tracking service
    
    return appError
  }

  const handleAsyncError = async <T>(
    asyncFn: () => Promise<T>,
    options?: {
      showToast?: boolean
      onError?: (error: AppError) => void
    }
  ): Promise<T | null> => {
    try {
      return await asyncFn()
    } catch (error) {
      const appError = handleError(error, options)
      options?.onError?.(appError)
      return null
    }
  }

  return {
    handleError,
    handleAsyncError,
    removeError,
    clearErrors
  }
}