import { getSupabaseClient } from '@/lib/database'
import { UserApiKey, UserApiKeyInsert, UserApiKeyUpdate } from '@/lib/database'
import { validateUserId, logSecurityEvent, handleAuthError } from '@/lib/auth-helpers'
import CryptoJS from 'crypto-js'

export type AIProvider = 'openai' | 'anthropic' | 'xai' | 'gemini'

export interface APIKeyData {
  provider: AIProvider
  apiKey: string
}

export interface APIKeyInfo {
  id: string
  provider: AIProvider
  isValid: boolean
  lastValidatedAt: Date | null
  usageCount: number
  hasKey: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserApiKeyService {
  private supabase = getSupabaseClient()
  private readonly encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'fallback-key-for-development'

  /**
   * Encrypt API key for storage
   */
  private encryptApiKey(apiKey: string): string {
    return CryptoJS.AES.encrypt(apiKey, this.encryptionKey).toString()
  }

  /**
   * Decrypt API key for use
   */
  private decryptApiKey(encryptedKey: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, this.encryptionKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  /**
   * Create hash of API key for verification
   */
  private createApiKeyHash(apiKey: string): string {
    return CryptoJS.SHA256(apiKey).toString()
  }

  /**
   * Get all user's API keys (without exposing the actual keys)
   */
  async getUserApiKeys(userId: string): Promise<APIKeyInfo[]> {
    try {
      // Validate user ID format
      if (!validateUserId(userId)) {
        logSecurityEvent('invalid_session', { userId, action: 'getUserApiKeys' })
        throw new Error('Invalid user ID format')
      }

      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('provider')

      if (error) {
        const authError = handleAuthError(error)
        if (authError.statusCode === 403 || authError.statusCode === 401) {
          logSecurityEvent('unauthorized_access', { userId, action: 'getUserApiKeys', error: error.message })
        }
        throw error
      }

      return (data || []).map(key => ({
        id: key.id,
        provider: key.provider as AIProvider,
        isValid: key.is_valid,
        lastValidatedAt: key.last_validated_at ? new Date(key.last_validated_at) : null,
        usageCount: key.usage_count,
        hasKey: true, // If record exists, they have a key
        createdAt: new Date(key.created_at),
        updatedAt: new Date(key.updated_at)
      }))
    } catch (error) {
      console.error('Error getting user API keys:', error)
      throw error
    }
  }

  /**
   * Get decrypted API key for a specific provider
   */
  async getApiKey(userId: string, provider: AIProvider): Promise<string | null> {
    try {
      // Validate user ID format
      if (!validateUserId(userId)) {
        logSecurityEvent('invalid_session', { userId, provider, action: 'getApiKey' })
        throw new Error('Invalid user ID format')
      }

      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select('api_key_encrypted')
        .eq('user_id', userId)
        .eq('provider', provider)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        const authError = handleAuthError(error)
        if (authError.statusCode === 403 || authError.statusCode === 401) {
          logSecurityEvent('unauthorized_access', { userId, provider, action: 'getApiKey', error: error.message })
        }
        throw error
      }

      if (!data) {
        return null
      }

      return this.decryptApiKey(data.api_key_encrypted)
    } catch (error) {
      console.error(`Error getting API key for ${provider}:`, error)
      throw error
    }
  }

  /**
   * Save or update user's API key
   */
  async saveApiKey(userId: string, keyData: APIKeyData): Promise<APIKeyInfo> {
    try {
      // Validate user ID format
      if (!validateUserId(userId)) {
        logSecurityEvent('invalid_session', { userId, provider: keyData.provider, action: 'saveApiKey' })
        throw new Error('Invalid user ID format')
      }

      // Validate API key format
      if (!keyData.apiKey || keyData.apiKey.length < 10) {
        throw new Error('Invalid API key format')
      }

      const encryptedKey = this.encryptApiKey(keyData.apiKey)
      const keyHash = this.createApiKeyHash(keyData.apiKey)

      // Check if key already exists
      const { data: existing, error: existErr } = await this.supabase
        .from('user_api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', keyData.provider)
        .maybeSingle()

      let result

      if (existing) {
        // Update existing key
        const updateData: UserApiKeyUpdate = {
          api_key_encrypted: encryptedKey,
          api_key_hash: keyHash,
          is_valid: false, // Will be validated separately
          last_validated_at: null,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await this.supabase
          .from('user_api_keys')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) {
          const authError = handleAuthError(error)
          if (authError.statusCode === 403 || authError.statusCode === 401) {
            logSecurityEvent('unauthorized_access', { userId, provider: keyData.provider, action: 'saveApiKey', error: error.message })
          }
          throw error
        }
        result = data
      } else {
        // Insert new key
        const insertData: UserApiKeyInsert = {
          user_id: userId,
          provider: keyData.provider,
          api_key_encrypted: encryptedKey,
          api_key_hash: keyHash,
          is_valid: false,
          usage_count: 0
        }

        const { data, error } = await this.supabase
          .from('user_api_keys')
          .insert(insertData)
          .select()
          .single()

        if (error) {
          const authError = handleAuthError(error)
          if (authError.statusCode === 403 || authError.statusCode === 401) {
            logSecurityEvent('unauthorized_access', { userId, provider: keyData.provider, action: 'saveApiKey', error: error.message })
          }
          throw error
        }
        result = data
      }

      return {
        id: result.id,
        provider: result.provider as AIProvider,
        isValid: result.is_valid,
        lastValidatedAt: result.last_validated_at ? new Date(result.last_validated_at) : null,
        usageCount: result.usage_count,
        hasKey: true,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at)
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      throw error
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(userId: string, provider: AIProvider): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey(userId, provider)
      if (!apiKey) {
        return false
      }

      let isValid = false

      // Test API key with a simple request based on provider
      switch (provider) {
        case 'openai':
          isValid = await this.testOpenAIKey(apiKey)
          break
        case 'anthropic':
          isValid = await this.testAnthropicKey(apiKey)
          break
        case 'xai':
          isValid = await this.testXAIKey(apiKey)
          break
        case 'gemini':
          isValid = await this.testGeminiKey(apiKey)
          break
        default:
          isValid = false
      }

      // Update validation status
      await this.supabase
        .from('user_api_keys')
        .update({
          is_valid: isValid,
          last_validated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', provider)

      return isValid
    } catch (error) {
      console.error(`Error validating API key for ${provider}:`, error)
      return false
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(userId: string, provider: AIProvider): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      throw error
    }
  }

  /**
   * Increment usage count for API key
   */
  async incrementUsage(userId: string, provider: AIProvider): Promise<void> {
    try {
      await this.supabase.rpc('increment_api_key_usage', {
        p_user_id: userId,
        p_provider: provider
      })
    } catch (error) {
      console.error('Error incrementing usage:', error)
      // Don't throw error as this is not critical
    }
  }

  // Private methods for testing API keys with enhanced error handling
  private async testOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
      }
      
      return true
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw with more context for better error handling
        throw new Error(`OpenAI validation failed: ${error.message}`)
      }
      throw new Error('OpenAI validation failed: Network error')
    }
  }

  private async testAnthropicKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`)
      }
      
      return true
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic validation failed: ${error.message}`)
      }
      throw new Error('Anthropic validation failed: Network error')
    }
  }

  private async testXAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`xAI API error (${response.status}): ${errorText}`)
      }
      
      return true
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`xAI validation failed: ${error.message}`)
      }
      throw new Error('xAI validation failed: Network error')
    }
  }

  private async testGeminiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API error (${response.status}): ${errorText}`)
      }
      
      return true
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini validation failed: ${error.message}`)
      }
      throw new Error('Gemini validation failed: Network error')
    }
  }
}
