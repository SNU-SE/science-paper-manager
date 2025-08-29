# Settings Error Handling System

This document describes the enhanced error handling system implemented for settings validation and management.

## Overview

The settings error handling system provides:
- Specific error categorization for different types of failures
- Automatic retry functionality for transient errors
- User-friendly error messages with suggested actions
- Comprehensive validation feedback components

## Components

### 1. SettingsErrorHandler

The core error handling class that categorizes and processes errors.

```typescript
import { SettingsErrorHandler } from '@/lib/settings-error-handler'

// Handle a settings error
const error = SettingsErrorHandler.handleSettingsError(
  new Error('Invalid API key'),
  { provider: 'OpenAI', field: 'apiKey' }
)

// Retry an operation with automatic backoff
const result = await SettingsErrorHandler.retrySettingsOperation(
  () => validateApiKey(),
  { maxRetries: 3, baseDelay: 1000 },
  { provider: 'OpenAI' }
)
```

### 2. useSettingsValidation Hook

React hook for managing validation state with enhanced error handling.

```typescript
import { useSettingsValidation } from '@/hooks/useSettingsValidation'

function MyComponent() {
  const { validateSetting, validationState, retryValidation } = useSettingsValidation()
  
  const handleValidate = async () => {
    await validateSetting(
      () => testApiKey(apiKey),
      { provider: 'OpenAI', field: 'apiKey' },
      {
        showToast: true,
        autoRetry: true,
        maxRetries: 2
      }
    )
  }
}
```

### 3. useSettingsSave Hook

React hook for managing save operations with retry capability.

```typescript
import { useSettingsSave } from '@/hooks/useSettingsValidation'

function MyComponent() {
  const { saveSettings, saveState } = useSettingsSave()
  
  const handleSave = async () => {
    await saveSettings(
      () => apiService.saveKey(key),
      { provider: 'OpenAI', operation: 'save' },
      {
        showToast: true,
        onSuccess: (result) => console.log('Saved:', result)
      }
    )
  }
}
```

### 4. SettingsValidationFeedback Component

UI component for displaying validation status and errors.

```typescript
import { SettingsValidationFeedback } from '@/components/settings/SettingsValidationFeedback'

function MyForm() {
  const { validationState, retryValidation } = useSettingsValidation()
  
  return (
    <SettingsValidationFeedback
      validationState={validationState}
      onRetry={retryValidation}
      showRetryButton={true}
      showLastValidated={true}
    />
  )
}
```

## Error Types

### API Key Errors
- `API_KEY_INVALID`: Invalid or incorrect API key
- `API_KEY_EXPIRED`: API key has expired
- `API_KEY_INSUFFICIENT_PERMISSIONS`: API key lacks required permissions
- `API_KEY_RATE_LIMITED`: Rate limit exceeded
- `API_KEY_MALFORMED`: API key format is invalid

### Network Errors
- `NETWORK_TIMEOUT`: Request timed out
- `NETWORK_OFFLINE`: No internet connection
- `NETWORK_DNS_ERROR`: DNS resolution failed

### Validation Errors
- `VALIDATION_REQUIRED_FIELD`: Required field is missing
- `VALIDATION_INVALID_FORMAT`: Invalid format
- `VALIDATION_OUT_OF_RANGE`: Value out of acceptable range

### Save Errors
- `SAVE_PERMISSION_DENIED`: Permission denied
- `SAVE_QUOTA_EXCEEDED`: Storage quota exceeded
- `SAVE_CONFLICT`: Concurrent modification conflict

### Service Errors
- `SERVICE_UNAVAILABLE`: Service is unavailable
- `SERVICE_MAINTENANCE`: Service under maintenance

## Retry Configuration

The system supports automatic retries for transient errors:

```typescript
const retryConfig = {
  maxRetries: 3,           // Maximum number of retries
  baseDelay: 1000,         // Base delay in milliseconds
  maxDelay: 10000,         // Maximum delay cap
  backoffMultiplier: 2,    // Exponential backoff multiplier
  retryableErrors: [       // Which error types to retry
    'NETWORK_TIMEOUT',
    'API_KEY_RATE_LIMITED',
    'SERVICE_UNAVAILABLE'
  ]
}
```

## User Experience Features

### 1. Specific Error Messages
Each error type provides a specific, actionable message:
- "Invalid API key for OpenAI" instead of generic "Error occurred"
- "Rate limit exceeded. Please wait a few minutes" with timing guidance

