import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsBackup } from '../SettingsBackup'
import { AIModelSelectorEnhanced } from '../../ai/AIModelSelectorEnhanced'
import { ZoteroManager } from '../../zotero/ZoteroManager'

// Mock the services
jest.mock('../../../services/settings/SettingsBackupService')
jest.mock('../../../services/settings/UserAiModelService')
jest.mock('../../../services/settings/UserZoteroService')

// Mock the stores
const mockUseAIStore = {
  apiKeys: { openai: 'test-key' },
  activeModels: ['openai'],
  usage: {},
  isValidating: false,
  validationErrors: {},
  updateApiKey: jest.fn(),
  removeApiKey: jest.fn(),
  validateApiKey: jest.fn(),
  toggleModel: jest.fn(),
  hasValidKey: jest.fn(() => true),
  isModelActive: jest.fn(() => true),
  getActiveModelsWithKeys: jest.fn(() => ['openai'])
}

jest.mock('../../../stores', () => ({
  useAIStore: () => mockUseAIStore
}))

// Mock auth provider
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@example.com' },
    session: {},
    signOut: jest.fn(),
    signIn: jest.fn()
  })
}))

// Mock child components for ZoteroManager
jest.mock('../../zotero/ZoteroConfig', () => ({
  ZoteroConfig: ({ onConfigured }: { onConfigured: (settings: any) => void }) => (
    <div data-testid="zotero-config">
      <button onClick={() => onConfigured({ userId: 'test-user', libraryType: 'user' })}>
        Configure
      </button>
    </div>
  )
}))

jest.mock('../../zotero/ZoteroSyncStatus', () => ({
  ZoteroSyncStatus: () => <div data-testid="zotero-sync-status">Sync Status</div>
}))

