import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ZoteroConfig } from '../ZoteroConfig'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the dependencies
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

jest.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: {},
    signOut: jest.fn(),
    signIn: jest.fn()
  })
}))

// Create mock service instance
const mockZoteroService = {
  getUserZoteroSettings: jest.fn().mockResolvedValue(null),
  saveZoteroSettings: jest.fn().mockResolvedValue({
    id: 'test-id',
    userIdZotero: '123456',
    libraryType: 'user',
    libraryId: null,
    autoSync: false,
    syncInterval: 3600,
    lastSyncAt: null,
    syncStatus: 'inactive',
    isActive: true,
    hasApiKey: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  getZoteroLibraryInfo: jest.fn().mockResolvedValue({
    totalItems: 100,
    collections: 5,
    lastModified: new Date()
  }),
  testZoteroConnection: jest.fn().mockResolvedValue(true),
  deleteZoteroSettings: jest.fn().mockResolvedValue(undefined),
  updateSyncSettings: jest.fn().mockResolvedValue(undefined),
  triggerSync: jest.fn().mockResolvedValue(undefined)
}

jest.mock('@/services/settings/UserZoteroService', () => ({
  UserZoteroService: jest.fn().mockImplementation(() => mockZoteroService)
}))

// Mock fetch for API validation
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ZoteroConfig Enhanced', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Reset all mocks
    Object.values(mockZoteroService).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear()
      }
    })
    // Set default return value for getUserZoteroSettings
    mockZoteroService.getUserZoteroSettings.mockResolvedValue(null)
  })

  it('should render the enhanced configuration form', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByText('Zotero Integration')).toBeInTheDocument()
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
      expect(screen.getByLabelText('API Key')).toBeInTheDocument()
      expect(screen.getByLabelText('Library Type')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect zotero/i })).toBeInTheDocument()
    })
  })

  it('should show validation errors for invalid input', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Try to test connection with invalid data
    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('User ID is required')).toBeInTheDocument()
    })
  })

  it('should validate API key length', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill in user ID but short API key
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: '123456' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'short' }
    })

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('API key must be at least 32 characters long')).toBeInTheDocument()
    })
  })

  it('should validate numeric User ID', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill in non-numeric user ID
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: 'invalid-id' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'a'.repeat(32) }
    })

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('User ID must be a numeric value')).toBeInTheDocument()
    })
  })

  it('should test connection successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Total-Results': '100'
      })
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill in valid data
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: '123456' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'a'.repeat(32) }
    })

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.zotero.org/users/123456/items?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Zotero-API-Key': 'a'.repeat(32)
          })
        })
      )
    })
  })

  it('should handle connection test failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    } as Response)

    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    // Fill in valid data
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: '123456' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'a'.repeat(32) }
    })

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid API key or insufficient permissions')).toBeInTheDocument()
    })
  })

  it('should show help instructions', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByText('Setup Instructions:')).toBeInTheDocument()
      expect(screen.getByText(/Go to.*Zotero API Keys.*and create a new key/)).toBeInTheDocument()
      expect(screen.getByText(/Grant "Allow library access" permission/)).toBeInTheDocument()
      expect(screen.getByText(/Find your User ID in.*Account Settings/)).toBeInTheDocument()
      expect(screen.getByText(/Test the connection before saving/)).toBeInTheDocument()
    })
  })

  it('should show group library ID field when group is selected', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('Library Type')).toBeInTheDocument()
    })

    // Change to group library
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)
    
    await waitFor(() => {
      const groupOption = screen.getByText('Group Library')
      fireEvent.click(groupOption)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Group Library ID')).toBeInTheDocument()
    })
  })

  it('should validate group library ID when group is selected', async () => {
    render(<ZoteroConfig />)

    await waitFor(() => {
      expect(screen.getByLabelText('Library Type')).toBeInTheDocument()
    })

    // Change to group library
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)
    
    await waitFor(() => {
      const groupOption = screen.getByText('Group Library')
      fireEvent.click(groupOption)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Group Library ID')).toBeInTheDocument()
    })

    // Fill in valid user ID and API key but invalid group ID
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: '123456' }
    })
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'a'.repeat(32) }
    })
    fireEvent.change(screen.getByLabelText('Group Library ID'), {
      target: { value: 'invalid-group-id' }
    })

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(screen.getByText('Group Library ID must be a numeric value')).toBeInTheDocument()
    })
  })
})