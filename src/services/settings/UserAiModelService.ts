import { getSupabaseClient } from '@/lib/database'
import { UserAiModelPreference, UserAiModelPreferenceInsert, UserAiModelPreferenceUpdate } from '@/lib/database'
import { AIProvider } from './UserApiKeyService'

export interface ModelOption {
  name: string
  displayName: string
  description?: string
  maxTokens: number
  supportedFeatures: string[]
}

export interface ModelPreference {
  id: string
  provider: AIProvider
  modelName: string
  displayName: string
  isDefault: boolean
  parameters: Record<string, any>
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserAiModelService {
  private supabase = getSupabaseClient()

  // Available models per provider
  private readonly availableModels: Record<AIProvider, ModelOption[]> = {
    openai: [
      {
        name: 'gpt-4o',
        displayName: 'GPT-4o',
        description: 'Most advanced model with vision capabilities',
        maxTokens: 128000,
        supportedFeatures: ['text', 'vision', 'json']
      },
      {
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        description: 'Faster and more cost-effective',
        maxTokens: 128000,
        supportedFeatures: ['text', 'vision', 'json']
      },
      {
        name: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        description: 'Previous generation high-performance model',
        maxTokens: 128000,
        supportedFeatures: ['text', 'json']
      }
    ],
    anthropic: [
      {
        name: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Best balance of intelligence and speed',
        maxTokens: 200000,
        supportedFeatures: ['text', 'vision', 'json']
      },
      {
        name: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: 'Fastest model for simple tasks',
        maxTokens: 200000,
        supportedFeatures: ['text', 'json']
      },
      {
        name: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        maxTokens: 200000,
        supportedFeatures: ['text', 'vision', 'json']
      }
    ],
    xai: [
      {
        name: 'grok-beta',
        displayName: 'Grok Beta',
        description: 'Real-time knowledge with humor',
        maxTokens: 131072,
        supportedFeatures: ['text', 'realtime']
      }
    ],
    gemini: [
      {
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'Advanced reasoning and multimodal capabilities',
        maxTokens: 2000000,
        supportedFeatures: ['text', 'vision', 'audio', 'json']
      },
      {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Fast and efficient for high-throughput tasks',
        maxTokens: 1000000,
        supportedFeatures: ['text', 'vision', 'json']
      }
    ]
  }

  // Default parameters per provider
  private readonly defaultParameters: Record<AIProvider, Record<string, any>> = {
    openai: {
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    },
    anthropic: {
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1
    },
    xai: {
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1
    },
    gemini: {
      temperature: 0.7,
      maxOutputTokens: 4000,
      topP: 1,
      topK: 40
    }
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: AIProvider): ModelOption[] {
    return this.availableModels[provider] || []
  }

  /**
   * Get default parameters for a provider
   */
  getDefaultParameters(provider: AIProvider): Record<string, any> {
    return { ...this.defaultParameters[provider] }
  }

  /**
   * Get user's model preferences
   */
  async getUserModelPreferences(userId: string): Promise<ModelPreference[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_ai_model_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('provider', { ascending: true })
        .order('is_default', { ascending: false })

      if (error) {
        throw error
      }

      return (data || []).map(pref => ({
        id: pref.id,
        provider: pref.provider as AIProvider,
        modelName: pref.model_name,
        displayName: this.getModelDisplayName(pref.provider as AIProvider, pref.model_name),
        isDefault: pref.is_default,
        parameters: pref.parameters || this.getDefaultParameters(pref.provider as AIProvider),
        isEnabled: pref.is_enabled,
        createdAt: new Date(pref.created_at),
        updatedAt: new Date(pref.updated_at)
      }))
    } catch (error) {
      console.error('Error getting user model preferences:', error)
      throw error
    }
  }

  /**
   * Get user's default model for a provider
   */
  async getDefaultModel(userId: string, provider: AIProvider): Promise<ModelPreference | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_ai_model_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('is_default', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        return null
      }

