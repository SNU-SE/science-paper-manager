import { BaseAIService } from './BaseAIService';

/**
 * Anthropic Claude service implementation
 */
export class AnthropicService extends BaseAIService {
  private lastUsageStats = {
    tokensUsed: 0,
    processingTimeMs: 0,
    cost: 0
  };

  constructor(apiKey: string, modelName: string = 'claude-3-sonnet-20240229') {
    super(apiKey, modelName);
  }

  async summarize(text: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `You are a scientific paper analysis assistant. Provide a comprehensive summary of this scientific paper:\n\n${text}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCostDetailed(data.usage?.input_tokens || 0, data.usage?.output_tokens || 0)
      };

      return data.content[0]?.text || '';
    } catch (error) {
      this.lastUsageStats = {
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        cost: 0
      };
      throw error;
    }
  }

  async extractKeywords(text: string): Promise<string[]> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 200,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: `Extract 10-15 key scientific terms, concepts, and phrases from this paper. Return only a JSON array of strings:\n\n${text}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCostDetailed(data.usage?.input_tokens || 0, data.usage?.output_tokens || 0)
      };

      const content = data.content[0]?.text || '[]';
      try {
        return JSON.parse(content);
      } catch {
        // Fallback: split by commas if JSON parsing fails
        return content.split(',').map((k: string) => k.trim()).filter(Boolean);
      }
    } catch (error) {
      this.lastUsageStats = {
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        cost: 0
      };
      throw error;
    }
  }

  async analyzeRelevance(text: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 400,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: `Analyze the scientific relevance of this paper and return a JSON object with the following structure:
{
  "novelty": number (1-10),
  "methodology": number (1-10),
  "impact": number (1-10),
  "clarity": number (1-10),
  "significance": string,
  "strengths": string[],
  "limitations": string[]
}

Paper text:\n\n${text}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCostDetailed(data.usage?.input_tokens || 0, data.usage?.output_tokens || 0)
      };

      const content = data.content[0]?.text || '{}';
      try {
        return JSON.parse(content);
      } catch {
        return { error: 'Failed to parse relevance analysis' };
      }
    } catch (error) {
      this.lastUsageStats = {
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        cost: 0
      };
      throw error;
    }
  }

  async validateApiKey(key: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 1,
          messages: [
            {
              role: 'user',
              content: 'test'
            }
          ]
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProvider(): string {
    return 'anthropic';
  }

  getLastUsageStats() {
    return this.lastUsageStats;
  }

  protected calculateCost(tokensUsed: number): number {
    // Simplified calculation assuming 50/50 split for input/output tokens
    const inputTokens = tokensUsed * 0.5;
    const outputTokens = tokensUsed * 0.5;
    return this.calculateCostDetailed(inputTokens, outputTokens);
  }

  private calculateCostDetailed(inputTokens: number, outputTokens: number): number {
    // Claude 3 Sonnet pricing: $3 per 1M input tokens, $15 per 1M output tokens
    return (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15;
  }
}