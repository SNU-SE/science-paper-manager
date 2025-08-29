import React from 'react'
import { render, screen } from '@testing-library/react'
import { SettingsBackup } from '../SettingsBackup'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the service
jest.mock('@/services/settings/SettingsBackupService')
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}))

describe('SettingsBackup', () => {
  const mockUserId = 'test-user-123'
  const mockOnSuccess = jest.fn()
  const mockOnError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders backup and restore component', () => {
    render(
      <SettingsBackup 
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    )

    // Check for main heading
    expect(screen.getByText('Backup & Restore')).toBeInTheDocument()
    
    // Check for tabs
    expect(screen.getByText('Import Settings')).toBeInTheDocument()
    
    // Check for export options (should be visible by default)
    expect(screen.getByText('AI Model Preferences')).toBeInTheDocument()
    expect(screen.getByText('Encrypt Backup File')).toBeInTheDocument()
  })

  it('shows security notice about sensitive data', () => {
    render(
      <SettingsBackup 
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    )

    expect(screen.getByText(/for security reasons, sensitive data like api keys/i)).toBeInTheDocument()
  })

  it('renders with proper user ID', () => {
    const { container } = render(
      <SettingsBackup 
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    )

    // Component should render without errors
    expect(container).toBeInTheDocument()
  })
})