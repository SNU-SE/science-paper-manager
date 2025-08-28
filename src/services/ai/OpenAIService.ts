import { BaseAIService } from './BaseAIService';

/**
 * OpenAI service implementation
 */
export class OpenAIService extends BaseAIService {
  private lastUsageStats = {
    tokensUsed: 0,
    processingTimeMs: 0,
    cost: 0
  };

  constructor(apiKey: string, modelName: string = 'gpt-4') {
    super(apiKey, modelName);
  }

  async summarize(text: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a scientific paper analysis assistant. Provide concise, accurate summaries of academic papers.'
            },
            {
              role: 'user',
              content: `Please provide a comprehensive summary of this scientific paper:\n\n${text}`
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usage?.total_tokens || 0)
      };

      return data.choices[0]?.message?.content || '';
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a scientific paper analysis assistant. Extract the most important keywords and key phrases from academic papers. Return only a JSON array of strings.'
            },
            {
              role: 'user',
              content: `Extract 10-15 key scientific terms, concepts, and phrases from this paper:\n\n${text}`
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usage?.total_tokens || 0)
      };

      const content = data.choices[0]?.message?.content || '[]';
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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a scientific paper analysis assistant. Analyze the scientific relevance and impact of academic papers. Return a JSON object with relevance metrics.'
            },
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
          ],
          max_tokens: 400,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.lastUsageStats = {
        tokensUsed: data.usage?.total_tokens || 0,
        processingTimeMs: Date.now() - startTime,
        cost: this.calculateCost(data.usage?.total_tokens || 0)
      };

      const content = data.choices[0]?.message?.content || '{}';
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
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getProvider(): string {
    return 'openai';
  }

  getLastUsageStats() {
    return this.lastUsageStats;
  }

  protected calculateCost(tokens: number): number {
    // GPT-4 pricing: $0.03 per 1K input tokens, $0.06 per 1K output tokens
    // Simplified calculation assuming 50/50 split
    return (tokens / 1000) * 0.045;
  }
}