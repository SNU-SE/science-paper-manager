// Type definition tests to ensure all types are properly defined
import { 
  NavigationState, 
  NavigationItem, 
  SettingsBackup, 
  ExportOptions,
  AIProvider,
  ModelPreference,
  APIKeyInfo,
  ZoteroSettingsInfo,
  GoogleDriveSettingsInfo,
  ValidationResult
} from '../index'

// Test that all types can be used without compilation errors
describe('Type Definitions', () => {
  it('should have properly defined NavigationState', () => {
    const navState: NavigationState = {
      currentPath: '/dashboard',
      isAuthenticated: true,
      userRole: 'user'
    }
    expect(navState.currentPath).toBe('/dashboard')
  })

  it('should have properly defined NavigationItem', () => {
    const navItem: NavigationItem = {
      href: '/papers',
      label: 'Papers',
      requiresAuth: true
    }
    expect(navItem.href).toBe('/papers')
  })

  it('should have properly defined SettingsBackup', () => {
    const backup: SettingsBackup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      userId: 'user-123',
      settings: {
        aiModels: [],
        apiKeys: [],
        googleDrive: undefined,
        zotero: undefined
      }
    }
    expect(backup.version).toBe('1.0.0')
  })

  it('should have properly defined ExportOptions', () => {
    const options: ExportOptions = {
      includeApiKeys: true,
      includeGoogleDrive: true,
      includeZotero: true,
      includeAiModels: true,
      encryptData: true
    }
    expect(options.includeApiKeys).toBe(true)
  })

  it('should have properly defined AIProvider', () => {
    const providers: AIProvider[] = ['openai', 'anthropic', 'xai', 'gemini']
    expect(providers).toHaveLength(4)
  })

  it('should have properly defined ModelPreference', () => {
    const preference: ModelPreference = {
      id: 'pref-123',
      provider: 'openai',
      modelName: 'gpt-4',
      displayName: 'GPT-4',
      isDefault: true,
      parameters: { temperature: 0.7 },
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    expect(preference.provider).toBe('openai')
  })

  it('should have properly defined APIKeyInfo', () => {
    const keyInfo: APIKeyInfo = {
      id: 'key-123',
      provider: 'openai',
      isValid: true,
      lastValidatedAt: new Date(),
      usageCount: 10,
      hasKey: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    expect(keyInfo.isValid).toBe(true)
  })

  it('should have properly defined ZoteroSettingsInfo', () => {
    const zoteroInfo: ZoteroSettingsInfo = {
      id: 'zotero-123',
      userIdZotero: 'zotero-user-123',
      libraryType: 'user',
      libraryId: null,
      autoSync: true,
      syncInterval: 3600,
      lastSyncAt: new Date(),
      syncStatus: 'completed',
      isActive: true,
      hasApiKey: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    expect(zoteroInfo.libraryType).toBe('user')
  })

  it('should have properly defined GoogleDriveSettingsInfo', () => {
    const driveInfo: GoogleDriveSettingsInfo = {
      id: 'drive-123',
      clientId: 'client-123',
      redirectUri: 'http://localhost:3000/callback',
      refreshToken: 'refresh-token',
      accessToken: 'access-token',
      tokenExpiry: new Date(),
      rootFolderId: 'folder-123',
      isActive: true,
      hasCredentials: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    expect(driveInfo.isActive).toBe(true)
  })

  it('should have properly defined ValidationResult', () => {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: ['Minor warning']
    }
    expect(result.isValid).toBe(true)
    expect(result.warnings).toHaveLength(1)
  })
})