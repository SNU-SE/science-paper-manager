import { SettingsErrorHandler, SettingsErrorType } from '../settings-error-handler'

describe('SettingsErrorHandler', () => {
  describe('handleSettingsError', () => {
    it('should categorize API key errors correctly', () => {
      const error = new Error('Invalid API key')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'openai',
        field: 'apiKey'
      })

      expect(result.settingsType).toBe(SettingsErrorType.API_KEY_INVALID)
      expect(result.provider).toBe('openai')
      expect(result.field).toBe('apiKey')
      expect(result.retryable).toBe(false)
      expect(result.suggestedAction).toContain('check your API key')
    })

    it('should categorize network errors correctly', () => {
      const error = new Error('Network timeout')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'anthropic'
      })

      expect(result.settingsType).toBe(SettingsErrorType.NETWORK_TIMEOUT)
      expect(result.retryable).toBe(true)
      expect(result.suggestedAction).toContain('internet connection')
    })

    it('should categorize validation errors correctly', () => {
      const error = new Error('Required field missing')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        field: 'apiKey'
      })

      expect(result.settingsType).toBe(SettingsErrorType.VALIDATION_REQUIRED_FIELD)
      expect(result.retryable).toBe(false)
    })

    it('should handle rate limiting errors', () => {
      const error = new Error('Rate limit exceeded')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'openai'
      })

      expect(result.settingsType).toBe(SettingsErrorType.API_KEY_RATE_LIMITED)
      expect(result.retryable).toBe(true)
      expect(result.suggestedAction).toContain('wait a few minutes')
    })

    it('should handle expired API key errors', () => {
      const error = new Error('API key has expired')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'gemini'
      })

      expect(result.settingsType).toBe(SettingsErrorType.API_KEY_EXPIRED)
      expect(result.retryable).toBe(false)
      expect(result.suggestedAction).toContain('generate a new API key')
    })

    it('should handle permission errors', () => {
      const error = new Error('Insufficient permissions')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'xai'
      })

      expect(result.settingsType).toBe(SettingsErrorType.API_KEY_INSUFFICIENT_PERMISSIONS)
      expect(result.retryable).toBe(false)
      expect(result.suggestedAction).toContain('necessary permissions')
    })
  })

  describe('retrySettingsOperation', () => {
    it('should retry retryable operations', async () => {
      let attempts = 0
      const operation = jest.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Network timeout')
        }
        return Promise.resolve('success')
      })

      const result = await SettingsErrorHandler.retrySettingsOperation(
        operation,
        { maxRetries: 3, baseDelay: 10 },
        { provider: 'test' }
      )

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should not retry non-retryable operations', async () => {
      let attempts = 0
      const operation = jest.fn().mockImplementation(() => {
        attempts++
        throw new Error('Invalid API key format')
      })

      await expect(
        SettingsErrorHandler.retrySettingsOperation(
          operation,
          { maxRetries: 3, baseDelay: 10 },
          { provider: 'test' }
        )
      ).rejects.toThrow()

      expect(attempts).toBe(1)
    })

    it('should respect max retries limit', async () => {
      let attempts = 0
      const operation = jest.fn().mockImplementation(() => {
        attempts++
        throw new Error('Network timeout')
      })

      await expect(
        SettingsErrorHandler.retrySettingsOperation(
          operation,
          { maxRetries: 2, baseDelay: 10 },
          { provider: 'test' }
        )
      ).rejects.toThrow()

      expect(attempts).toBe(3) // Initial attempt + 2 retries
    })
  })

  describe('error categorization', () => {
    it('should extract status codes from error messages', () => {
      const error401 = new Error('HTTP 401 Unauthorized')
      const result401 = SettingsErrorHandler.handleSettingsError(error401)
      expect(result401.settingsType).toBe(SettingsErrorType.API_KEY_INVALID)

      const error429 = new Error('Status: 429 Rate limit exceeded')
      const result429 = SettingsErrorHandler.handleSettingsError(error429)
      expect(result429.settingsType).toBe(SettingsErrorType.API_KEY_RATE_LIMITED)

      const error503 = new Error('503 Service unavailable')
      const result503 = SettingsErrorHandler.handleSettingsError(error503)
      expect(result503.settingsType).toBe(SettingsErrorType.SERVICE_UNAVAILABLE)
    })

    it('should provide appropriate suggested actions', () => {
      const malformedError = new Error('Malformed API key')
      const result = SettingsErrorHandler.handleSettingsError(malformedError, {
        provider: 'openai'
      })
      
      expect(result.suggestedAction).toContain('format')
      expect(result.suggestedAction).toContain('pattern')
    })

    it('should handle service maintenance errors', () => {
      const maintenanceError = new Error('Service under maintenance')
      const result = SettingsErrorHandler.handleSettingsError(maintenanceError, {
        provider: 'anthropic'
      })

      expect(result.settingsType).toBe(SettingsErrorType.SERVICE_MAINTENANCE)
      expect(result.retryable).toBe(true)
      expect(result.suggestedAction).toContain('try again later')
    })
  })

  describe('context handling', () => {
    it('should include provider context in error messages', () => {
      const error = new Error('Invalid key')
      const result = SettingsErrorHandler.handleSettingsError(error, {
        provider: 'OpenAI',
        field: 'apiKey'
      })

      expect(result.message).toContain('OpenAI')
      expect(result.provider).toBe('OpenAI')
      expect(result.field).toBe('apiKey')
    })

    it('should handle missing context gracefully', () => {
      const error = new Error('Invalid key')
      const result = SettingsErrorHandler.handleSettingsError(error)

      expect(result.message).toContain('this service')
      expect(result.provider).toBeUndefined()
    })
  })
})