### 2. Suggested Actions
Errors include suggested actions to help users resolve issues:
- "Please check your API key and ensure it's correctly copied"
- "Please ensure your API key has the necessary permissions enabled"

### 3. Retry Functionality
- Automatic retries for transient errors (network issues, rate limits)
- Manual retry buttons for user-initiated retries
- Visual feedback during retry attempts

### 4. Progress Indicators
- Loading states during validation and save operations
- Retry attempt counters
- Last validation timestamps

## Implementation Examples

### Enhanced API Key Manager

```typescript
function APIKeyManager() {
  const { validateApiKey, validationState } = useApiKeyValidation()
  const { saveSettings, saveState } = useSettingsSave()
  
  const handleSave = async (provider: string, apiKey: string) => {
    // Validate first
    const isValid = await validateApiKey(
      provider,
      apiKey,
      (key) => testProviderKey(provider, key)
    )
    
    if (isValid) {
      // Save if validation passes
      await saveSettings(
        () => apiKeyService.save(provider, apiKey),
        { provider, operation: 'save' }
      )
    }
  }
  
  return (
    <div>
      <Input onChange={(e) => setApiKey(e.target.value)} />
      <Button onClick={() => handleSave('openai', apiKey)}>
        Save
      </Button>
      
      <SettingsValidationFeedback
        validationState={validationState}
        onRetry={() => validateApiKey('openai', apiKey, testOpenAIKey)}
      />
    </div>
  )
}
```

### Enhanced Zotero Configuration

```typescript
function ZoteroConfig() {
  const { validateSetting, validationState } = useSettingsValidation()
  
  const testConnection = async () => {
    await validateSetting(
      () => testZoteroConnection(config),
      { provider: 'Zotero', field: 'connection' },
      {
        autoRetry: true,
        maxRetries: 2,
        onSuccess: () => setConnectionValid(true)
      }
    )
  }
  
  return (
    <form>
      <Input placeholder="API Key" />
      <Button onClick={testConnection}>Test Connection</Button>
      
      <SettingsValidationFeedback
        validationState={validationState}
        onRetry={testConnection}
      />
    </form>
  )
}
```

## Testing

The system includes comprehensive tests for:
- Error categorization accuracy
- Retry logic and backoff behavior
- Hook state management
- Component rendering and interactions

Run tests with:
```bash
npm test -- --testPathPatterns="settings-error-handler|useSettingsValidation|SettingsValidationFeedback"
```

## Best Practices

### 1. Always Provide Context
```typescript
// Good
SettingsErrorHandler.handleSettingsError(error, {
  provider: 'OpenAI',
  field: 'apiKey',
  operation: 'validation'
})

// Bad
SettingsErrorHandler.handleSettingsError(error)
```

### 2. Use Appropriate Retry Settings
```typescript
// For API key validation (may hit rate limits)
{ maxRetries: 2, baseDelay: 2000 }

// For network operations (may be transient)
{ maxRetries: 3, baseDelay: 1000 }

// For save operations (may have conflicts)
{ maxRetries: 1, baseDelay: 500 }
```

### 3. Provide User Feedback
Always use the validation feedback component to show users what's happening:
```typescript
<SettingsValidationFeedback
  validationState={validationState}
  onRetry={retryValidation}
  showRetryButton={true}
  showLastValidated={true}
/>
```

### 4. Handle Success States
Don't forget to handle and display success states:
```typescript
const { validateSetting } = useSettingsValidation()

await validateSetting(validator, context, {
  onSuccess: () => {
    toast.success('Settings validated successfully!')
    setFormValid(true)
  }
})
```

## Migration Guide

To migrate existing settings components to use the new error handling:

1. Replace manual error state management with hooks:
```typescript
// Before
const [error, setError] = useState<string | null>(null)
const [isValidating, setIsValidating] = useState(false)

// After
const { validateSetting, validationState } = useSettingsValidation()
```

2. Replace try/catch blocks with validation functions:
```typescript
// Before
try {
  setIsValidating(true)
  const result = await validateKey()
  setError(null)
} catch (err) {
  setError(err.message)
} finally {
  setIsValidating(false)
}

// After
await validateSetting(
  () => validateKey(),
  { provider: 'OpenAI' },
  { showToast: true }
)
```

3. Add validation feedback components:
```typescript
// Add to your form
<SettingsValidationFeedback
  validationState={validationState}
  onRetry={retryValidation}
/>
```

This enhanced error handling system provides a much better user experience with specific error messages, automatic retries, and clear feedback about what went wrong and how to fix it.