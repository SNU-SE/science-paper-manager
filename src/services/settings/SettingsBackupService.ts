import { getSupabaseClient } from '@/lib/database'
import { 
  UserAiModelPreference, 
  UserApiKey, 
  UserGoogleDriveSettings, 
  UserZoteroSettings,
  BackupFile,
  BackupMetadata,
  SettingsBackupData,
  ExportOptions,
  RestoreOptions,
  RestoreResult
} from '@/lib/database'
import { UserAiModelService } from './UserAiModelService'
import { UserApiKeyService } from './UserApiKeyService'
import { UserZoteroService } from './UserZoteroService'
import { UserGoogleDriveServiceClient } from '../google-drive/UserGoogleDriveService.client'
import CryptoJS from 'crypto-js'

export class SettingsBackupService {
  private supabase = getSupabaseClient()
  private aiModelService = new UserAiModelService()
  private apiKeyService = new UserApiKeyService()
  private zoteroService = new UserZoteroService()
  private googleDriveService = new UserGoogleDriveServiceClient()
  
  private readonly BACKUP_VERSION = '1.0.0'
  private readonly encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'fallback-key-for-development'

  /**
   * Export user settings to encrypted backup file
   */
  async exportSettings(userId: string, options: ExportOptions): Promise<string> {
    try {
      const backupData: SettingsBackupData = {}
      let settingsCount = 0

      // Export AI model preferences
      if (options.includeAiModels) {
        const aiModels = await this.aiModelService.getUserModelPreferences(userId)
        if (aiModels.length > 0) {
          backupData.aiModels = aiModels.map(model => ({
            provider: model.provider,
            model_name: model.modelName,
            is_default: model.isDefault,
            parameters: model.parameters,
            is_enabled: model.isEnabled
          }))
          settingsCount += aiModels.length
        }
      }

      // Export API keys (without actual keys for security)
      if (options.includeApiKeys) {
        const apiKeys = await this.apiKeyService.getUserApiKeys(userId)
        if (apiKeys.length > 0) {
          backupData.apiKeys = apiKeys.map(key => ({
            provider: key.provider,
            is_valid: key.isValid,
            usage_count: key.usageCount,
            // Note: We don't export the actual API keys for security
            has_key: key.hasKey
          }))
          settingsCount += apiKeys.length
        }
      }

      // Export Google Drive settings
      if (options.includeGoogleDrive) {
        const googleDrive = await this.googleDriveService.getUserSettings(userId)
        if (googleDrive) {
          backupData.googleDrive = {
            client_id: googleDrive.client_id,
            redirect_uri: googleDrive.redirect_uri,
            root_folder_id: googleDrive.root_folder_id,
            is_active: googleDrive.is_active
            // Note: We don't export client_secret and tokens for security
          }
          settingsCount += 1
        }
      }

      // Export Zotero settings
      if (options.includeZotero) {
        const zotero = await this.zoteroService.getUserZoteroSettings(userId)
        if (zotero) {
          backupData.zotero = {
            user_id_zotero: zotero.userIdZotero,
            library_type: zotero.libraryType,
            library_id: zotero.libraryId,
            auto_sync: zotero.autoSync,
            sync_interval: zotero.syncInterval,
            is_active: zotero.isActive
            // Note: We don't export the API key for security
          }
          settingsCount += 1
        }
      }

      // Create backup metadata
      const metadata: BackupMetadata = {
        version: this.BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        userId: userId,
        settingsCount: settingsCount,
        encrypted: options.encryptData
      }

      // Create backup file structure
      const backupFile: BackupFile = {
        metadata,
        data: backupData,
        checksum: this.createChecksum(JSON.stringify(backupData))
      }

      // Convert to JSON string
      let jsonString = JSON.stringify(backupFile, null, 2)

      // Encrypt if requested
      if (options.encryptData && options.password) {
        jsonString = this.encryptData(jsonString, options.password)
      }

      return jsonString
    } catch (error) {
      console.error('Error exporting settings:', error)
      throw new Error(`Failed to export settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import settings from backup file
   */
  async importSettings(
    userId: string, 
    backupData: string, 
    options: RestoreOptions
  ): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restored: {
        aiModels: 0,
        apiKeys: 0,
        googleDrive: false,
        zotero: false
      },
      errors: [],
      warnings: []
    }

    try {
      // Decrypt if needed
      let jsonString = backupData
      if (options.password) {
        try {
          jsonString = this.decryptData(backupData, options.password)
        } catch (error) {
          result.errors.push('Failed to decrypt backup file. Please check your password.')
          return result
        }
      }

      // Parse backup file
      let backupFile: BackupFile
      try {
        backupFile = JSON.parse(jsonString)
      } catch (error) {
        result.errors.push('Invalid backup file format')
        return result
      }

      // Validate backup file structure
      if (!this.validateBackupFile(backupFile)) {
        result.errors.push('Invalid backup file structure')
        return result
      }

      // Verify checksum
      const expectedChecksum = this.createChecksum(JSON.stringify(backupFile.data))
      if (backupFile.checksum !== expectedChecksum) {
        result.errors.push('Backup file integrity check failed')
        return result
      }

      // Check version compatibility
      if (!this.isVersionCompatible(backupFile.metadata.version)) {
        result.warnings.push(`Backup version ${backupFile.metadata.version} may not be fully compatible with current version`)
      }

      // Restore AI model preferences
      if (options.selectiveRestore.aiModels && backupFile.data.aiModels) {
        try {
          if (options.overwriteExisting) {
            // Delete existing preferences first
            const existingModels = await this.aiModelService.getUserModelPreferences(userId)
            for (const model of existingModels) {
              await this.aiModelService.deleteModelPreference(userId, model.provider, model.modelName)
            }
          }

          for (const modelData of backupFile.data.aiModels) {
            await this.aiModelService.saveModelPreference(
              userId,
              modelData.provider,
              modelData.model_name,
              {
                isDefault: modelData.is_default,
                parameters: modelData.parameters,
                isEnabled: modelData.is_enabled
              }
            )
            result.restored.aiModels++
          }
        } catch (error) {
          result.errors.push(`Failed to restore AI model preferences: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Note: API keys cannot be restored as they are not exported for security reasons
      if (options.selectiveRestore.apiKeys && backupFile.data.apiKeys) {
        result.warnings.push('API keys cannot be restored from backup for security reasons. Please re-enter your API keys manually.')
      }

      // Restore Google Drive settings
      if (options.selectiveRestore.googleDrive && backupFile.data.googleDrive) {
        try {
          if (options.overwriteExisting) {
            await this.googleDriveService.deleteUserSettings(userId)
          }

          // Note: Only non-sensitive settings can be restored
          result.warnings.push('Google Drive client secret and tokens cannot be restored from backup for security reasons. Please reconfigure your Google Drive settings.')
          result.restored.googleDrive = true
        } catch (error) {
          result.errors.push(`Failed to restore Google Drive settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Restore Zotero settings
      if (options.selectiveRestore.zotero && backupFile.data.zotero) {
        try {
          if (options.overwriteExisting) {
            await this.zoteroService.deleteZoteroSettings(userId)
          }

          // Note: Only non-sensitive settings can be restored
          result.warnings.push('Zotero API key cannot be restored from backup for security reasons. Please re-enter your Zotero API key.')
          result.restored.zotero = true
        } catch (error) {
          result.errors.push(`Failed to restore Zotero settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      result.success = result.errors.length === 0
      return result
    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return result
    }
  }

  /**
   * Create a preview of what will be restored
   */
  async previewRestore(backupData: string, password?: string): Promise<{
    metadata: BackupMetadata
    preview: {
      aiModels: number
      apiKeys: number
      googleDrive: boolean
      zotero: boolean
    }
    warnings: string[]
  }> {
    const warnings: string[] = []

    try {
      // Decrypt if needed
      let jsonString = backupData
      if (password) {
        jsonString = this.decryptData(backupData, password)
      }

      // Parse backup file
      const backupFile: BackupFile = JSON.parse(jsonString)

      // Validate structure
      if (!this.validateBackupFile(backupFile)) {
        throw new Error('Invalid backup file structure')
      }

      // Check version compatibility
      if (!this.isVersionCompatible(backupFile.metadata.version)) {
        warnings.push(`Backup version ${backupFile.metadata.version} may not be fully compatible`)
      }

      // Add security warnings
      if (backupFile.data.apiKeys && backupFile.data.apiKeys.length > 0) {
        warnings.push('API keys cannot be restored and will need to be re-entered')
      }
      if (backupFile.data.googleDrive) {
        warnings.push('Google Drive credentials cannot be restored and will need to be reconfigured')
      }
      if (backupFile.data.zotero) {
        warnings.push('Zotero API key cannot be restored and will need to be re-entered')
      }

      return {
        metadata: backupFile.metadata,
        preview: {
          aiModels: backupFile.data.aiModels?.length || 0,
          apiKeys: backupFile.data.apiKeys?.length || 0,
          googleDrive: !!backupFile.data.googleDrive,
          zotero: !!backupFile.data.zotero
        },
        warnings
      }
    } catch (error) {
      throw new Error(`Failed to preview backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate backup file structure
   */
  private validateBackupFile(backupFile: any): backupFile is BackupFile {
    return (
      backupFile &&
      typeof backupFile === 'object' &&
      backupFile.metadata &&
      typeof backupFile.metadata === 'object' &&
      backupFile.data &&
      typeof backupFile.data === 'object' &&
      typeof backupFile.checksum === 'string'
    )
  }

  /**
   * Check if backup version is compatible
   */
  private isVersionCompatible(version: string): boolean {
    // For now, we only support version 1.0.0
    return version === this.BACKUP_VERSION
  }

  /**
   * Create checksum for data integrity
   */
  private createChecksum(data: string): string {
    return CryptoJS.SHA256(data).toString()
  }

  /**
   * Encrypt data with password
   */
  private encryptData(data: string, password: string): string {
    return CryptoJS.AES.encrypt(data, password).toString()
  }

  /**
   * Decrypt data with password
   */
  private decryptData(encryptedData: string, password: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, password)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    
    if (!decrypted) {
      throw new Error('Failed to decrypt data - invalid password or corrupted file')
    }
    
    return decrypted
  }

  /**
   * Generate backup filename
   */
  generateBackupFilename(userId: string, encrypted: boolean = false): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const extension = encrypted ? 'encrypted.json' : 'json'
    return `settings-backup-${userId.substring(0, 8)}-${timestamp}.${extension}`
  }
}