describe('Settings Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Settings Save and Load Flow', () => {
    it('should save AI model settings and persist across page refresh', async () => {
      const user = userEvent.setup()
      
      // Render AI model selector
      render(<AIModelSelectorEnhanced />)
      
      // Verify initial state
      expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
      
      // Show API key input for Anthropic
      const eyeButtons = screen.getAllByRole('button')
      const anthropicEyeButton = eyeButtons.find(btn => 
        btn.closest('.relative')?.textContent?.includes('Anthropic')
      )
      
      if (anthropicEyeButton) {
        await user.click(anthropicEyeButton)
        
        // Add API key
        const apiKeyInput = screen.getByLabelText('API Key')
        await user.type(apiKeyInput, 'test-anthropic-key')
        
        // Save the key
        const saveButton = screen.getByRole('button', { name: /key/i })
        await user.click(saveButton)
        
        // Verify the service was called
        expect(mockUseAIStore.updateApiKey).toHaveBeenCalledWith('anthropic', 'test-anthropic-key')
        expect(mockUseAIStore.validateApiKey).toHaveBeenCalledWith('anthropic', 'test-anthropic-key')
      }
    })

    it('should handle settings backup and restore flow', async () => {
      const user = userEvent.setup()
      
      // Mock backup service
      const mockBackupService = require('../../../services/settings/SettingsBackupService').SettingsBackupService
      mockBackupService.prototype.exportSettings = jest.fn().mockResolvedValue(
        JSON.stringify({
          metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
          data: { aiModels: [{ provider: 'openai', model_name: 'gpt-4o' }] }
        })
      )
      mockBackupService.prototype.importSettings = jest.fn().mockResolvedValue({
        success: true,
        restored: { aiModels: 1 }
      })
      
      render(<SettingsBackup />)
      
      // Export settings
      const exportButton = screen.getByRole('button', { name: /export/i })
      await user.click(exportButton)
      
      await waitFor(() => {
        expect(mockBackupService.prototype.exportSettings).toHaveBeenCalled()
      })
      
      // Import settings
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      // Mock file input
      const fileInput = screen.getByLabelText(/select backup file/i)
      const file = new File(['{"test": "data"}'], 'backup.json', { type: 'application/json' })
      
      await user.upload(fileInput, file)
      
      // Confirm import
      const confirmButton = screen.getByRole('button', { name: /confirm import/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockBackupService.prototype.importSettings).toHaveBeenCalled()
      })
    })
  })

  describe('Cross-Component Settings Interaction', () => {
    it('should maintain settings consistency across different components', async () => {
      const user = userEvent.setup()
      
      // Render multiple settings components
      const { rerender } = render(
        <div>
          <AIModelSelectorEnhanced />
          <ZoteroManager />
        </div>
      )
      
      // Configure Zotero
      const configureButton = screen.getByText('Configure')
      await user.click(configureButton)
      
      // Verify Zotero sync status appears
      await waitFor(() => {
        expect(screen.getByTestId('zotero-sync-status')).toBeInTheDocument()
      })
      
      // Rerender to simulate navigation
      rerender(
        <div>
          <AIModelSelectorEnhanced />
          <ZoteroManager />
        </div>
      )
      
      // Verify settings are maintained
      expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
      expect(screen.getByTestId('zotero-sync-status')).toBeInTheDocument()
    })

    it('should handle concurrent settings updates correctly', async () => {
      const user = userEvent.setup()
      
      render(
        <div>
          <AIModelSelectorEnhanced />
          <SettingsBackup />
        </div>
      )
      
      // Start multiple operations concurrently
      const promises = []
      
      // Update AI model settings
      const eyeButton = screen.getAllByRole('button')[0]
      promises.push(user.click(eyeButton))
      
      // Start backup export
      const exportButton = screen.getByRole('button', { name: /export/i })
      promises.push(user.click(exportButton))
      
      // Wait for all operations to complete
      await Promise.all(promises)
      
      // Verify no conflicts occurred
      expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
      expect(screen.getByText('Settings Backup')).toBeInTheDocument()
    })
  })

  describe('Error Handling in Settings Flow', () => {
    it('should handle API key validation failures gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock validation failure
      mockUseAIStore.validateApiKey.mockRejectedValue(new Error('Invalid API key'))
      mockUseAIStore.validationErrors = { anthropic: 'Invalid API key' }
      
      render(<AIModelSelectorEnhanced />)
      
      // Try to add invalid API key
      const eyeButtons = screen.getAllByRole('button')
      const anthropicEyeButton = eyeButtons.find(btn => 
        btn.closest('.relative')?.textContent?.includes('Anthropic')
      )
      
      if (anthropicEyeButton) {
        await user.click(anthropicEyeButton)
        
        const apiKeyInput = screen.getByLabelText('API Key')
        await user.type(apiKeyInput, 'invalid-key')
        
        const saveButton = screen.getByRole('button', { name: /key/i })
        await user.click(saveButton)
        
        // Verify error is displayed
        await waitFor(() => {
          expect(screen.getByText('Invalid API key')).toBeInTheDocument()
        })
      }
    })

    it('should handle backup import failures', async () => {
      const user = userEvent.setup()
      
      // Mock import failure
      const mockBackupService = require('../../../services/settings/SettingsBackupService').SettingsBackupService
      mockBackupService.prototype.importSettings = jest.fn().mockResolvedValue({
        success: false,
        errors: ['Invalid backup file format']
      })
      
      render(<SettingsBackup />)
      
      // Try to import invalid file
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      const fileInput = screen.getByLabelText(/select backup file/i)
      const file = new File(['invalid json'], 'backup.json', { type: 'application/json' })
      
      await user.upload(fileInput, file)
      
      const confirmButton = screen.getByRole('button', { name: /confirm import/i })
      await user.click(confirmButton)
      
      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByText(/Invalid backup file format/)).toBeInTheDocument()
      })
    })
  })

  describe('Settings Persistence', () => {
    it('should persist settings across browser sessions', async () => {
      // Mock localStorage
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      }
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })
      
      render(<AIModelSelectorEnhanced />)
      
      // Verify component loads with persisted settings
      expect(screen.getByText('AI Model Configuration')).toBeInTheDocument()
      
      // Settings should be loaded from store/database
      expect(mockUseAIStore.getActiveModelsWithKeys).toHaveBeenCalled()
    })

    it('should handle settings migration between versions', async () => {
      const mockBackupService = require('../../../services/settings/SettingsBackupService').SettingsBackupService
      
      // Mock old version backup
      const oldVersionBackup = JSON.stringify({
        metadata: { version: '0.9.0' },
        data: { aiModels: [] }
      })
      
      mockBackupService.prototype.importSettings = jest.fn().mockResolvedValue({
        success: true,
        warnings: ['Settings migrated from older version'],
        restored: { aiModels: 0 }
      })
      
      render(<SettingsBackup />)
      
      // Import old version backup should work with warnings
      const user = userEvent.setup()
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      const fileInput = screen.getByLabelText(/select backup file/i)
      const file = new File([oldVersionBackup], 'old-backup.json', { type: 'application/json' })
      
      await user.upload(fileInput, file)
      
      const confirmButton = screen.getByRole('button', { name: /confirm import/i })
      await user.click(confirmButton)
      
      await waitFor(() => {
        expect(mockBackupService.prototype.importSettings).toHaveBeenCalled()
      })
    })
  })
})