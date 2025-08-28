import { BaseAIService } from './BaseAIService';

/**
 * Google Gemini service implementation
 */
export class GeminiService extends BaseAIService {
  private lastUsageStats = {
    tokensUsed: 0,
    processingTimeMs: 0,
    cost: 0
  };

  constructor(apiKey: string, modelName: string = 'gemini-1.5-pro') {
    super(apiKey, modelName);
  }

  async summarize(text: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a scientific paper analysis assistant. Provide a comprehensive summary of this scientific paper:\n\n${text}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usageMetadata?.totalTokenCount || 0)
      };

      return data.candidates[0]?.content?.parts[0]?.text || '';
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract 10-15 key scientific terms, concepts, and phrases from this paper. Return only a JSON array of strings:\n\n${text}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usageMetadata?.totalTokenCount || 0)
      };

      const content = data.candidates[0]?.content?.parts[0]?.text || '[]';
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze the scientific relevance of this paper and return a JSON object with the following structure:
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
            }
          ],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usageMetadata?.totalTokenCount || 0)
      };

      const content = data.candidates[0]?.content?.parts[0]?.text || '{}';
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
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getProvider(): string {
    return 'gemini';
  }

  getLastUsageStats() {
    return this.lastUsageStats;
  }

  protected calculateCost(tokens: number): number {
    // Gemini 1.5 Pro pricing: $3.50 per 1M input tokens, $10.50 per 1M output tokens
    // Simplified calculation assuming 50/50 split
    return (tokens / 1000000) * 7;
  }
}