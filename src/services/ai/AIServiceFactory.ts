import { BaseAIService } from './BaseAIService';
import { OpenAIService } from './OpenAIService';
import { AnthropicService } from './AnthropicService';
import { XAIService } from './XAIService';
import { GeminiService } from './GeminiService';

export type AIProvider = 'openai' | 'anthropic' | 'xai' | 'gemini';

export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
}

/**
 * Factory class for creating AI service instances
 */
export class AIServiceFactory {
  private static readonly DEFAULT_MODELS: Record<AIProvider, string> = {
    openai: 'gpt-4',
    anthropic: 'claude-3-sonnet-20240229',
    xai: 'grok-beta',
    gemini: 'gemini-1.5-pro'
  };

  /**
   * Create an AI service instance
   */
  static createService(config: AIServiceConfig): BaseAIService {
    const { provider, apiKey, modelName } = config;
    const model = modelName || this.DEFAULT_MODELS[provider];

    if (!apiKey) {
      throw new Error(`API key is required for ${provider} service`);
    }

    switch (provider) {
      case 'openai':
        return new OpenAIService(apiKey, model);
      
      case 'anthropic':
        return new AnthropicService(apiKey, model);
      
      case 'xai':
        return new XAIService(apiKey, model);
      
      case 'gemini':
        return new GeminiService(apiKey, model);
      
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Create multiple AI service instances
   */
  static createServices(configs: AIServiceConfig[]): Map<AIProvider, BaseAIService> {
    const services = new Map<AIProvider, BaseAIService>();
    
    for (const config of configs) {
      try {
        const service = this.createService(config);
        services.set(config.provider, service);
      } catch (error) {
        console.error(`Failed to create ${config.provider} service:`, error);
      }
    }
    
    return services;
  }

  /**
   * Validate API key for a specific provider
   */
  static async validateApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
    try {
      const service = this.createService({ provider, apiKey });
      return await service.validateApiKey(apiKey);
    } catch (error) {
      console.error(`Failed to validate API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): AIProvider[] {
    return Object.keys(this.DEFAULT_MODELS) as AIProvider[];
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(provider: AIProvider): string {
    return this.DEFAULT_MODELS[provider];
  }

  /**
   * Get all default models
   */
  static getDefaultModels(): Record<AIProvider, string> {
    return { ...this.DEFAULT_MODELS };
  }
}