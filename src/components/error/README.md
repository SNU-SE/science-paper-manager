# Error Handling System

This directory contains a comprehensive error handling system for the Science Paper Manager application. The system provides consistent error handling, user feedback, retry mechanisms, and loading states throughout the application.

## Components

### ErrorBoundary
React error boundary component that catches JavaScript errors anywhere in the child component tree.

```tsx
import { ErrorBoundary, withErrorBoundary } from '@/components/error'

// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>

// As HOC
const SafeComponent = withErrorBoundary(YourComponent)
```

### AsyncErrorBoundary
Enhanced error boundary that can catch async errors that don't bubble up to regular error boundaries.

```tsx
import { AsyncErrorBoundary, useThrowAsyncError } from '@/components/error'

function YourComponent() {
  const throwAsyncError = useThrowAsyncError()
  
  const handleAsyncOperation = async () => {
    try {
      await someAsyncOperation()
    } catch (error) {
      throwAsyncError(error) // This will be caught by AsyncErrorBoundary
    }
  }
}

<AsyncErrorBoundary>
  <YourComponent />
</AsyncErrorBoundary>
```

### ErrorProvider
Global error handling provider that sets up error boundaries and global error handlers.

```tsx
import { ErrorProvider, useErrorContext } from '@/components/error'

// In your app root
<ErrorProvider
  enableGlobalErrorHandling={true}
  enableErrorBoundary={true}
  enableAsyncErrorBoundary={true}
>
  <App />
</ErrorProvider>

// In components
function YourComponent() {
  const { handleError, showErrorToast } = useErrorContext()
  
  const handleOperation = async () => {
    try {
      await someOperation()
    } catch (error) {
      showErrorToast(error, { onRetry: handleOperation })
    }
  }
}
```

### ErrorToast & ErrorList
Components for displaying error messages with actions.

```tsx
import { ErrorToast, ErrorList } from '@/components/error'

<ErrorToast 
  error={appError}
  onDismiss={() => {}}
  onRetry={() => {}}
/>

<ErrorList 
  errors={errors}
  onDismiss={(index) => {}}
  onRetry={(index) => {}}
  maxVisible={3}
/>
```

## Hooks

### useErrorToast
Hook for showing toast notifications for different types of messages.

```tsx
import { useErrorToast } from '@/hooks/useErrorToast'

function YourComponent() {
  const { showError, showSuccess, showWarning, showInfo } = useErrorToast()
  
  const handleOperation = async () => {
    try {
      await someOperation()
      showSuccess('Operation completed successfully!')
    } catch (error) {
      showError(error, {
        title: 'Operation Failed',
        onRetry: handleOperation
      })
    }
  }
}
```

### useRetry
Hook for implementing retry logic with exponential backoff.

```tsx
import { useRetry } from '@/hooks/useRetry'

function YourComponent() {
  const { execute, retry, isRetrying, retryCount, canRetry } = useRetry(
    async () => {
      // Your async operation
      return await someAsyncOperation()
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}`)
      }
    }
  )
  
  return (
    <div>
      <button onClick={execute} disabled={isRetrying}>
        {isRetrying ? 'Processing...' : 'Start Operation'}
      </button>
      {canRetry && (
        <button onClick={retry}>
          Retry ({retryCount}/3)
        </button>
      )}
    </div>
  )
}
```

### useAutoRetry
Hook that combines retry logic with state management.

```tsx
import { useAutoRetry } from '@/hooks/useRetry'

function YourComponent() {
  const { 
    data, 
    isLoading, 
    error, 
    execute, 
    retry, 
    canRetry 
  } = useAutoRetry(
    async () => await fetchData(),
    [], // dependencies
    { maxRetries: 3, autoRetry: true }
  )
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorDisplay error={error} onRetry={retry} />
  
  return <DataDisplay data={data} />
}
```

## UI Components

### LoadingSpinner
Simple loading spinner component.

```tsx
import { LoadingSpinner } from '@/components/ui/loading-spinner'

<LoadingSpinner size="lg" text="Loading..." />
```

### LoadingOverlay
Overlay that covers content during loading.

```tsx
import { LoadingOverlay } from '@/components/ui/loading-spinner'

<LoadingOverlay isLoading={isLoading} text="Processing...">
  <YourContent />
</LoadingOverlay>
```

### LoadingState
Component that handles loading, error, and empty states.

```tsx
import { LoadingState } from '@/components/ui/loading-spinner'