      return {
        id: data.id,
        provider: data.provider as AIProvider,
        modelName: data.model_name,
        displayName: this.getModelDisplayName(data.provider as AIProvider, data.model_name),
        isDefault: data.is_default,
        parameters: data.parameters || this.getDefaultParameters(data.provider as AIProvider),
        isEnabled: data.is_enabled,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Error getting default model:', error)
      throw error
    }
  }

  /**
   * Save model preference
   */
  async saveModelPreference(
    userId: string,
    provider: AIProvider,
    modelName: string,
    options: {
      isDefault?: boolean
      parameters?: Record<string, any>
      isEnabled?: boolean
    } = {}
  ): Promise<ModelPreference> {
    try {
      // If setting as default, first unset other defaults for this provider
      if (options.isDefault) {
        await this.supabase
          .from('user_ai_model_preferences')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('provider', provider)
          .eq('is_default', true)
      }

      // Check if preference already exists
      const { data: existing } = await this.supabase
        .from('user_ai_model_preferences')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('model_name', modelName)
        .single()

      let result

      if (existing) {
        // Update existing preference
        const updateData: UserAiModelPreferenceUpdate = {
          is_default: options.isDefault ?? false,
          parameters: options.parameters ?? this.getDefaultParameters(provider),
          is_enabled: options.isEnabled ?? true,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await this.supabase
          .from('user_ai_model_preferences')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        result = data
      } else {
        // Insert new preference
        const insertData: UserAiModelPreferenceInsert = {
          user_id: userId,
          provider,
          model_name: modelName,
          is_default: options.isDefault ?? false,
          parameters: options.parameters ?? this.getDefaultParameters(provider),
          is_enabled: options.isEnabled ?? true
        }

        const { data, error } = await this.supabase
          .from('user_ai_model_preferences')
          .insert(insertData)
          .select()
          .single()

        if (error) throw error
        result = data
      }

      return {
        id: result.id,
        provider: result.provider as AIProvider,
        modelName: result.model_name,
        displayName: this.getModelDisplayName(result.provider as AIProvider, result.model_name),
        isDefault: result.is_default,
        parameters: result.parameters,
        isEnabled: result.is_enabled,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at)
      }
    } catch (error) {
      console.error('Error saving model preference:', error)
      throw error
    }
  }

  /**
   * Set default model for a provider
   */
  async setDefaultModel(userId: string, provider: AIProvider, modelName: string): Promise<void> {
    try {
      await this.saveModelPreference(userId, provider, modelName, { isDefault: true })
    } catch (error) {
      console.error('Error setting default model:', error)
      throw error
    }
  }

  /**
   * Update model parameters
   */
  async updateModelParameters(
    userId: string,
    provider: AIProvider,
    modelName: string,
    parameters: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_ai_model_preferences')
        .update({
          parameters,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('model_name', modelName)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating model parameters:', error)
      throw error
    }
  }

  /**
   * Delete model preference
   */
  async deleteModelPreference(userId: string, provider: AIProvider, modelName: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_ai_model_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('model_name', modelName)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting model preference:', error)
      throw error
    }
  }

  /**
   * Initialize default models for a user (called after they add their first API key)
   */
  async initializeDefaultModels(userId: string, provider: AIProvider): Promise<void> {
    try {
      const availableModels = this.getAvailableModels(provider)
      if (availableModels.length === 0) return

      // Check if user already has preferences for this provider
      const { data: existing } = await this.supabase
        .from('user_ai_model_preferences')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', provider)
        .limit(1)

      if (existing && existing.length > 0) return

      // Add the first model as default
      const defaultModel = availableModels[0]
      await this.saveModelPreference(userId, provider, defaultModel.name, {
        isDefault: true,
        isEnabled: true
      })

      // Add other models as non-default options
      for (let i = 1; i < availableModels.length; i++) {
        const model = availableModels[i]
        await this.saveModelPreference(userId, provider, model.name, {
          isDefault: false,
          isEnabled: true
        })
      }
    } catch (error) {
      console.error('Error initializing default models:', error)
      throw error
    }
  }

  /**
   * Get model display name
   */
  private getModelDisplayName(provider: AIProvider, modelName: string): string {
    const models = this.getAvailableModels(provider)
    const model = models.find(m => m.name === modelName)
    return model?.displayName || modelName
  }
}