import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RAGChat } from '../RAGChat'
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
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock DOM methods
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true
})

Object.defineProperty(HTMLElement.prototype, 'focus', {
  value: jest.fn(),
  writable: true
})

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onKeyPress, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyPress}
      {...props}
    />
  )
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>
}))

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick }: any) => (
    <span onClick={onClick}>{children}</span>
  )
}))

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>
}))

describe('RAGChat', () => {
  const mockOnSendMessage = jest.fn()

  const sampleMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'user',
      content: 'What papers discuss machine learning?',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I found several papers about machine learning in your collection.',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      sources: [
        {
          id: 'paper1',
          title: 'Deep Learning Fundamentals',
          authors: ['John Doe'],
          readingStatus: 'completed' as const,
          dateAdded: new Date(),
          lastModified: new Date()
        }
      ]
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders empty state when no messages', () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    expect(screen.getByText('Start a conversation')).toBeInTheDocument()
    expect(screen.getByText(/Ask questions about your research papers/)).toBeInTheDocument()
  })

  it('renders messages correctly', () => {
    render(
      <RAGChat
        messages={sampleMessages}
        onSendMessage={mockOnSendMessage}
      />
    )

    expect(screen.getByText('What papers discuss machine learning?')).toBeInTheDocument()
    expect(screen.getByText('I found several papers about machine learning in your collection.')).toBeInTheDocument()
  })

  it('displays sources for assistant messages', () => {
    render(
      <RAGChat
        messages={sampleMessages}
        onSendMessage={mockOnSendMessage}
      />
    )

    expect(screen.getByText('Sources:')).toBeInTheDocument()
    expect(screen.getByText('Deep Learning Fundamentals')).toBeInTheDocument()
  })

  it('sends message when send button is clicked', async () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...')
    const sendButton = screen.getByRole('button')

    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
    })
  })

  it('sends message when Enter key is pressed', async () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...')

    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
    })
  })

  it('does not send empty messages', async () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...')
    const sendButton = screen.getByRole('button')

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(sendButton)

    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })

  it('disables input and button when loading', () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={true}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...')
    const sendButton = screen.getByRole('button')

    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('displays loading indicator when loading', () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
        isLoading={true}
      />
    )

    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('displays error message when error occurs', () => {
    const errorMessage = 'Failed to process question'
    
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
        error={errorMessage}
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('clears input after sending message', async () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test message' } })
    expect(input.value).toBe('Test message')

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('handles Shift+Enter for new line', () => {
    render(
      <RAGChat
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    )

    const input = screen.getByPlaceholderText('Ask a question about your papers...')

    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true })

    // Should not send message with Shift+Enter
    expect(mockOnSendMessage).not.toHaveBeenCalled()
  })
})