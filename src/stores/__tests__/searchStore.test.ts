import { renderHook, act } from '@testing-library/react'
import { useSearchStore } from '../searchStore'
import { SearchResult, RAGResponse, ChatMessage, SearchFilters } from '@/types'

// Mock fetch
global.fetch = jest.fn()

const mockSearchResult: SearchResult = {
  id: '1',
  paper: {
    id: '1',
    title: 'Test Paper',
    authors: ['Author 1'],
    readingStatus: 'unread',
    dateAdded: new Date('2023-01-01'),
    lastModified: new Date('2023-01-01')
  },
  similarity: 0.85,
  relevantExcerpts: ['This is a relevant excerpt']
}

const mockRAGResponse: RAGResponse = {
  answer: 'This is the AI generated answer',
  sources: [mockSearchResult.paper],
  confidence: 0.9
}

describe('searchStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    useSearchStore.setState({
      searchResults: [],
      ragMessages: [],
      isSearching: false,
      isRagLoading: false,
      searchQuery: '',
      searchFilters: {},
      error: null,
      lastSearchTimestamp: null
    })
  })

  describe('performSearch', () => {
    it('should perform search successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSearchResult]
      } as Response)

      const { result } = renderHook(() => useSearchStore())

      await act(async () => {
        await result.current.performSearch('test query')
      })

      expect(result.current.searchResults).toEqual([mockSearchResult])
      expect(result.current.searchQuery).toBe('test query')
      expect(result.current.isSearching).toBe(false)
      expect(result.current.lastSearchTimestamp).toBeDefined()
    })

    it('should handle search error', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response)

      const { result } = renderHook(() => useSearchStore())

      await act(async () => {
        await result.current.performSearch('test query')
      })

      expect(result.current.searchResults).toEqual([])
      expect(result.current.isSearching).toBe(false)
      expect(result.current.error).toBe('Search failed')
    })

    it('should perform search with filters', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSearchResult]
      } as Response)

      const { result } = renderHook(() => useSearchStore())
      const filters: SearchFilters = {
        readingStatus: ['unread'],
        publicationYear: { min: 2020, max: 2023 }
      }

      await act(async () => {
        await result.current.performSearch('test query', filters)
      })

      expect(result.current.searchFilters).toEqual(filters)
      expect(mockFetch).toHaveBeenCalledWith('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
          filters,
          type: 'search'
        })
      })
    })
  })

  describe('clearSearchResults', () => {
    it('should clear search results', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set initial state
      act(() => {
        useSearchStore.setState({
          searchResults: [mockSearchResult],
          searchQuery: 'test',
          searchFilters: { readingStatus: ['unread'] },
          lastSearchTimestamp: new Date()
        })
      })

      act(() => {
        result.current.clearSearchResults()
      })

      expect(result.current.searchResults).toEqual([])
      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchFilters).toEqual({})
      expect(result.current.lastSearchTimestamp).toBe(null)
    })
  })

  describe('setSearchFilters', () => {
    it('should set search filters', () => {
      const { result } = renderHook(() => useSearchStore())
      const filters: SearchFilters = {
        readingStatus: ['reading'],
        tags: ['important']
      }

      act(() => {
        result.current.setSearchFilters(filters)
      })

      expect(result.current.searchFilters).toEqual(filters)
    })
  })

  describe('askRAG', () => {
    it('should ask RAG question successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRAGResponse
      } as Response)

      const { result } = renderHook(() => useSearchStore())

      await act(async () => {
        await result.current.askRAG('What is this paper about?')
      })

      expect(result.current.ragMessages).toHaveLength(2) // User + Assistant
      expect(result.current.ragMessages[0].role).toBe('user')
      expect(result.current.ragMessages[0].content).toBe('What is this paper about?')
      expect(result.current.ragMessages[1].role).toBe('assistant')
      expect(result.current.ragMessages[1].content).toBe(mockRAGResponse.answer)
      expect(result.current.ragMessages[1].sources).toEqual(mockRAGResponse.sources)
      expect(result.current.isRagLoading).toBe(false)
    })

    it('should handle RAG error', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response)

      const { result } = renderHook(() => useSearchStore())

      await act(async () => {
        await result.current.askRAG('What is this paper about?')
      })

      expect(result.current.ragMessages).toHaveLength(2) // User + Error message
      expect(result.current.ragMessages[1].content).toContain('error')
      expect(result.current.isRagLoading).toBe(false)
      expect(result.current.error).toBe('RAG query failed')
    })
  })

  describe('clearRagMessages', () => {
    it('should clear RAG messages', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set initial messages
      act(() => {
        useSearchStore.setState({
          ragMessages: [
            {
              id: '1',
              role: 'user',
              content: 'Test message',
              timestamp: new Date()
            }
          ]
        })
      })

      act(() => {
        result.current.clearRagMessages()
      })

      expect(result.current.ragMessages).toEqual([])
    })
  })

  describe('addUserMessage', () => {
    it('should add user message', () => {
      const { result } = renderHook(() => useSearchStore())

      act(() => {
        result.current.addUserMessage('Hello')
      })

      expect(result.current.ragMessages).toHaveLength(1)
      expect(result.current.ragMessages[0].role).toBe('user')
      expect(result.current.ragMessages[0].content).toBe('Hello')
    })
  })

  describe('addAssistantMessage', () => {
    it('should add assistant message', () => {
      const { result } = renderHook(() => useSearchStore())

      act(() => {
        result.current.addAssistantMessage('Hi there', [mockSearchResult.paper])
      })

      expect(result.current.ragMessages).toHaveLength(1)
      expect(result.current.ragMessages[0].role).toBe('assistant')
      expect(result.current.ragMessages[0].content).toBe('Hi there')
      expect(result.current.ragMessages[0].sources).toEqual([mockSearchResult.paper])
    })
  })

  describe('utility actions', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useSearchStore())
      
      act(() => {
        useSearchStore.setState({ error: 'Test error' })
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })

    it('should set searching state', () => {
      const { result } = renderHook(() => useSearchStore())

      act(() => {
        result.current.setSearching(true)
      })

      expect(result.current.isSearching).toBe(true)
    })

    it('should set RAG loading state', () => {
      const { result } = renderHook(() => useSearchStore())

      act(() => {
        result.current.setRagLoading(true)
      })

      expect(result.current.isRagLoading).toBe(true)
    })
  })

  describe('getMessageById', () => {
    it('should get message by ID', () => {
      const { result } = renderHook(() => useSearchStore())
      
      const testMessage: ChatMessage = {
        id: 'test-id',
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      }

      act(() => {
        useSearchStore.setState({ ragMessages: [testMessage] })
      })

      const message = result.current.getMessageById('test-id')
      expect(message).toEqual(testMessage)
    })

    it('should return undefined for non-existent ID', () => {
      const { result } = renderHook(() => useSearchStore())

      const message = result.current.getMessageById('non-existent')
      expect(message).toBeUndefined()
    })
  })

  describe('getRecentSearches', () => {
    it('should return empty array for now', () => {
      const { result } = renderHook(() => useSearchStore())

      const recentSearches = result.current.getRecentSearches()
      expect(recentSearches).toEqual([])
    })
  })
})