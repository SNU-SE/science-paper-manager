import { RAGService } from '../RAGService'
import type { ChatMessage, SearchFilters } from '@/types'

// Mock the fetch function
global.fetch = jest.fn()

// Mock SupabaseVectorService
jest.mock('@/services/vector/SupabaseVectorService', () => ({
  SupabaseVectorService: jest.fn().mockImplementation(() => ({
    ragQuery: jest.fn()
  }))
}))

describe('RAGService', () => {
  let ragService: RAGService
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    ragService = new RAGService({ openaiApiKey: mockApiKey })
    jest.clearAllMocks()
  })

  describe('askQuestion', () => {
    it('processes a simple question successfully', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      const result = await ragService.askQuestion('What is machine learning?')

      expect(result.role).toBe('assistant')
      expect(result.content).toBe('Test answer')
      expect(result.sources).toEqual([])
    })

    it('adds user message to history', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Test question')
      const history = ragService.getChatHistory()

      expect(history).toHaveLength(2) // user + assistant
      expect(history[0].role).toBe('user')
      expect(history[0].content).toBe('Test question')
    })

    it('handles API errors gracefully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      const result = await ragService.askQuestion('Test question')

      expect(result.role).toBe('assistant')
      expect(result.content).toContain('encountered an error')
    })

    it('handles network errors gracefully', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await ragService.askQuestion('Test question')

      expect(result.role).toBe('assistant')
      expect(result.content).toContain('encountered an error')
    })

    it('includes sources in assistant message', async () => {
      const mockSources = [
        {
          id: 'paper1',
          title: 'Test Paper',
          authors: ['Author 1'],
          readingStatus: 'completed' as const,
          dateAdded: new Date(),
          lastModified: new Date()
        }
      ]

      const mockResponse = {
        answer: 'Test answer with sources',
        sources: mockSources,
        confidence: 0.9
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      const result = await ragService.askQuestion('Test question')

      expect(result.sources).toEqual(mockSources)
    })
  })

  describe('chat history management', () => {
    it('maintains chat history correctly', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Question 1')
      await ragService.askQuestion('Question 2')

      const history = ragService.getChatHistory()
      expect(history).toHaveLength(4) // 2 user + 2 assistant messages
    })

    it('clears history correctly', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Test question')
      expect(ragService.getChatHistory()).toHaveLength(2)

      ragService.clearHistory()
      expect(ragService.getChatHistory()).toHaveLength(0)
    })

    it('removes specific messages correctly', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Test question')
      const history = ragService.getChatHistory()
      const messageToRemove = history[0]

      ragService.removeMessage(messageToRemove.id)
      const updatedHistory = ragService.getChatHistory()

      expect(updatedHistory).toHaveLength(1)
      expect(updatedHistory.find(msg => msg.id === messageToRemove.id)).toBeUndefined()
    })
  })

  describe('conversation context', () => {
    it('builds contextual questions from history', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      // First question
      await ragService.askQuestion('What is machine learning?')
      
      // Second question with contextual reference
      await ragService.askQuestion('How does it work?')

      expect(fetch).toHaveBeenCalledTimes(2)
      
      // Check that the second call includes contextual information
      const secondCall = (fetch as jest.Mock).mock.calls[1][1]
      const secondCallBody = JSON.parse(secondCall.body)
      
      expect(secondCallBody.question).toContain('Previous context')
    })

    it('does not add context for standalone questions', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('What is deep learning?')

      const firstCall = (fetch as jest.Mock).mock.calls[0][1]
      const firstCallBody = JSON.parse(firstCall.body)
      
      expect(firstCallBody.question).toBe('What is deep learning?')
      expect(firstCallBody.question).not.toContain('Previous context')
    })
  })

  describe('statistics and export', () => {
    it('provides accurate conversation statistics', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [
          {
            id: 'paper1',
            title: 'Test Paper',
            authors: ['Author 1'],
            readingStatus: 'completed' as const,
            dateAdded: new Date(),
            lastModified: new Date()
          }
        ],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Question 1')
      await ragService.askQuestion('Question 2')

      const stats = ragService.getConversationStats()

      expect(stats.messageCount).toBe(4)
      expect(stats.userMessages).toBe(2)
      expect(stats.assistantMessages).toBe(2)
      expect(stats.sourcesReferenced).toBe(1) // Unique sources
    })

    it('exports chat history correctly', async () => {
      const mockResponse = {
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      await ragService.askQuestion('Test question')

      const exportData = ragService.exportChatHistory()

      expect(exportData.messages).toHaveLength(2)
      expect(exportData.messageCount).toBe(2)
      expect(exportData.exportedAt).toBeInstanceOf(Date)
    })

    it('imports chat history correctly', () => {
      const mockMessages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Imported question',
          timestamp: new Date()
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Imported answer',
          timestamp: new Date()
        }
      ]

      ragService.importChatHistory(mockMessages)
      const history = ragService.getChatHistory()

      expect(history).toHaveLength(2)
      expect(history[0].content).toBe('Imported question')
      expect(history[1].content).toBe('Imported answer')
    })
  })

  describe('search filters', () => {
    it('passes search filters to API correctly', async () => {
      const mockResponse = {
        answer: 'Filtered answer',
        sources: [],
        confidence: 0.8
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockResponse })
      })

      const filters: SearchFilters = {
        readingStatus: ['completed'],
        publicationYear: { min: 2020, max: 2024 },
        rating: { min: 4 }
      }

      await ragService.askQuestion('Test question', filters)

      const call = (fetch as jest.Mock).mock.calls[0][1]
      const callBody = JSON.parse(call.body)

      expect(callBody.filters).toEqual(filters)
    })
  })
})