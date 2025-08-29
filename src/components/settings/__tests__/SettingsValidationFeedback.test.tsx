import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsValidationFeedback } from '../SettingsValidationFeedback'
import { SettingsErrorType } from '@/lib/settings-error-handler'

describe('SettingsValidationFeedback', () => {
  const mockValidationState = {
    isValidating: false,
    isValid: null,
    error: null,
    lastValidated: null,
    retryCount: 0
  }

  it('should show loading state when validating', () => {
    const validationState = {
      ...mockValidationState,
      isValidating: true
    }

    render(<SettingsValidationFeedback validationState={validationState} />)
    
    expect(screen.getByText('Validating...')).toBeInTheDocument()
  })

  it('should show success state when valid', () => {
    const validationState = {
      ...mockValidationState,
      isValid: true
    }

    render(<SettingsValidationFeedback validationState={validationState} />)
    
    expect(screen.getByText('Valid')).toBeInTheDocument()
    expect(screen.getByText('Settings validated successfully')).toBeInTheDocument()
  })

  it('should show error state with retry button', () => {
    const mockError = {
      type: 'API_KEY_INVALID' as any,
      message: 'Invalid API key',
      settingsType: 'API_KEY_INVALID' as SettingsErrorType,
      retryable: true,
      suggestedAction: 'Please check your API key',
      timestamp: new Date()
    }

    const validationState = {
      ...mockValidationState,
      isValid: false,
      error: mockError
    }

    const mockRetry = jest.fn()

    render(
      <SettingsValidationFeedback 
        validationState={validationState} 
        onRetry={mockRetry}
      />
    )
    
    expect(screen.getByText('Invalid API key')).toBeInTheDocument()
    expect(screen.getByText('Please check your API key')).toBeInTheDocument()
    
    const retryButton = screen.getByText('Retry')
    fireEvent.click(retryButton)
    expect(mockRetry).toHaveBeenCalled()
  })

  it('should show specific error badges for different error types', () => {
    const expiredError = {
      type: 'API_KEY_EXPIRED' as any,
      message: 'API key expired',
      settingsType: 'API_KEY_EXPIRED' as SettingsErrorType,
      retryable: false,
      timestamp: new Date()
    }

    const validationState = {
      ...mockValidationState,
      isValid: false,
      error: expiredError
    }

    render(<SettingsValidationFeedback validationState={validationState} />)
    
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('should show compact view when requested', () => {
    const validationState = {
      ...mockValidationState,
      isValid: true
    }

    render(
      <SettingsValidationFeedback 
        validationState={validationState} 
        compact={true}
      />
    )
    
    expect(screen.getByText('Valid')).toBeInTheDocument()
    // Should not show the detailed success message in compact mode
    expect(screen.queryByText('Settings validated successfully')).not.toBeInTheDocument()
  })

  it('should show last validated time when available', () => {
    const lastValidated = new Date('2023-01-01T12:00:00Z')
    const validationState = {
      ...mockValidationState,
      isValid: true,
      lastValidated,
      retryCount: 2
    }

    render(<SettingsValidationFeedback validationState={validationState} />)
    
    expect(screen.getByText(/Last validated:/)).toBeInTheDocument()
    expect(screen.getByText('Retry #2')).toBeInTheDocument()
  })
})