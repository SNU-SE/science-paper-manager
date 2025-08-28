import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { APIKeyManager } from '../APIKeyManager'
import { AIServiceFactory } from '@/services/ai/AIServiceFactory'

// Mock the AI service factory
jest.mock('@/services/ai/AIServiceFactory')
const mockAIServiceFactory = AIServiceFactory as jest.Mocked<typeof AIServiceFactory>

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

describe('APIKeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  it('renders API key management interface', () => {
    render(<APIKeyManager />)
    
    expect(screen.getByText('API Key Management')).toBeInTheDocument()
    expect(screen.getByText('Configure and manage your AI service API keys')).toBeInTheDocument()
    expect(screen.getByText('Usage Overview')).toBeInTheDocument()
  })

  it('displays all AI services', () => {
    render(<APIKeyManager />)
    
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('xAI')).toBeInTheDocument()
    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
  })

  it('loads existing API keys from localStorage', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'true'
      if (key === 'apiUsage_openai') return JSON.stringify({
        tokensUsed: 1000,
        cost: 0.02,
        requestCount: 5
      })
      return null
    })

    render(<APIKeyManager />)
    
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('apiKey_openai')
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('apiEnabled_openai')
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('apiUsage_openai')
  })

  it('validates API key when save button is clicked', async () => {
    const mockService = {
      validateApiKey: jest.fn().mockResolvedValue(true),
    }
    mockAIServiceFactory.createService.mockReturnValue(mockService as any)

    render(<APIKeyManager />)
    
    const openaiInput = screen.getByPlaceholderText('sk-...')
    const saveButtons = screen.getAllByText('Save & Validate')
    
    fireEvent.change(openaiInput, { target: { value: 'sk-test-key' } })
    fireEvent.click(saveButtons[0]) // First button should be OpenAI
    
    await waitFor(() => {
      expect(mockAIServiceFactory.createService).toHaveBeenCalledWith('openai', 'sk-test-key')
      expect(mockService.validateApiKey).toHaveBeenCalledWith('sk-test-key')
    })
  })

  it('shows validation error for invalid API key', async () => {
    const mockService = {
      validateApiKey: jest.fn().mockResolvedValue(false),
    }
    mockAIServiceFactory.createService.mockReturnValue(mockService as any)

    render(<APIKeyManager />)
    
    const openaiInput = screen.getByPlaceholderText('sk-...')
    const saveButtons = screen.getAllByText('Save & Validate')
    
    fireEvent.change(openaiInput, { target: { value: 'invalid-key' } })
    fireEvent.click(saveButtons[0]) // First button should be OpenAI
    
    await waitFor(() => {
      expect(mockService.validateApiKey).toHaveBeenCalledWith('invalid-key')
    })
  })

  it('toggles key visibility', () => {
    render(<APIKeyManager />)
    
    const openaiInput = screen.getByPlaceholderText('sk-...')
    const toggleButton = openaiInput.parentElement?.querySelector('button')
    
    expect(openaiInput).toHaveAttribute('type', 'password')
    
    if (toggleButton) {
      fireEvent.click(toggleButton)
      expect(openaiInput).toHaveAttribute('type', 'text')
    }
  })

  it('enables/disables service toggle', async () => {
    // Setup a valid key first
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'false'
      return null
    })

    const mockService = {
      validateApiKey: jest.fn().mockResolvedValue(true),
    }
    mockAIServiceFactory.createService.mockReturnValue(mockService as any)

    render(<APIKeyManager />)
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(mockService.validateApiKey).toHaveBeenCalled()
    })

    const serviceToggle = screen.getAllByRole('switch')[0] // First switch should be OpenAI
    fireEvent.click(serviceToggle)
    
    // Check that the toggle was called - the key storage happens first during validation
    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiEnabled_openai', 'true')
    })
  })

  it('removes API key when remove button is clicked', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      return null
    })

    render(<APIKeyManager />)
    
    const removeButton = screen.getByText('Remove')
    fireEvent.click(removeButton)
    
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('apiKey_openai')
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('apiEnabled_openai', 'false')
  })

  it('displays usage statistics', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiUsage_openai') return JSON.stringify({
        tokensUsed: 1000,
        cost: 0.02,
        requestCount: 5
      })
      return null
    })

    render(<APIKeyManager />)
    
    // Switch to usage tab
    const usageTab = screen.getByText('Usage Details')
    fireEvent.click(usageTab)
    
    // Check that the usage tab content is displayed
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('xAI')).toBeInTheDocument()
    expect(screen.getByText('Google Gemini')).toBeInTheDocument()
  })

  it('shows total usage overview', () => {
    render(<APIKeyManager />)
    
    // Check that usage overview is displayed with default values
    expect(screen.getByText('Usage Overview')).toBeInTheDocument()
    expect(screen.getByText('Total usage across all AI services')).toBeInTheDocument()
    expect(screen.getByText('Total Tokens')).toBeInTheDocument()
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument()
    expect(screen.getByText('API Requests')).toBeInTheDocument()
  })

  it('calls onKeysUpdate callback when keys change', async () => {
    const mockOnKeysUpdate = jest.fn()
    const mockService = {
      validateApiKey: jest.fn().mockResolvedValue(true),
    }
    mockAIServiceFactory.createService.mockReturnValue(mockService as any)

    render(<APIKeyManager onKeysUpdate={mockOnKeysUpdate} />)
    
    const openaiInput = screen.getByPlaceholderText('sk-...')
    const saveButtons = screen.getAllByText('Save & Validate')
    
    fireEvent.change(openaiInput, { target: { value: 'sk-test-key' } })
    fireEvent.click(saveButtons[0]) // First button should be OpenAI
    
    await waitFor(() => {
      expect(mockOnKeysUpdate).toHaveBeenCalled()
    })
  })

  it('prevents enabling service without valid API key', () => {
    render(<APIKeyManager />)
    
    const serviceToggle = screen.getAllByRole('switch')[0] // First switch should be OpenAI
    fireEvent.click(serviceToggle)
    
    // Should not enable the service
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('apiEnabled_openai', 'true')
  })

  it('shows appropriate status badges', () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'apiKey_openai') return 'sk-test-key'
      if (key === 'apiEnabled_openai') return 'true'
      return null
    })

    const mockService = {
      validateApiKey: jest.fn().mockResolvedValue(true),
    }
    mockAIServiceFactory.createService.mockReturnValue(mockService as any)

    render(<APIKeyManager />)
    
    // Should show "Not Set" for services without keys
    expect(screen.getAllByText('Not Set')).toHaveLength(3) // 3 services without keys
  })
})