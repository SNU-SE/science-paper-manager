import { SupabaseVectorService } from '@/services/vector/SupabaseVectorService'
import type { ChatMessage, RAGResponse, SearchFilters } from '@/types'

export interface RAGServiceConfig {
  openaiApiKey: string
  maxContextPapers?: number
  similarityThreshold?: number
}

/**
 * RAGService manages conversational RAG interactions
 * Handles chat history, context management, and answer generation
 */
export class RAGService {
  private vectorService: SupabaseVectorService
  private config: Required<RAGServiceConfig>
  private chatHistory: ChatMessage[] = []

  constructor(config: RAGServiceConfig) {
    this.config = {
      maxContextPapers: 5,
      similarityThreshold: 0.6,
      ...config
    }
    
    this.vectorService = new SupabaseVectorService(config.openaiApiKey)
  }

  /**
   * Process a user question and generate a response
   */
  async askQuestion(
    question: string, 
    filters?: SearchFilters,
    _conversationId?: string
  ): Promise<ChatMessage> {
    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: question,
        timestamp: new Date()
      }
      
      this.chatHistory.push(userMessage)

      // Build context from conversation history
      const contextualQuestion = this.buildContextualQuestion(question)
      
      // Get RAG response via API
      const ragResponse = await this.queryRAGAPI(contextualQuestion, filters)

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        sources: ragResponse.sources
      }

      this.chatHistory.push(assistantMessage)

      return assistantMessage
    } catch (error) {
      console.error('RAG question processing failed:', error)
      
      // Create error message
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your question. Please try again or rephrase your question.',
        timestamp: new Date()
      }

      this.chatHistory.push(errorMessage)
      return errorMessage
    }
  }

  /**
   * Get chat history
   */
  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory]
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.chatHistory = []
  }

  /**
   * Remove specific message from history
   */
  removeMessage(messageId: string): void {
    this.chatHistory = this.chatHistory.filter(msg => msg.id !== messageId)
  }

  /**
   * Get conversation summary for context
   */
  getConversationSummary(maxMessages: number = 6): string {
    const recentMessages = this.chatHistory.slice(-maxMessages)
    
    return recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')
  }

  /**
   * Export chat history
   */
  exportChatHistory(): {
    messages: ChatMessage[]
    exportedAt: Date
    messageCount: number
  } {
    return {
      messages: this.getChatHistory(),
      exportedAt: new Date(),
      messageCount: this.chatHistory.length
    }
  }

  /**
   * Import chat history
   */
  importChatHistory(messages: ChatMessage[]): void {
    this.chatHistory = messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp) // Ensure dates are properly parsed
    }))
  }

  /**
   * Get statistics about the current conversation
   */
  getConversationStats(): {
    messageCount: number
    userMessages: number
    assistantMessages: number
    sourcesReferenced: number
    averageResponseTime?: number
  } {
    const userMessages = this.chatHistory.filter(msg => msg.role === 'user')
    const assistantMessages = this.chatHistory.filter(msg => msg.role === 'assistant')
    
    const uniqueSources = new Set()
    assistantMessages.forEach(msg => {
      msg.sources?.forEach(source => uniqueSources.add(source.id))
    })

    return {
      messageCount: this.chatHistory.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      sourcesReferenced: uniqueSources.size
    }
  }

  /**
   * Build contextual question incorporating conversation history
   */
  private buildContextualQuestion(currentQuestion: string): string {
    if (this.chatHistory.length < 2) {
      return currentQuestion
    }

    // Get recent context (last 4 messages)
    const recentContext = this.chatHistory
      .slice(-4)
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ')

    // If the current question seems to reference previous context, combine them
    const contextualWords = ['this', 'that', 'these', 'those', 'it', 'they', 'also', 'additionally', 'furthermore']
    const hasContextualReference = contextualWords.some(word => 
      currentQuestion.toLowerCase().includes(word)
    )

    if (hasContextualReference && recentContext) {
      return `Previous context: ${recentContext}\n\nCurrent question: ${currentQuestion}`
    }

    return currentQuestion
  }

  /**
   * Build search filters for vector search
   */
  private buildSearchFilters(filters?: SearchFilters): Record<string, unknown> {
    if (!filters) return {}

    const searchFilters: Record<string, unknown> = {}

    if (filters.readingStatus?.length) {
      searchFilters.reading_status = filters.readingStatus
    }

    if (filters.publicationYear) {
      if (filters.publicationYear.min) {
        searchFilters.publication_year_min = filters.publicationYear.min
      }
      if (filters.publicationYear.max) {
        searchFilters.publication_year_max = filters.publicationYear.max
      }
    }

    if (filters.tags?.length) {
      searchFilters.tags = filters.tags
    }

    if (filters.rating) {
      if (filters.rating.min) {
        searchFilters.rating_min = filters.rating.min
      }
      if (filters.rating.max) {
        searchFilters.rating_max = filters.rating.max
      }
    }

    return searchFilters
  }

  /**
   * Query RAG API endpoint
   */
  private async queryRAGAPI(question: string, filters?: SearchFilters): Promise<RAGResponse> {
    const response = await fetch('/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        filters,
        openaiApiKey: this.config.openaiApiKey
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `API request failed: ${response.status}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}