'use client'

import { useToast } from './use-toast'
import { AppError, ErrorType } from '@/types'
import { ErrorHandler } from '@/lib/error-handler'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function useErrorToast() {
  const { toast } = useToast()

  const showError = (error: unknown, options?: {
    title?: string
    onRetry?: () => void
    duration?: number
  }) => {
    const appError = ErrorHandler.handle(error)
    ErrorHandler.logError(appError)

    const getErrorTitle = (errorType: ErrorType): string => {
      switch (errorType) {
        case ErrorType.AUTHENTICATION_ERROR:
          return 'Authentication Failed'
        case ErrorType.API_KEY_INVALID:
          return 'Invalid API Key'
        case ErrorType.AI_SERVICE_ERROR:
          return 'AI Service Error'
        case ErrorType.UPLOAD_ERROR:
          return 'Upload Failed'
        case ErrorType.DATABASE_ERROR:
          return 'Database Error'
        case ErrorType.NETWORK_ERROR:
          return 'Network Error'
        case ErrorType.VALIDATION_ERROR:
          return 'Validation Error'
        default:
          return 'Error'
      }
    }

    const getErrorVariant = (errorType: ErrorType) => {
      switch (errorType) {
        case ErrorType.AUTHENTICATION_ERROR:
        case ErrorType.API_KEY_INVALID:
        case ErrorType.VALIDATION_ERROR:
          return 'destructive'
        case ErrorType.NETWORK_ERROR:
        case ErrorType.AI_SERVICE_ERROR:
          return 'warning'
        default:
          return 'destructive'
      }
    }

    toast({
      title: options?.title || getErrorTitle(appError.type),
      description: appError.message,
      variant: getErrorVariant(appError.type) as 'default' | 'destructive',
      duration: options?.duration || 5000,
      action: options?.onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={options.onRetry}
          className="h-8 px-3"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      ) : undefined,
    })

    return appError
  }

  const showSuccess = (message: string, options?: {
    title?: string
    duration?: number
  }) => {
    toast({
      title: options?.title || 'Success',
      description: message,
      variant: 'default',
      duration: options?.duration || 3000,
    })
  }

  const showWarning = (message: string, options?: {
    title?: string
    duration?: number
  }) => {
    toast({
      title: options?.title || 'Warning',
      description: message,
      variant: 'default',
      duration: options?.duration || 4000,
    })
  }

  const showInfo = (message: string, options?: {
    title?: string
    duration?: number
  }) => {
    toast({
      title: options?.title || 'Info',
      description: message,
      variant: 'default',
      duration: options?.duration || 3000,
    })
  }

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
  }
}