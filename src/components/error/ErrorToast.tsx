'use client'

import { AppError, ErrorType } from '@/types'
import { Button } from '@/components/ui/button'
import { RefreshCw, X, AlertTriangle, Wifi, Key, Upload, Database, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorToastProps {
  error: AppError
  onDismiss: () => void
  onRetry?: () => void
  className?: string
}

export function ErrorToast({ error, onDismiss, onRetry, className }: ErrorToastProps) {
  const getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return <Shield className="w-5 h-5" />
      case ErrorType.API_KEY_INVALID:
        return <Key className="w-5 h-5" />
      case ErrorType.NETWORK_ERROR:
        return <Wifi className="w-5 h-5" />
      case ErrorType.UPLOAD_ERROR:
        return <Upload className="w-5 h-5" />
      case ErrorType.DATABASE_ERROR:
        return <Database className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  const getErrorColor = (type: ErrorType) => {
    switch (type) {
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.API_KEY_INVALID:
        return 'border-red-200 bg-red-50 text-red-900'
      case ErrorType.NETWORK_ERROR:
      case ErrorType.AI_SERVICE_ERROR:
        return 'border-yellow-200 bg-yellow-50 text-yellow-900'
      case ErrorType.VALIDATION_ERROR:
        return 'border-orange-200 bg-orange-50 text-orange-900'
      default:
        return 'border-red-200 bg-red-50 text-red-900'
    }
  }

  const getActionText = (type: ErrorType) => {
    switch (type) {
      case ErrorType.NETWORK_ERROR:
        return 'Retry'
      case ErrorType.API_KEY_INVALID:
        return 'Check Keys'
      case ErrorType.UPLOAD_ERROR:
        return 'Try Again'
      default:
        return 'Retry'
    }
  }

  return (
    <div className={cn(
      'flex items-start space-x-3 p-4 rounded-lg border shadow-sm',
      getErrorColor(error.type),
      className
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {getErrorIcon(error.type)}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold">
          {error.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
        </h4>
        <p className="text-sm mt-1 opacity-90">
          {error.message}
        </p>
        
        {process.env.NODE_ENV === 'development' && error.details && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100">
              Show details
            </summary>
            <pre className="text-xs mt-1 p-2 bg-black/10 rounded overflow-auto">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-8 px-3 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {getActionText(error.type)}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

interface ErrorListProps {
  errors: AppError[]
  onDismiss: (index: number) => void
  onRetry?: (index: number) => void
  maxVisible?: number
  className?: string
}

export function ErrorList({ 
  errors, 
  onDismiss, 
  onRetry, 
  maxVisible = 3,
  className 
}: ErrorListProps) {
  const visibleErrors = errors.slice(0, maxVisible)
  const hiddenCount = errors.length - maxVisible

  return (
    <div className={cn('space-y-2', className)}>
      {visibleErrors.map((error, index) => (
        <ErrorToast
          key={`${error.type}-${error.timestamp.getTime()}-${index}`}
          error={error}
          onDismiss={() => onDismiss(index)}
          onRetry={onRetry ? () => onRetry(index) : undefined}
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            +{hiddenCount} more error{hiddenCount > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}