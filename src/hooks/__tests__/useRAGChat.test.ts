import { renderHook, act } from '@testing-library/react'
import { useRAGChat } from '../useRAGChat'
import type { ChatMessage } from '@/types'

// Setup test environment
import '@testing-library/jest-dom'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock DOM methods
Object.defineProperty(window, 'HTMLElement', {
  value: class MockHTMLElement {
    scrollIntoView = jest.fn()
    focus = jest.fn()
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock RAGService
const mockRAGService = {
  askQuestion: jest.fn(),
  getChatHistory: jest.fn(),
  clearHistory: jest.fn(),
  removeMessage: jest.fn(),
  exportChatHistory: jest.fn(),
  importChatHistory: jest.fn(),
  getConversationStats: jest.fn()
}

jest.mock('@/services/rag/RAGService', () => ({
  RAGService: jest.fn().mockImplementation(() => mockRAGService)
}))

describe('useRAGChat', () => {
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    mockRAGService.getChatHistory.mockReturnValue([])
    mockRAGService.getConversationStats.mockReturnValue({
      messageCount: 0,
      userMessages: 0,
      assistantMessages: 0,
      sourcesReferenced: 0
    })
  })

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('loads saved history on initialization', () => {
    const savedMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Saved question',
        timestamp: new Date().toISOString()
      }
    ]

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedMessages))

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('Saved question')
  })

  it('sends message successfully', async () => {
    const mockAssistantMessage: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Test response',
      timestamp: new Date()
    }

    const mockHistory = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Test question',
        timestamp: new Date()
      },
      mockAssistantMessage
    ]

    mockRAGService.askQuestion.mockResolvedValue(mockAssistantMessage)
    mockRAGService.getChatHistory.mockReturnValue(mockHistory)

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    await act(async () => {
      await result.current.sendMessage('Test question')
    })

    expect(mockRAGService.askQuestion).toHaveBeenCalledWith('Test question', undefined)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.isLoading).toBe(false)
  })

  it('handles send message errors', async () => {
    const error = new Error('API Error')
    mockRAGService.askQuestion.mockRejectedValue(error)

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    await act(async () => {
      await result.current.sendMessage('Test question')
    })

    expect(result.current.error).toBe('API Error')
    expect(result.current.isLoading).toBe(false)
  })

  it('shows loading state during message sending', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise(resolve => {
      resolvePromise = resolve
    })

    mockRAGService.askQuestion.mockReturnValue(promise)

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    act(() => {
      result.current.sendMessage('Test question')
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolvePromise({
        id: '2',
        role: 'assistant',
        content: 'Response',
        timestamp: new Date()
      })
      await promise
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('does not send empty messages', async () => {
    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    await act(async () => {
      await result.current.sendMessage('   ')
    })

    expect(mockRAGService.askQuestion).not.toHaveBeenCalled()
  })

  it('clears history correctly', () => {
    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    act(() => {
      result.current.clearHistory()
    })

    expect(mockRAGService.clearHistory).toHaveBeenCalled()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('rag-chat-history')
  })

  it('removes specific messages', () => {
    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    act(() => {
      result.current.removeMessage('message-id')
    })

    expect(mockRAGService.removeMessage).toHaveBeenCalledWith('message-id')
  })

  it('exports history correctly', () => {
    const mockExportData = {
      messages: [],
      exportedAt: new Date(),
      messageCount: 0
    }

    mockRAGService.exportChatHistory.mockReturnValue(mockExportData)

    // Mock URL.createObjectURL and related DOM methods
    const mockCreateObjectURL = jest.fn(() => 'mock-url')
    const mockRevokeObjectURL = jest.fn()
    const mockClick = jest.fn()
    const mockAppendChild = jest.fn()
    const mockRemoveChild = jest.fn()

    Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL })
    
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick
    }
    
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    act(() => {
      result.current.exportHistory()
    })

    expect(mockRAGService.exportChatHistory).toHaveBeenCalled()
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('imports history correctly', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Imported message',
        timestamp: new Date()
      }
    ]

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    act(() => {
      result.current.importHistory(mockMessages)
    })

    expect(mockRAGService.importChatHistory).toHaveBeenCalledWith(mockMessages)
  })

  it('saves history automatically when autoSave is enabled', async () => {
    const mockAssistantMessage: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Test response',
      timestamp: new Date()
    }

    const mockHistory = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Test question',
        timestamp: new Date()
      },
      mockAssistantMessage
    ]

    mockRAGService.askQuestion.mockResolvedValue(mockAssistantMessage)
    mockRAGService.getChatHistory.mockReturnValue(mockHistory)

    const { result } = renderHook(() => 
      useRAGChat({ 
        openaiApiKey: mockApiKey, 
        autoSave: true 
      })
    )

    await act(async () => {
      await result.current.sendMessage('Test question')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'rag-chat-history',
      JSON.stringify(mockHistory)
    )
  })

  it('does not save history when autoSave is disabled', async () => {
    const mockAssistantMessage: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Test response',
      timestamp: new Date()
    }

    mockRAGService.askQuestion.mockResolvedValue(mockAssistantMessage)
    mockRAGService.getChatHistory.mockReturnValue([mockAssistantMessage])

    const { result } = renderHook(() => 
      useRAGChat({ 
        openaiApiKey: mockApiKey, 
        autoSave: false 
      })
    )

    await act(async () => {
      await result.current.sendMessage('Test question')
    })

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
  })

  it('provides conversation statistics', () => {
    const mockStats = {
      messageCount: 4,
      userMessages: 2,
      assistantMessages: 2,
      sourcesReferenced: 3
    }

    mockRAGService.getConversationStats.mockReturnValue(mockStats)

    const { result } = renderHook(() => useRAGChat({ openaiApiKey: mockApiKey }))

    expect(result.current.conversationStats).toEqual(mockStats)
  })

  it('handles missing API key gracefully', () => {
    const { result } = renderHook(() => useRAGChat({ openaiApiKey: '' }))

    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBe(null)
  })
})