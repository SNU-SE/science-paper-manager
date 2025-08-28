'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useErrorToast } from '@/hooks/useErrorToast'
import { useRetry } from '@/hooks/useRetry'
import { useErrorStore } from '@/stores/errorStore'
import { LoadingSpinner, LoadingOverlay } from '@/components/ui/loading-spinner'
import { ProgressIndicator, StepProgress } from '@/components/ui/progress-indicator'
import { ErrorList } from './ErrorToast'
import { ErrorType } from '@/types'

/**
 * Example component demonstrating comprehensive error handling features
 * This shows how to integrate all the error handling components and hooks
 */
export function ErrorHandlingExample() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState([
    { id: '1', label: 'Initialize', status: 'pending' as const, description: 'Setting up the process' },
    { id: '2', label: 'Process Data', status: 'pending' as const, description: 'Processing your data' },
    { id: '3', label: 'Finalize', status: 'pending' as const, description: 'Completing the operation' }
  ])

  const { showError, showSuccess, showWarning, showInfo } = useErrorToast()
  const { errors, removeError, clearErrors } = useErrorStore()

  // Example async function that might fail
  const simulateAsyncOperation = async (): Promise<string> => {
    setIsLoading(true)
    setProgress(0)
    
    // Update steps
    setSteps(prev => prev.map(step => 
      step.id === '1' ? { ...step, status: 'in-progress' } : step
    ))
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    setProgress(33)
    
    setSteps(prev => prev.map(step => 
      step.id === '1' ? { ...step, status: 'completed' } :
      step.id === '2' ? { ...step, status: 'in-progress' } : step
    ))
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    setProgress(66)
    
    // Simulate random failure
    if (Math.random() > 0.7) {
      setSteps(prev => prev.map(step => 
        step.id === '2' ? { ...step, status: 'error' } : step
      ))
      throw new Error('Random operation failure')
    }
    
    setSteps(prev => prev.map(step => 
      step.id === '2' ? { ...step, status: 'completed' } :
      step.id === '3' ? { ...step, status: 'in-progress' } : step
    ))
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    setProgress(100)
    
    setSteps(prev => prev.map(step => 
      step.id === '3' ? { ...step, status: 'completed' } : step
    ))
    
    setIsLoading(false)
    return 'Operation completed successfully!'
  }

  // Use retry hook for the async operation
  const { execute, retry, isRetrying, retryCount, lastError, canRetry } = useRetry(
    simulateAsyncOperation,
    {
      maxRetries: 3,
      baseDelay: 2000,
      onRetry: (attempt, error) => {
        showWarning(`Retrying operation (attempt ${attempt}/3)...`)
        // Reset steps for retry
        setSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })))
        setProgress(0)
      }
    }
  )

  const handleExecute = async () => {
    try {
      const result = await execute()
      showSuccess(result, { title: 'Success!' })
    } catch (error) {
      showError(error, {
        title: 'Operation Failed',
        onRetry: canRetry ? retry : undefined
      })
    }
  }

  const handleRetry = async () => {
    try {
      const result = await retry()
      showSuccess(result, { title: 'Retry Successful!' })
    } catch (error) {
      showError(error, { title: 'Retry Failed' })
    }
  }

  // Example functions for different error types
  const simulateNetworkError = () => {
    const error = new Error('Failed to fetch data from server')
    showError(error, { title: 'Network Error' })
  }

  const simulateValidationError = () => {
    showError('Please fill in all required fields', { title: 'Validation Error' })
  }

  const simulateApiKeyError = () => {
    const error = new Error('Invalid API key provided')
    error.name = ErrorType.API_KEY_INVALID
    showError(error, { title: 'API Key Error' })
  }

  const showInfoMessage = () => {
    showInfo('This is an informational message')
  }

  const showWarningMessage = () => {
    showWarning('This is a warning message')
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Toast Notifications</h3>
              <div className="space-y-2">
                <Button onClick={simulateNetworkError} variant="outline" size="sm">
                  Network Error
                </Button>
                <Button onClick={simulateValidationError} variant="outline" size="sm">
                  Validation Error
                </Button>
                <Button onClick={simulateApiKeyError} variant="outline" size="sm">
                  API Key Error
                </Button>
                <Button onClick={showInfoMessage} variant="outline" size="sm">
                  Info Message
                </Button>
                <Button onClick={showWarningMessage} variant="outline" size="sm">
                  Warning Message
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Retry Operations</h3>
              <div className="space-y-2">
                <Button 
                  onClick={handleExecute} 
                  disabled={isLoading || isRetrying}
                  className="w-full"
                >
                  {isLoading || isRetrying ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">
                        {isRetrying ? `Retrying (${retryCount}/3)...` : 'Processing...'}
                      </span>
                    </>
                  ) : (
                    'Start Operation'
                  )}
                </Button>
                
                {canRetry && (
                  <Button 
                    onClick={handleRetry} 
                    variant="outline"
                    disabled={isRetrying}
                    className="w-full"
                  >
                    Manual Retry ({retryCount}/3)
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Progress Indicators */}
          {(isLoading || isRetrying) && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Progress</h4>
                <ProgressIndicator value={progress} />
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Steps</h4>
                <StepProgress steps={steps} />
              </div>
            </div>
          )}

          {/* Error Display */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Recent Errors</h4>
                <Button onClick={clearErrors} variant="outline" size="sm">
                  Clear All
                </Button>
              </div>
              <ErrorList 
                errors={errors} 
                onDismiss={removeError}
                maxVisible={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading Overlay Example */}
      <LoadingOverlay isLoading={isLoading} text="Processing your request...">
        <Card>
          <CardHeader>
            <CardTitle>Content with Loading Overlay</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This content will be covered by a loading overlay when the operation is running.</p>
            <p>The overlay provides visual feedback that something is happening in the background.</p>
          </CardContent>
        </Card>
      </LoadingOverlay>
    </div>
  )
}