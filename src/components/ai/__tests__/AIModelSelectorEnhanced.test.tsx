import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIModelSelectorEnhanced } from '../AIModelSelectorEnhanced'

// Mock the AI store
const mockUseAIStore = {
  apiKeys: { openai: 'test-key' },
  activeModels: new Set(['openai']),
  usage: {
    openai: {
      tokensUsed: 1000,
      requestCount: 5,
      estimatedCost: 0.02,
      lastUsed: new Date()
    }
  },
  isValidating: false,
  validationErrors: {},
  updateApiKey: jest.fn(),
  removeApiKey: jest.fn(),
  validateApiKey: jest.fn(),
  toggleModel: jest.fn(),
  hasValidKey: jest.fn(),
  isModelActive: jest.fn(),
  getActiveModelsWithKeys: jest.fn()
}

jest.mock('@/stores', () => ({
  useAIStore: () => mockUseAIStore
}))

describe('AIModelSelectorEnhanced', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock returns
    mockUseAIStore.hasValidKey.mockImplementation((model: string) => model === 'openai')
    mockUseAIStore.isModelActive.mockImplementation((model: string) => model === 'openai')
    mockUseAIStore.getActiveModelsWithKeys.mockReturnValue(['openai'])
    mockUseAIStore.validateApiKey.mockResolvedValue(true)
  })

  it('renders correctly with initial state', () => {
    render(<AIModelSelectorEnhanced />)
    
    expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
    expect(screen.getByText('Configure API keys and select which models to use for analysis')).toBeInTheDocument()
    expect(screen.getByText('1 active')).toBeInTheDocument()
  })

  it('displays all AI models with correct information', () => {
    render(<AIModelSelectorEnhanced />)
    
    expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument()
    expect(screen.getByText('Anthropic Claude')).toBeInTheDocument()
    expect(screen.getByText('xAI Grok')).toBeInTheDocument()
    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
    
    expect(screen.getByText('Advanced language model with strong reasoning capabilities')).toBeInTheDocument()
  })

  it('shows correct status indicators for models', () => {
    render(<AIModelSelectorEnhanced />)
    
    // OpenAI should show as valid (green check)
    const openaiCard = screen.getByText('OpenAI GPT-4').closest('.relative')
    expect(openaiCard?.querySelector('[data-testid="check-circle"]')).toBeInTheDocument()
    
    // Other models should not have check icons
    const anthropicCard = screen.getByText('Anthropic Claude').closest('.relative')
    expect(anthropicCard?.querySelector('[data-testid="check-circle"]')).not.toBeInTheDocument()
  })

  it('handles model toggle correctly', async () => {
    const user = userEvent.setup()
    render(<AIModelSelectorEnhanced />)
    
    // Find the switch for OpenAI (should be enabled)
    const switches = screen.getAllByRole('switch')
    const openaiSwitch = switches[0]
    
    await user.click(openaiSwitch)
    
    expect(mockUseAIStore.toggleModel).toHaveBeenCalledWith('openai')
  })

  it('shows API key input when eye button is clicked', async () => {
    const user = userEvent.setup()
    render(<AIModelSelectorEnhanced />)
    
    // Click eye button for OpenAI
    const eyeButtons = screen.getAllByRole('button')
    const openaiEyeButton = eyeButtons.find(btn => 
      btn.querySelector('svg') && btn.closest('.relative')?.textContent?.includes('OpenAI')
    )
    
    if (openaiEyeButton) {
      await user.click(openaiEyeButton)
      
      // Should show API key input
      await waitFor(() => {
        expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      })
    }
  })

  it('handles API key save correctly', async () => {
    const user = userEvent.setup()
    render(<AIModelSelectorEnhanced />)
    
    // Click eye button to show API key input
    const eyeButtons = screen.getAllByRole('button')
    const openaiEyeButton = eyeButtons.find(btn => 
      btn.querySelector('svg') && btn.closest('.relative')?.textContent?.includes('OpenAI')
    )
    
    if (openaiEyeButton) {
      await user.click(openaiEyeButton)
      
      await waitFor(async () => {
        const apiKeyInput = screen.getByLabelText('API Key')
        await user.clear(apiKeyInput)
        await user.type(apiKeyInput, 'new-test-key')
        
        // Click save button (key icon)
        const saveButton = screen.getByRole('button', { name: /key/i })
        await user.click(saveButton)
      })
      
      expect(mockUseAIStore.updateApiKey).toHaveBeenCalledWith('openai', 'new-test-key')
      expect(mockUseAIStore.validateApiKey).toHaveBeenCalledWith('openai', 'new-test-key')
    }
  })

  it('displays usage statistics correctly', () => {
    render(<AIModelSelectorEnhanced />)
    
    // OpenAI should show usage stats
    expect(screen.getByText('1,000')).toBeInTheDocument() // tokens used
    expect(screen.getByText('5')).toBeInTheDocument() // request count
    expect(screen.getByText('$0.0200')).toBeInTheDocument() // estimated cost
  })

  it('shows validation errors', () => {
    mockUseAIStore.validationErrors = { anthropic: 'Invalid API key format' }
    
    render(<AIModelSelectorEnhanced />)
    
    // Anthropic should show error icon
    const anthropicCard = screen.getByText('Anthropic Claude').closest('.relative')
    expect(anthropicCard?.querySelector('[data-testid="x-circle"]')).toBeInTheDocument()
  })

  it('displays loading state during validation', () => {
    mockUseAIStore.isValidating = true
    
    render(<AIModelSelectorEnhanced />)
    
    // Should show loading spinner somewhere in the component
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument()
  })

  it('shows warning when no models are active', () => {
    mockUseAIStore.getActiveModelsWithKeys.mockReturnValue([])
    
    render(<AIModelSelectorEnhanced />)
    
    expect(screen.getByText(/No active models configured/)).toBeInTheDocument()
  })

  it('handles API key removal', async () => {
    const user = userEvent.setup()
    render(<AIModelSelectorEnhanced />)
    
    // Show API key input for OpenAI
    const eyeButtons = screen.getAllByRole('button')
    const openaiEyeButton = eyeButtons.find(btn => 
      btn.querySelector('svg') && btn.closest('.relative')?.textContent?.includes('OpenAI')
    )
    
    if (openaiEyeButton) {
      await user.click(openaiEyeButton)
      
      await waitFor(async () => {
        const removeButton = screen.getByRole('button', { name: /remove/i })
        await user.click(removeButton)
      })
      
      expect(mockUseAIStore.removeApiKey).toHaveBeenCalledWith('openai')
    }
  })

  it('displays correct summary information', () => {
    render(<AIModelSelectorEnhanced />)
    
    expect(screen.getByText('1 of 4')).toBeInTheDocument() // active models
    expect(screen.getByText('$0.0200')).toBeInTheDocument() // total usage
  })

  it('shows correct status text for different model states', () => {
    render(<AIModelSelectorEnhanced />)
    
    // OpenAI should show as "Active"
    const openaiCard = screen.getByText('OpenAI GPT-4').closest('.relative')
    expect(openaiCard?.textContent).toContain('Active')
    
    // Other models should show as "Not configured"
    const anthropicCard = screen.getByText('Anthropic Claude').closest('.relative')
    expect(anthropicCard?.textContent).toContain('Not configured')
  })
})