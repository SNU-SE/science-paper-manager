import { AIServiceFactory, AIProvider } from '../AIServiceFactory';
import { OpenAIService } from '../OpenAIService';
import { AnthropicService } from '../AnthropicService';
import { XAIService } from '../XAIService';
import { GeminiService } from '../GeminiService';

describe('AIServiceFactory', () => {
  const mockApiKey = 'test-api-key';

  describe('createService', () => {
    it('should create OpenAI service', () => {
      const service = AIServiceFactory.createService({
        provider: 'openai',
        apiKey: mockApiKey
      });
      
      expect(service).toBeInstanceOf(OpenAIService);
      expect(service.getProvider()).toBe('openai');
    });

    it('should create Anthropic service', () => {
      const service = AIServiceFactory.createService({
        provider: 'anthropic',
        apiKey: mockApiKey
      });
      
      expect(service).toBeInstanceOf(AnthropicService);
      expect(service.getProvider()).toBe('anthropic');
    });

    it('should create xAI service', () => {
      const service = AIServiceFactory.createService({
        provider: 'xai',
        apiKey: mockApiKey
      });
      
      expect(service).toBeInstanceOf(XAIService);
      expect(service.getProvider()).toBe('xai');
    });

    it('should create Gemini service', () => {
      const service = AIServiceFactory.createService({
        provider: 'gemini',
        apiKey: mockApiKey
      });
      
      expect(service).toBeInstanceOf(GeminiService);
      expect(service.getProvider()).toBe('gemini');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        AIServiceFactory.createService({
          provider: 'unsupported' as AIProvider,
          apiKey: mockApiKey
        });
      }).toThrow('Unsupported AI provider: unsupported');
    });

    it('should throw error for missing API key', () => {
      expect(() => {
        AIServiceFactory.createService({
          provider: 'openai',
          apiKey: ''
        });
      }).toThrow('API key is required for openai service');
    });

    it('should use custom model name', () => {
      const customModel = 'gpt-3.5-turbo';
      const service = AIServiceFactory.createService({
        provider: 'openai',
        apiKey: mockApiKey,
        modelName: customModel
      });
      
      expect(service.getModelName()).toBe(customModel);
    });
  });

  describe('createServices', () => {
    it('should create multiple services', () => {
      const configs = [
        { provider: 'openai' as AIProvider, apiKey: mockApiKey },
        { provider: 'anthropic' as AIProvider, apiKey: mockApiKey }
      ];
      
      const services = AIServiceFactory.createServices(configs);
      
      expect(services.size).toBe(2);
      expect(services.has('openai')).toBe(true);
      expect(services.has('anthropic')).toBe(true);
    });

    it('should handle failed service creation gracefully', () => {
      const configs = [
        { provider: 'openai' as AIProvider, apiKey: mockApiKey },
        { provider: 'anthropic' as AIProvider, apiKey: '' } // Invalid config
      ];
      
      const services = AIServiceFactory.createServices(configs);
      
      expect(services.size).toBe(1);
      expect(services.has('openai')).toBe(true);
      expect(services.has('anthropic')).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all available providers', () => {
      const providers = AIServiceFactory.getAvailableProviders();
      
      expect(providers).toEqual(['openai', 'anthropic', 'xai', 'gemini']);
    });
  });

  describe('getDefaultModel', () => {
    it('should return correct default models', () => {
      expect(AIServiceFactory.getDefaultModel('openai')).toBe('gpt-4');
      expect(AIServiceFactory.getDefaultModel('anthropic')).toBe('claude-3-sonnet-20240229');
      expect(AIServiceFactory.getDefaultModel('xai')).toBe('grok-beta');
      expect(AIServiceFactory.getDefaultModel('gemini')).toBe('gemini-1.5-pro');
    });
  });
});