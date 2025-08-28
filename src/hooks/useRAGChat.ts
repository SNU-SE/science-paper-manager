'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { RAGService } from '@/services/rag/RAGService'
import type { ChatMessage, SearchFilters } from '@/types'

interface UseRAGChatConfig {
  openaiApiKey: string
  autoSave?: boolean
  storageKey?: string
}

interface UseRAGChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (message: string, filters?: SearchFilters) => Promise<void>
  clearHistory: () => void
  removeMessage: (messageId: string) => void
  exportHistory: () => void
  importHistory: (messages: ChatMessage[]) => void
  conversationStats: {
    messageCount: number
    userMessages: number
    assistantMessages: number
    sourcesReferenced: number
  }
}

/**
 * Hook for managing RAG chat interactions
 */
export function useRAGChat(config: UseRAGChatConfig): UseRAGChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const ragServiceRef = useRef<RAGService | null>(null)
  const { openaiApiKey, autoSave = true, storageKey = 'rag-chat-history' } = config

  // Initialize RAG service
  useEffect(() => {
    if (openaiApiKey) {
      ragServiceRef.current = new RAGService({ openaiApiKey })
      
      // Load saved history if auto-save is enabled
      if (autoSave) {
        loadSavedHistory()
      }
    }
  }, [openaiApiKey, autoSave, storageKey])

  // Save history when messages change (if auto-save is enabled)
  useEffect(() => {
    if (autoSave && messages.length > 0) {
      saveHistory()
    }
  }, [messages, autoSave])

  const loadSavedHistory = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsedHistory = JSON.parse(saved)
        if (Array.isArray(parsedHistory)) {
          const validMessages = parsedHistory.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(validMessages)
          ragServiceRef.current?.importChatHistory(validMessages)
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }, [storageKey])

  const saveHistory = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }, [messages, storageKey])

  const sendMessage = useCallback(async (
    message: string, 
    filters?: SearchFilters
  ) => {
    if (!ragServiceRef.current) {
      setError('RAG service not initialized. Please check your OpenAI API key.')
      return
    }

    if (!message.trim()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Add user message immediately for better UX
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: message.trim(),
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage])

      // Get AI response
      await ragServiceRef.current.askQuestion(
        message.trim(),
        filters
      )

      // Update messages with the complete history from RAG service
      const updatedHistory = ragServiceRef.current.getChatHistory()
      setMessages(updatedHistory)

    } catch (error) {
      console.error('Failed to send message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
      
      // Remove the user message that was added optimistically
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    ragServiceRef.current?.clearHistory()
    
    if (autoSave) {
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.error('Failed to clear saved history:', error)
      }
    }
  }, [autoSave, storageKey])

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId))
    ragServiceRef.current?.removeMessage(messageId)
  }, [])

  const exportHistory = useCallback(() => {
    if (!ragServiceRef.current) return

    const exportData = ragServiceRef.current.exportChatHistory()
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rag-chat-history-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const importHistory = useCallback((importedMessages: ChatMessage[]) => {
    const validMessages = importedMessages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
    
    setMessages(validMessages)
    ragServiceRef.current?.importChatHistory(validMessages)
  }, [])

  const conversationStats = ragServiceRef.current?.getConversationStats() || {
    messageCount: 0,
    userMessages: 0,
    assistantMessages: 0,
    sourcesReferenced: 0
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    removeMessage,
    exportHistory,
    importHistory,
    conversationStats
  }
}