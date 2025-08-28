import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIModelSelector } from '../AIModelSelector'
import { AIProvider } from '@/services/ai/AIServiceFactory'

// Mock the AIServiceFactory
jest.mock('@/services/ai/AIServiceFactory', () => ({
  AIServiceFactory: {
    getAvailableProviders: jest.fn(() => ['openai', 'anthropic', 'xai', 'gemini']),
    getDefaultModels: jest.fn(() => ({
      openai: 'gpt-4',
      anthropic: 'claude-3-sonnet-20240229',
      xai: 'grok-beta',
      gemini: 'gemini-1.5-pro'
    })),
    validateApiKey: jest.fn()
  }
}))

const mockProps = {
  selectedModels: ['openai'] as AIProvider[],
  onSelectionChange: jest.fn(),
  apiKeys: { openai: 'test-key' },
  onApiKeyUpdate: jest.fn(),
  onApiKeyValidate: jest.fn()
}

describe('AIModelSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with initial props', () => {
    render(<AIModelSelector {...mockProps} />)
    
    expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
    expect(screen.getByText('Model Selection')).toBeInTheDocument()
    expect(screen.getByText('API Configuration')).toBeInTheDocument()
  })

  it('displays all available AI models', () => {
    render(<AIModelSelector {...mockProps} />)
    
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('xAI')).toBeInTheDocument()
    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
  })

  it('shows correct model status indicators', () => {
    render(<AIModelSelector {...mockProps} />)
    
    // OpenAI should show as having valid key (green check)
    const openaiSection = screen.getByText('OpenAI').closest('.relative')
    expect(openaiSection).toBeInTheDocument()
    
    // Other models should show as missing API keys
    expect(screen.getAllByText('No API Key')).toHaveLength(3)
  })

  it('handles model selection toggle', async () => {
    const user = userEvent.setup()
    render(<AIModelSelector {...mockProps} />)
    
    // Find and click a model toggle switch
    const switches = screen.getAllByRole('switch')
    await user.click(switches[1]) // Click second switch (should be disabled due to no API key)
    
    // Should not call onSelectionChange since no API key
    expect(mockProps.onSelectionChange).not.toHaveBeenCalled()
  })

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup()
    render(<AIModelSelector {...mockProps} />)
    
    // Click API Configuration tab
    await user.click(screen.getByText('API Configuration'))
    
    // Should show API key input fields
    expect(screen.getByLabelText(/OpenAI.*API Key/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Anthropic.*API Key/)).toBeInTheDocument()
  })

  it('handles API key input and validation', async () => {
    const user = userEvent.setup()
    mockProps.onApiKeyValidate.mockResolvedValue(true)
    
    render(<AIModelSelector {...mockProps} />)
    
    // Switch to API Configuration tab
    await user.click(screen.getByText('API Configuration'))
    
    // Find API key input for Anthropic
    const anthropicInput = screen.getByLabelText(/Anthropic.*API Key/)
    const saveButton = anthropicInput.parentElement?.querySelector('button')
    
    // Enter API key
    await user.type(anthropicInput, 'test-anthropic-key')
    
    // Click save button
    if (saveButton) {
      await user.click(saveButton)
    }
    
    await waitFor(() => {
      expect(mockProps.onApiKeyValidate).toHaveBeenCalledWith('anthropic', 'test-anthropic-key')
    })
  })

  it('displays validation errors correctly', async () => {
    const user = userEvent.setup()
    mockProps.onApiKeyValidate.mockRejectedValue(new Error('Invalid API key'))
    
    render(<AIModelSelector {...mockProps} />)
    
    // Switch to API Configuration tab
    await user.click(screen.getByText('API Configuration'))
    
    // Find API key input for Anthropic
    const anthropicInput = screen.getByLabelText(/Anthropic.*API Key/)
    const saveButton = anthropicInput.parentElement?.querySelector('button')
    
    // Enter invalid API key
    await user.type(anthropicInput, 'invalid-key')
    
    // Click save button
    if (saveButton) {
      await user.click(saveButton)
    }
    
    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument()
    })
  })

  it('shows loading state during validation', async () => {
    const user = userEvent.setup()
    let resolveValidation: (value: boolean) => void
    mockProps.onApiKeyValidate.mockImplementation(() => 
      new Promise(resolve => { resolveValidation = resolve })
    )
    
    render(<AIModelSelector {...mockProps} />)
    
    // Switch to API Configuration tab
    await user.click(screen.getByText('API Configuration'))
    
    // Find API key input for Anthropic
    const anthropicInput = screen.getByLabelText(/Anthropic.*API Key/)
    const saveButton = anthropicInput.parentElement?.querySelector('button')
    
    // Enter API key
    await user.type(anthropicInput, 'test-key')
    
    // Click save button
    if (saveButton) {
      await user.click(saveButton)
    }
    
    // Should show loading spinner
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument()
    })
    
    // Resolve validation
    resolveValidation!(true)
    
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /loading/i })).not.toBeInTheDocument()
    })
  })

  it('displays active models count correctly', () => {
    const propsWithMultipleModels = {
      ...mockProps,
      selectedModels: ['openai', 'anthropic'] as AIProvider[],
      apiKeys: { openai: 'key1', anthropic: 'key2' }
    }
    
    render(<AIModelSelector {...propsWithMultipleModels} />)
    
    expect(screen.getByText('2/4 models active')).toBeInTheDocument()
  })

  it('shows warning when no models are active', () => {
    const propsWithNoModels = {
      ...mockProps,
      selectedModels: [] as AIProvider[],
      apiKeys: {}
    }
    
    render(<AIModelSelector {...propsWithNoModels} />)
    
    expect(screen.getByText(/No models are currently active/)).toBeInTheDocument()
  })

  it('displays model descriptions and names correctly', () => {
    render(<AIModelSelector {...mockProps} />)
    
    expect(screen.getByText('GPT models for comprehensive analysis')).toBeInTheDocument()
    expect(screen.getByText('Claude models for detailed reasoning')).toBeInTheDocument()
    expect(screen.getByText('Grok models for innovative insights')).toBeInTheDocument()
    expect(screen.getByText('Gemini models for multimodal analysis')).toBeInTheDocument()
    
    expect(screen.getByText('Model: gpt-4')).toBeInTheDocument()
    expect(screen.getByText('Model: claude-3-sonnet-20240229')).toBeInTheDocument()
  })

  it('handles API key update correctly', async () => {
    const user = userEvent.setup()
    mockProps.onApiKeyValidate.mockResolvedValue(true)
    
    render(<AIModelSelector {...mockProps} />)
    
    // Switch to API Configuration tab
    await user.click(screen.getByText('API Configuration'))
    
    // Find API key input for xAI
    const xaiInput = screen.getByLabelText(/xAI.*API Key/)
    const saveButton = xaiInput.parentElement?.querySelector('button')
    
    // Enter API key
    await user.type(xaiInput, 'new-xai-key')
    
    // Click save button
    if (saveButton) {
      await user.click(saveButton)
    }
    
    await waitFor(() => {
      expect(mockProps.onApiKeyUpdate).toHaveBeenCalledWith('xai', 'new-xai-key')
    })
  })
})