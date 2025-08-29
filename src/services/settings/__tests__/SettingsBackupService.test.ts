import { SettingsBackupService } from '../SettingsBackupService'
import { UserAiModelService } from '../UserAiModelService'
import { UserApiKeyService } from '../UserApiKeyService'
import { UserZoteroService } from '../UserZoteroService'
import { UserGoogleDriveService } from '../../google-drive/UserGoogleDriveService'
import { ExportOptions, RestoreOptions } from '@/lib/database'

// Mock the services
jest.mock('../UserAiModelService')
jest.mock('../UserApiKeyService')
jest.mock('../UserZoteroService')
jest.mock('../../google-drive/UserGoogleDriveService')
jest.mock('@/lib/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  }))
}))

describe('SettingsBackupService', () => {
  let service: SettingsBackupService
  let mockAiModelService: jest.Mocked<UserAiModelService>
  let mockApiKeyService: jest.Mocked<UserApiKeyService>
  let mockZoteroService: jest.Mocked<UserZoteroService>
  let mockGoogleDriveService: jest.Mocked<UserGoogleDriveService>

  const mockUserId = 'test-user-123'

  // Helper function to create mock backup data
  const createMockBackup = (data: any, encrypted = false, password?: string) => {
    const backupFile = {
      metadata: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        userId: mockUserId,
        settingsCount: 1,
        encrypted
      },
      data,
      checksum: 'mock-checksum'
    }

    let jsonString = JSON.stringify(backupFile)
    
    if (encrypted && password) {
      // Mock encryption - in real implementation this would use CryptoJS
      jsonString = `encrypted:${jsonString}`
    }

    return jsonString
  }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create service instance
    service = new SettingsBackupService()

    // Get mocked service instances
    mockAiModelService = (service as any).aiModelService
    mockApiKeyService = (service as any).apiKeyService
    mockZoteroService = (service as any).zoteroService
    mockGoogleDriveService = (service as any).googleDriveService
  })

  describe('exportSettings', () => {
    it('should export AI model preferences when included', async () => {
      const mockAiModels = [
        {
          id: '1',
          provider: 'openai' as const,
          modelName: 'gpt-4o',
          displayName: 'GPT-4o',
          isDefault: true,
          parameters: { temperature: 0.7 },
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockAiModelService.getUserModelPreferences.mockResolvedValue(mockAiModels)
      mockApiKeyService.getUserApiKeys.mockResolvedValue([])
      mockZoteroService.getUserZoteroSettings.mockResolvedValue(null)
      mockGoogleDriveService.getUserSettings.mockResolvedValue(null)

      const options: ExportOptions = {
        includeAiModels: true,
        includeApiKeys: false,
        includeGoogleDrive: false,
        includeZotero: false,
        encryptData: false
      }

      const result = await service.exportSettings(mockUserId, options)
      const backupData = JSON.parse(result)

      expect(backupData.data.aiModels).toHaveLength(1)
      expect(backupData.data.aiModels[0].provider).toBe('openai')
      expect(backupData.data.aiModels[0].model_name).toBe('gpt-4o')
      expect(backupData.metadata.settingsCount).toBe(1)
    })

    it('should export API key references when included', async () => {
      const mockApiKeys = [
        {
          id: '1',
          provider: 'openai' as const,
          isValid: true,
          lastValidatedAt: new Date(),
          usageCount: 5,
          hasKey: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockAiModelService.getUserModelPreferences.mockResolvedValue([])
      mockApiKeyService.getUserApiKeys.mockResolvedValue(mockApiKeys)
      mockZoteroService.getUserZoteroSettings.mockResolvedValue(null)
      mockGoogleDriveService.getUserSettings.mockResolvedValue(null)

      const options: ExportOptions = {
        includeAiModels: false,
        includeApiKeys: true,
        includeGoogleDrive: false,
        includeZotero: false,
        encryptData: false
      }

      const result = await service.exportSettings(mockUserId, options)
      const backupData = JSON.parse(result)

      expect(backupData.data.apiKeys).toHaveLength(1)
      expect(backupData.data.apiKeys[0].provider).toBe('openai')
      expect(backupData.data.apiKeys[0].has_key).toBe(true)
      // Ensure actual API key is not included
      expect(backupData.data.apiKeys[0].api_key).toBeUndefined()
    })

    it('should encrypt data when encryption is enabled', async () => {
      mockAiModelService.getUserModelPreferences.mockResolvedValue([])
      mockApiKeyService.getUserApiKeys.mockResolvedValue([])
      mockZoteroService.getUserZoteroSettings.mockResolvedValue(null)
      mockGoogleDriveService.getUserSettings.mockResolvedValue(null)

      const options: ExportOptions = {
        includeAiModels: false,
        includeApiKeys: false,
        includeGoogleDrive: false,
        includeZotero: false,
        encryptData: true,
        password: 'test-password'
      }

      const result = await service.exportSettings(mockUserId, options)

      // Encrypted data should not be valid JSON
      expect(() => JSON.parse(result)).toThrow()
      // Should be a string (encrypted)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should include checksum for data integrity', async () => {
      mockAiModelService.getUserModelPreferences.mockResolvedValue([])
      mockApiKeyService.getUserApiKeys.mockResolvedValue([])
      mockZoteroService.getUserZoteroSettings.mockResolvedValue(null)
      mockGoogleDriveService.getUserSettings.mockResolvedValue(null)

      const options: ExportOptions = {
        includeAiModels: false,
        includeApiKeys: false,
        includeGoogleDrive: false,
        includeZotero: false,
        encryptData: false
      }

      const result = await service.exportSettings(mockUserId, options)
      const backupData = JSON.parse(result)

      expect(backupData.checksum).toBeDefined()
      expect(typeof backupData.checksum).toBe('string')
      expect(backupData.checksum.length).toBeGreaterThan(0)
    })
  })

  describe('importSettings', () => {

    it('should restore AI model preferences', async () => {
      const mockData = {
        aiModels: [
          {
            provider: 'openai',
            model_name: 'gpt-4o',
            is_default: true,
            parameters: { temperature: 0.7 },
            is_enabled: true
          }
        ]
      }

      mockAiModelService.getUserModelPreferences.mockResolvedValue([])
      mockAiModelService.saveModelPreference.mockResolvedValue({
        id: '1',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        isDefault: true,
        parameters: { temperature: 0.7 },
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const backupData = createMockBackup(mockData)
      const options: RestoreOptions = {
        overwriteExisting: false,
        selectiveRestore: {
          aiModels: true,
          apiKeys: false,
          googleDrive: false,
          zotero: false
        },
        validateBeforeRestore: true
      }

      // Mock the private methods for this test
      const originalValidateBackupFile = (service as any).validateBackupFile
      const originalCreateChecksum = (service as any).createChecksum
      
      ;(service as any).validateBackupFile = jest.fn().mockReturnValue(true)
      ;(service as any).createChecksum = jest.fn().mockReturnValue('mock-checksum')

      const result = await service.importSettings(mockUserId, backupData, options)

      expect(result.success).toBe(true)
      expect(result.restored.aiModels).toBe(1)
      expect(mockAiModelService.saveModelPreference).toHaveBeenCalledWith(
        mockUserId,
        'openai',
        'gpt-4o',
        {
          isDefault: true,
          parameters: { temperature: 0.7 },
          isEnabled: true
        }
      )

      // Restore original methods
      ;(service as any).validateBackupFile = originalValidateBackupFile
      ;(service as any).createChecksum = originalCreateChecksum
    })

    it('should handle invalid backup file format', async () => {
      const invalidBackup = 'invalid json'
      const options: RestoreOptions = {
        overwriteExisting: false,
        selectiveRestore: {
          aiModels: true,
          apiKeys: false,
          googleDrive: false,
          zotero: false
        },
        validateBeforeRestore: true
      }

      const result = await service.importSettings(mockUserId, invalidBackup, options)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid backup file format')
    })

    it('should handle checksum mismatch', async () => {
      const mockData = { aiModels: [] }
      const backupData = createMockBackup(mockData)

      // Mock validation to pass but checksum to fail
      const originalValidateBackupFile = (service as any).validateBackupFile
      const originalCreateChecksum = (service as any).createChecksum
      
      ;(service as any).validateBackupFile = jest.fn().mockReturnValue(true)
      ;(service as any).createChecksum = jest.fn().mockReturnValue('different-checksum')

      const options: RestoreOptions = {
        overwriteExisting: false,
        selectiveRestore: {
          aiModels: true,
          apiKeys: false,
          googleDrive: false,
          zotero: false
        },
        validateBeforeRestore: true
      }

      const result = await service.importSettings(mockUserId, backupData, options)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Backup file integrity check failed')

      // Restore original methods
      ;(service as any).validateBackupFile = originalValidateBackupFile
      ;(service as any).createChecksum = originalCreateChecksum
    })
  })

  describe('previewRestore', () => {
    it('should provide preview of backup contents', async () => {
      const mockData = {
        aiModels: [{ provider: 'openai', model_name: 'gpt-4o' }],
        apiKeys: [{ provider: 'anthropic', has_key: true }],
        googleDrive: { client_id: 'test-client' },
        zotero: { user_id_zotero: 'test-user' }
      }

      const backupData = createMockBackup(mockData)

      // Mock the private methods
      const originalValidateBackupFile = (service as any).validateBackupFile
      const originalIsVersionCompatible = (service as any).isVersionCompatible
      
      ;(service as any).validateBackupFile = jest.fn().mockReturnValue(true)
      ;(service as any).isVersionCompatible = jest.fn().mockReturnValue(true)

      const preview = await service.previewRestore(backupData)

      expect(preview.preview.aiModels).toBe(1)
      expect(preview.preview.apiKeys).toBe(1)
      expect(preview.preview.googleDrive).toBe(true)
      expect(preview.preview.zotero).toBe(true)
      expect(preview.warnings).toContain('API keys cannot be restored and will need to be re-entered')

      // Restore original methods
      ;(service as any).validateBackupFile = originalValidateBackupFile
      ;(service as any).isVersionCompatible = originalIsVersionCompatible
    })
  })

  describe('generateBackupFilename', () => {
    it('should generate appropriate filename for unencrypted backup', () => {
      const filename = service.generateBackupFilename(mockUserId, false)
      
      expect(filename).toMatch(/^settings-backup-test-use-\d{4}-\d{2}-\d{2}\.json$/)
    })

    it('should generate appropriate filename for encrypted backup', () => {
      const filename = service.generateBackupFilename(mockUserId, true)
      
      expect(filename).toMatch(/^settings-backup-test-use-\d{4}-\d{2}-\d{2}\.encrypted\.json$/)
    })
  })
})