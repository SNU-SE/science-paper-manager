'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Clock,
  Wifi,
  WifiOff,
  Key,
  Shield,
  AlertCircle
} from 'lucide-react'
import { SettingsError, SettingsErrorType } from '@/lib/settings-error-handler'

export interface ValidationState {
  isValidating: boolean
  isValid: boolean | null
  error: SettingsError | null
  lastValidated: Date | null
  retryCount: number
}

export interface SettingsValidationFeedbackProps {
  validationState: ValidationState
  onRetry?: () => void
  showRetryButton?: boolean
  showLastValidated?: boolean
  compact?: boolean
  className?: string
}

export function SettingsValidationFeedback({
  validationState,
  onRetry,
  showRetryButton = true,
  showLastValidated = true,
  compact = false,
  className = ''
}: SettingsValidationFeedbackProps) {
  const { isValidating, isValid, error, lastValidated, retryCount } = validationState

  // Get appropriate icon based on state
  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    }
    
    if (isValid === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    
    if (error) {
      switch (error.settingsType) {
        case SettingsErrorType.API_KEY_INVALID:
        case SettingsErrorType.API_KEY_EXPIRED:
        case SettingsErrorType.API_KEY_MALFORMED:
          return <Key className="h-4 w-4 text-red-500" />
        case SettingsErrorType.API_KEY_INSUFFICIENT_PERMISSIONS:
          return <Shield className="h-4 w-4 text-red-500" />
        case SettingsErrorType.NETWORK_TIMEOUT:
        case SettingsErrorType.NETWORK_DNS_ERROR:
          return <Wifi className="h-4 w-4 text-orange-500" />
        case SettingsErrorType.NETWORK_OFFLINE:
          return <WifiOff className="h-4 w-4 text-red-500" />
        case SettingsErrorType.API_KEY_RATE_LIMITED:
          return <Clock className="h-4 w-4 text-orange-500" />
        default:
          return <XCircle className="h-4 w-4 text-red-500" />
      }
    }
    
    return <AlertTriangle className="h-4 w-4 text-gray-400" />
  }

  // Get status badge
  const getStatusBadge = () => {
    if (isValidating) {
      return <Badge variant="secondary">Validating...</Badge>
    }
    
    if (isValid === true) {
      return <Badge variant="default">Valid</Badge>
    }
    
    if (error) {
      switch (error.settingsType) {
        case SettingsErrorType.API_KEY_EXPIRED:
          return <Badge variant="destructive">Expired</Badge>
        case SettingsErrorType.API_KEY_INSUFFICIENT_PERMISSIONS:
          return <Badge variant="destructive">No Permissions</Badge>
        case SettingsErrorType.API_KEY_RATE_LIMITED:
          return <Badge variant="destructive">Rate Limited</Badge>
        case SettingsErrorType.API_KEY_MALFORMED:
          return <Badge variant="destructive">Invalid Format</Badge>
        case SettingsErrorType.NETWORK_TIMEOUT:
          return <Badge variant="destructive">Timeout</Badge>
        case SettingsErrorType.NETWORK_OFFLINE:
          return <Badge variant="destructive">Offline</Badge>
        case SettingsErrorType.SERVICE_UNAVAILABLE:
          return <Badge variant="destructive">Service Down</Badge>
        default:
          return <Badge variant="destructive">Invalid</Badge>
      }
    }
    
    return <Badge variant="secondary">Not Validated</Badge>
  }

  // Get alert variant based on error type
  const getAlertVariant = () => {
    if (!error) return 'default'
    
    switch (error.settingsType) {
      case SettingsErrorType.NETWORK_TIMEOUT:
      case SettingsErrorType.API_KEY_RATE_LIMITED:
      case SettingsErrorType.SERVICE_UNAVAILABLE:
        return 'default' // Warning style
      default:
        return 'destructive'
    }
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        {getStatusBadge()}
        {error && showRetryButton && error.retryable && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isValidating}
            className="h-6 px-2"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {getStatusBadge()}
        </div>
        
        {error && showRetryButton && error.retryable && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isValidating}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>

      {/* Error details */}
      {error && (
        <Alert variant={getAlertVariant()}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">{error.message}</div>
              
              {error.suggestedAction && (
                <div className="text-sm opacity-90">
                  <strong>Suggestion:</strong> {error.suggestedAction}
                </div>
              )}
              
              {error.details?.originalError && (
                <details className="text-xs opacity-75">
                  <summary className="cursor-pointer">Technical details</summary>
                  <pre className="mt-1 whitespace-pre-wrap">
                    {typeof error.details.originalError === 'string' 
                      ? error.details.originalError 
                      : JSON.stringify(error.details.originalError, null, 2)
                    }
                  </pre>
                </details>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Last validated info */}
      {showLastValidated && lastValidated && (
        <div className="text-sm text-gray-600 flex items-center justify-between">
          <span>Last validated: {lastValidated.toLocaleString()}</span>
          {retryCount > 0 && (
            <span className="text-orange-600">
              Retry #{retryCount}
            </span>
          )}
        </div>
      )}

      {/* Success message */}
      {isValid === true && !error && (
        <div className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Settings validated successfully
        </div>
      )}
    </div>
  )
}

// Specialized component for API key validation feedback
export function ApiKeyValidationFeedback({
  validationState,
  onRetry,
  provider,
  ...props
}: SettingsValidationFeedbackProps & { provider?: string }) {
  return (
    <SettingsValidationFeedback
      validationState={validationState}
      onRetry={onRetry}
      {...props}
    />
  )
}

// Component for network status feedback
export function NetworkStatusFeedback({
  isOnline = navigator.onLine,
  className = ''
}: {
  isOnline?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {isOnline ? (
        <>
          <Wifi className="w-3 h-3 text-green-500" />
          <span className="text-green-600">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-red-500" />
          <span className="text-red-600">Offline</span>
        </>
      )}
    </div>
  )
}