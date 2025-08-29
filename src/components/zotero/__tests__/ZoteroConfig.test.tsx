import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ZoteroConfig } from '../ZoteroConfig'

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

// Mock the auth hook
jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: jest.fn()
}))

import { useAuth } from '@/components/auth/AuthProvider'
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ZoteroConfig', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      session: {} as any,
      signOut: jest.fn(),
      signIn: jest.fn()
    })
  })

  it('should render configuration form when not configured', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByText('Zotero Integration')).toBeInTheDocument()
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
      expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      expect(screen.getByLabelText('Library Type')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect zotero/i })).toBeInTheDocument()
    })
  })

  it('should show configured state when Zotero is connected', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isConfigured: true,
          config: {
            userId: 'test-user',
            libraryType: 'user',
            hasApiKey: true
          }
        }
      })
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByText('✓ Zotero is connected')).toBeInTheDocument()
      expect(screen.getByText('User ID: test-user | Library: user')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /disconnect zotero/i })).toBeInTheDocument()
    })
  })

  it('should handle form submission successfully', async () => {
    // Initial check - not configured
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isConfigured: false, config: null }
      })
    } as Response)

    // Configuration request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Zotero configured successfully'
      })
    } as Response)

    const onConfigured = jest.fn()
    render(<ZoteroConfig onConfigured={onConfigured} />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill form
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: 'test-user' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'test-api-key' }
    })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /connect zotero/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/zotero/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'test-user',
          apiKey: 'test-api-key',
          libraryType: 'user',
          libraryId: ''
        })
      })
    })

    expect(onConfigured).toHaveBeenCalled()
  })

  it('should handle configuration errors', async () => {
    // Initial check - not configured
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isConfigured: false, config: null }
      })
    } as Response)

    // Configuration request - error
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Invalid API key'
      })
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill form
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: 'test-user' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'invalid-key' }
    })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /connect zotero/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid API key')).toBeInTheDocument()
    })
  })

  it('should handle disconnect functionality', async () => {
    // Initial check - configured
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isConfigured: true,
          config: {
            userId: 'test-user',
            libraryType: 'user',
            hasApiKey: true
          }
        }
      })
    } as Response)

    // Disconnect request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Zotero disconnected successfully'
      })
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disconnect zotero/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /disconnect zotero/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/zotero/config', {
        method: 'DELETE'
      })
    })
  })

  it('should show group library ID field when group library is selected', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isConfigured: false, config: null }
      })
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('Library Type')).toBeInTheDocument()
    })

    // Change to group library
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)
    
    // Wait for dropdown to open and click the option
    await waitFor(() => {
      const groupOption = screen.getByText('Group Library')
      fireEvent.click(groupOption)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Group Library ID')).toBeInTheDocument()
    })
  })

  it('should show loading state during form submission', async () => {
    // Initial check - not configured
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isConfigured: false, config: null }
      })
    } as Response)

    // Configuration request - slow response
    mockFetch.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true })
      } as Response), 100)
    }))

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill form
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: 'test-user' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'test-key' }
    })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /connect zotero/i }))

    // Should show loading state
    expect(screen.getByRole('button', { name: /connect zotero/i })).toBeDisabled()
  })
})