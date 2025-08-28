import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SearchResult, RAGResponse, ChatMessage, SearchFilters } from '../types'

interface SearchStore {
  // State
  searchResults: SearchResult[]
  ragMessages: ChatMessage[]
  isSearching: boolean
  isRagLoading: boolean
  searchQuery: string
  searchFilters: SearchFilters
  error: string | null
  lastSearchTimestamp: Date | null

  // Search actions
  performSearch: (query: string, filters?: SearchFilters) => Promise<void>
  clearSearchResults: () => void
  setSearchFilters: (filters: SearchFilters) => void
  
  // RAG Chat actions
  askRAG: (question: string) => Promise<void>
  clearRagMessages: () => void
  addUserMessage: (content: string) => void
  addAssistantMessage: (content: string, sources?: any[]) => void
  
  // Utility actions
  clearError: () => void
  setSearching: (searching: boolean) => void
  setRagLoading: (loading: boolean) => void
  
  // Getters
  getMessageById: (id: string) => ChatMessage | undefined
  getRecentSearches: () => string[]
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set, get) => ({
      // Initial state
      searchResults: [],
      ragMessages: [],
      isSearching: false,
      isRagLoading: false,
      searchQuery: '',
      searchFilters: {},
      error: null,
      lastSearchTimestamp: null,

      // Search actions
      performSearch: async (query: string, filters: SearchFilters = {}) => {
        set({ 
          isSearching: true, 
          error: null, 
          searchQuery: query,
          searchFilters: filters 
        })
        
        try {
          const response = await fetch('/api/rag/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query, 
              filters,
              type: 'search' // Distinguish from RAG queries
            })
          })
          
          if (!response.ok) {
            throw new Error('Search failed')
          }
          
          const results: SearchResult[] = await response.json()
          
          set({ 
            searchResults: results,
            isSearching: false,
            lastSearchTimestamp: new Date()
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Search failed',
            isSearching: false,
            searchResults: []
          })
        }
      },

      clearSearchResults: () => {
        set({ 
          searchResults: [],
          searchQuery: '',
          searchFilters: {},
          lastSearchTimestamp: null
        })
      },

      setSearchFilters: (filters: SearchFilters) => {
        set({ searchFilters: filters })
      },

      // RAG Chat actions
      askRAG: async (question: string) => {
        // Add user message immediately
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: question,
          timestamp: new Date()
        }
        
        const { ragMessages } = get()
        set({ 
          ragMessages: [...ragMessages, userMessage],
          isRagLoading: true,
          error: null
        })
        
        try {
          const response = await fetch('/api/rag/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: question,
              type: 'rag' // RAG query type
            })
          })
          
          if (!response.ok) {
            throw new Error('RAG query failed')
          }
          
          const ragResponse: RAGResponse = await response.json()
          
          // Add assistant message
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: ragResponse.answer,
            timestamp: new Date(),
            sources: ragResponse.sources
          }
          
          const currentMessages = get().ragMessages
          set({ 
            ragMessages: [...currentMessages, assistantMessage],
            isRagLoading: false
          })
        } catch (error) {
          // Add error message as assistant response
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error while processing your question. Please try again.',
            timestamp: new Date()
          }
          
          const currentMessages = get().ragMessages
          set({ 
            ragMessages: [...currentMessages, errorMessage],
            error: error instanceof Error ? error.message : 'RAG query failed',
            isRagLoading: false
          })
        }
      },

      clearRagMessages: () => {
        set({ ragMessages: [] })
      },

      addUserMessage: (content: string) => {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date()
        }
        
        const { ragMessages } = get()
        set({ ragMessages: [...ragMessages, userMessage] })
      },

      addAssistantMessage: (content: string, sources?: any[]) => {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date(),
          sources
        }
        
        const { ragMessages } = get()
        set({ ragMessages: [...ragMessages, assistantMessage] })
      },

      // Utility actions
      clearError: () => {
        set({ error: null })
      },

      setSearching: (searching: boolean) => {
        set({ isSearching: searching })
      },

      setRagLoading: (loading: boolean) => {
        set({ isRagLoading: loading })
      },

      // Getters
      getMessageById: (id: string) => {
        return get().ragMessages.find(message => message.id === id)
      },

      getRecentSearches: () => {
        // This could be enhanced to track search history
        // For now, return empty array
        return []
      }
    }),
    {
      name: 'search-storage',
      partialize: (state) => ({
        ragMessages: state.ragMessages,
        searchFilters: state.searchFilters,
        lastSearchTimestamp: state.lastSearchTimestamp
      })
    }
  )
)