<LoadingState
  isLoading={isLoading}
  error={error}
  loadingText="Loading data..."
  emptyText="No data available"
  onRetry={retry}
>
  <YourContent />
</LoadingState>
```

### ProgressIndicator
Linear progress indicator with percentage display.

```tsx
import { ProgressIndicator } from '@/components/ui/progress-indicator'

<ProgressIndicator 
  value={progress} 
  max={100} 
  showPercentage={true}
/>
```

### StepProgress
Step-by-step progress indicator.

```tsx
import { StepProgress } from '@/components/ui/progress-indicator'

const steps = [
  { id: '1', label: 'Step 1', status: 'completed', description: 'Done' },
  { id: '2', label: 'Step 2', status: 'in-progress', description: 'Processing...' },
  { id: '3', label: 'Step 3', status: 'pending', description: 'Waiting' }
]

<StepProgress steps={steps} />
```

### CircularProgress
Circular progress indicator.

```tsx
import { CircularProgress } from '@/components/ui/progress-indicator'

<CircularProgress 
  value={75} 
  size={120} 
  showValue={true}
/>
```

## Store

### useErrorStore
Zustand store for managing application errors.

```tsx
import { useErrorStore, useErrorHandler } from '@/stores/errorStore'

function YourComponent() {
  const { errors, clearErrors, removeError } = useErrorStore()
  const { handleError, handleAsyncError } = useErrorHandler()
  
  const handleOperation = async () => {
    const result = await handleAsyncError(
      () => someAsyncOperation(),
      {
        onError: (error) => {
          // Custom error handling
        }
      }
    )
  }
}
```

## Error Types

The system recognizes different error types for appropriate handling:

```tsx
enum ErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}
```

## Best Practices

### 1. Use Error Boundaries
Wrap your components with error boundaries to catch unexpected errors:

```tsx
// Good
<ErrorBoundary>
  <ComplexComponent />
</ErrorBoundary>

// Better - with custom fallback
<ErrorBoundary fallback={<CustomErrorFallback />}>
  <ComplexComponent />
</ErrorBoundary>
```

### 2. Handle Async Errors Properly
Use the error handling hooks for consistent async error handling:

```tsx
// Good
const { showError } = useErrorToast()

try {
  await asyncOperation()
} catch (error) {
  showError(error)
}

// Better - with retry
const { showError } = useErrorToast()
const { execute, retry, canRetry } = useRetry(asyncOperation)

try {
  await execute()
} catch (error) {
  showError(error, { onRetry: canRetry ? retry : undefined })
}
```

### 3. Provide User Feedback
Always provide feedback for user actions:

```tsx
const { showSuccess, showError } = useErrorToast()

const handleSave = async () => {
  try {
    await saveData()
    showSuccess('Data saved successfully!')
  } catch (error) {
    showError(error, { title: 'Save Failed' })
  }
}
```

### 4. Use Loading States
Show loading states for better UX:

```tsx
const [isLoading, setIsLoading] = useState(false)

const handleOperation = async () => {
  setIsLoading(true)
  try {
    await operation()
  } finally {
    setIsLoading(false)
  }
}

return (
  <LoadingOverlay isLoading={isLoading}>
    <Content />
  </LoadingOverlay>
)
```

### 5. Implement Retry Logic
Use retry mechanisms for operations that might fail temporarily:

```tsx
const { execute, retry, canRetry, isRetrying } = useRetry(
  () => unstableOperation(),
  {
    maxRetries: 3,
    baseDelay: 1000,
    retryCondition: (error) => error.type === ErrorType.NETWORK_ERROR
  }
)
```

## Integration with Layout

The error handling system is integrated into the main layout:

```tsx
// app/layout.tsx
<ErrorProvider
  enableGlobalErrorHandling={true}
  enableErrorBoundary={true}
  enableAsyncErrorBoundary={true}
>
  <AuthProvider>
    {children}
  </AuthProvider>
  <Toaster />
</ErrorProvider>
```

This setup provides:
- Global error catching for unhandled errors
- Toast notifications for user feedback
- Error boundaries for component-level error handling
- Async error handling capabilities

## Testing

The error handling system includes comprehensive tests:

```bash
# Run error handling tests
npm test -- --testPathPatterns="error"

# Run retry mechanism tests  
npm test -- --testPathPatterns="useRetry"
```

## Example Usage

See `ErrorHandlingExample.tsx` for a comprehensive example of how to use all the error handling features together.