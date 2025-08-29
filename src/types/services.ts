// Service interface definitions

// AI Provider type (defined locally to avoid circular imports)
export type AIProvider = 'openai' | 'anthropic' | 'xai' | 'gemini'

// Forward declarations for types that will be imported from database
export interface ModelPreference {
  id: string
  provider: AIProvider
  modelName: string
  displayName: string
  isDefault: boolean
  parameters: Record<string, any>
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface APIKeyInfo {
  id: string
  provider: AIProvider
  isValid: boolean
  lastValidatedAt: Date | null
  usageCount: number
  hasKey: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ZoteroSettingsInfo {
  id: string
  userIdZotero: string
  libraryType: 'user' | 'group'
  libraryId: string | null
  autoSync: boolean
  syncInterval: number
  lastSyncAt: Date | null
  syncStatus: 'inactive' | 'syncing' | 'completed' | 'failed'
  isActive: boolean
  hasApiKey: boolean
  createdAt: Date
  updatedAt: Date
}

export interface GoogleDriveSettingsInfo {
  id: string
  clientId: string
  redirectUri: string
  refreshToken: string | null
  accessToken: string | null
  tokenExpiry: Date | null
  rootFolderId: string | null
  isActive: boolean
  hasCredentials: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SettingsBackup {
  version: string
  timestamp: string
  userId: string
  settings: {
    aiModels?: ModelPreference[]
    apiKeys?: Partial<APIKeyInfo>[]
    googleDrive?: GoogleDriveSettingsInfo
    zotero?: ZoteroSettingsInfo
  }
}

export interface ExportOptions {
  includeApiKeys: boolean
  includeGoogleDrive: boolean
  includeZotero: boolean
  includeAiModels: boolean
  encryptData: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Enhanced UserAiModelService interface
export interface IUserAiModelService {
  // Existing methods
  getUserModelPreferences(userId: string): Promise<ModelPreference[]>
  getDefaultModel(userId: string, provider: AIProvider): Promise<ModelPreference | null>
  saveModelPreference(
    userId: string, 
    provider: AIProvider, 
    modelName: string, 
    options?: {
      isDefault?: boolean
      parameters?: Record<string, any>
      isEnabled?: boolean
    }
  ): Promise<ModelPreference>
  setDefaultModel(userId: string, provider: AIProvider, modelName: string): Promise<void>
  updateModelParameters(
    userId: string, 
    provider: AIProvider, 
    modelName: string, 
    parameters: Record<string, any>
  ): Promise<void>
  deleteModelPreference(userId: string, provider: AIProvider, modelName: string): Promise<void>
  initializeDefaultModels(userId: string, provider: AIProvider): Promise<void>

  // Enhanced methods for task requirements
  bulkUpdatePreferences(userId: string, preferences: ModelPreference[]): Promise<void>
  exportUserPreferences(userId: string): Promise<ModelPreference[]>
  importUserPreferences(userId: string, preferences: ModelPreference[]): Promise<void>
  resetToDefaults(userId: string, provider?: AIProvider): Promise<void>
  validateModelConfiguration(userId: string, provider: AIProvider, modelName: string): Promise<ValidationResult>
  getModelUsageStats(userId: string, provider: AIProvider, modelName: string): Promise<ModelUsageStats>
}

// Enhanced UserApiKeyService interface
export interface IUserApiKeyService {
  // Existing methods
  getUserApiKeys(userId: string): Promise<APIKeyInfo[]>
  getApiKey(userId: string, provider: AIProvider): Promise<string | null>
  saveApiKey(userId: string, keyData: { provider: AIProvider; apiKey: string }): Promise<APIKeyInfo>
  validateApiKey(userId: string, provider: AIProvider): Promise<boolean>
  deleteApiKey(userId: string, provider: AIProvider): Promise<void>
  incrementUsage(userId: string, provider: AIProvider): Promise<void>

  // Enhanced methods for task requirements
  bulkValidateKeys(userId: string): Promise<Record<AIProvider, boolean>>
  rotateApiKey(userId: string, provider: AIProvider, newKey: string): Promise<APIKeyInfo>
  getKeyUsageHistory(userId: string, provider: AIProvider): Promise<KeyUsageHistory[]>
  exportApiKeyInfo(userId: string): Promise<Partial<APIKeyInfo>[]>
  importApiKeys(userId: string, keys: { provider: AIProvider; apiKey: string }[]): Promise<APIKeyInfo[]>
  testKeyWithCustomRequest(userId: string, provider: AIProvider, testConfig: KeyTestConfig): Promise<KeyTestResult>
}

// Enhanced UserZoteroService interface
export interface IUserZoteroService {
  // Existing methods
  getUserZoteroSettings(userId: string): Promise<ZoteroSettingsInfo | null>
  getZoteroApiKey(userId: string): Promise<string | null>
  saveZoteroSettings(userId: string, config: ZoteroConfig): Promise<ZoteroSettingsInfo>
  updateSyncSettings(userId: string, settings: { autoSync?: boolean; syncInterval?: number }): Promise<void>
  updateSyncStatus(userId: string, status: ZoteroSyncStatus, lastSyncAt?: Date): Promise<void>
  testZoteroConnection(userId: string): Promise<boolean>
  getZoteroLibraryInfo(userId: string): Promise<ZoteroLibraryInfo | null>
  deleteZoteroSettings(userId: string): Promise<void>
  triggerSync(userId: string): Promise<void>

  // Enhanced methods for task requirements
  validateZoteroConfiguration(userId: string): Promise<ValidationResult>
  exportZoteroSettings(userId: string): Promise<ZoteroSettingsInfo | null>
  importZoteroSettings(userId: string, settings: ZoteroConfig): Promise<ZoteroSettingsInfo>
  getSyncHistory(userId: string): Promise<ZoteroSyncHistory[]>
  pauseAutoSync(userId: string): Promise<void>
  resumeAutoSync(userId: string): Promise<void>
  getCollectionStructure(userId: string): Promise<ZoteroCollection[]>
}

// Enhanced GoogleDriveService interface
export interface IUserGoogleDriveService {
  // Existing methods (to be defined based on current implementation)
  getUserGoogleDriveSettings(userId: string): Promise<GoogleDriveSettingsInfo | null>
  saveGoogleDriveSettings(userId: string, config: GoogleDriveConfig): Promise<GoogleDriveSettingsInfo>
  testGoogleDriveConnection(userId: string): Promise<boolean>
  deleteGoogleDriveSettings(userId: string): Promise<void>

  // Enhanced methods for task requirements
  validateGoogleDriveConfiguration(userId: string): Promise<ValidationResult>
  exportGoogleDriveSettings(userId: string): Promise<GoogleDriveSettingsInfo | null>
  importGoogleDriveSettings(userId: string, settings: GoogleDriveConfig): Promise<GoogleDriveSettingsInfo>
  refreshAccessToken(userId: string): Promise<boolean>
  getStorageQuota(userId: string): Promise<GoogleDriveQuota>
  getFolderStructure(userId: string): Promise<GoogleDriveFolder[]>
}

// Settings backup service interface
export interface ISettingsBackupService {
  exportSettings(userId: string, options: ExportOptions): Promise<string>
  importSettings(userId: string, data: string, options: RestoreOptions): Promise<RestoreResult>
  validateBackupFile(data: string): Promise<ValidationResult>
  createBackupMetadata(userId: string, options: ExportOptions): Promise<BackupMetadata>
  encryptBackupData(data: SettingsBackup, password?: string): Promise<string>
  decryptBackupData(encryptedData: string, password?: string): Promise<SettingsBackup>
  getBackupHistory(userId: string): Promise<BackupHistoryEntry[]>
  deleteBackupHistory(userId: string, backupId: string): Promise<void>
}

// Supporting types for enhanced service methods
export interface ModelUsageStats {
  totalRequests: number
  totalTokens: number
  averageResponseTime: number
  errorRate: number
  lastUsed: Date
  costEstimate: number
}

export interface KeyUsageHistory {
  date: Date
  requestCount: number
  tokenCount: number
  errorCount: number
  costEstimate: number
}

export interface KeyTestConfig {
  endpoint?: string
  method?: 'GET' | 'POST'
  payload?: any
  timeout?: number
}

export interface KeyTestResult {
  success: boolean
  responseTime: number
  statusCode?: number
  errorMessage?: string
  details?: any
}

export interface ZoteroConfig {
  apiKey: string
  userIdZotero: string
  libraryType?: 'user' | 'group'
  libraryId?: string
  autoSync?: boolean
  syncInterval?: number
}

export interface ZoteroSyncStatus {
  status: 'inactive' | 'syncing' | 'completed' | 'failed'
  progress?: number
  itemsProcessed?: number
  totalItems?: number
  errorMessage?: string
}

export interface ZoteroLibraryInfo {
  totalItems: number
  collections: number
  lastModified: Date | null
  storageUsed?: number
  storageQuota?: number
}

export interface ZoteroSyncHistory {
  id: string
  startedAt: Date
  completedAt?: Date
  status: ZoteroSyncStatus['status']
  itemsProcessed: number
  itemsAdded: number
  itemsUpdated: number
  itemsDeleted: number
  errorMessage?: string
}

export interface ZoteroCollection {
  id: string
  name: string
  parentCollection?: string
  itemCount: number
  subcollections: ZoteroCollection[]
}

export interface GoogleDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
  accessToken?: string
  tokenExpiry?: Date
  rootFolderId?: string
}

export interface GoogleDriveQuota {
  limit: number
  usage: number
  usageInDrive: number
  usageInDriveTrash: number
}

export interface GoogleDriveFolder {
  id: string
  name: string
  parentId?: string
  createdTime: Date
  modifiedTime: Date
  size?: number
  itemCount?: number
  subfolders: GoogleDriveFolder[]
}

export interface RestoreOptions {
  overwriteExisting: boolean
  selectiveRestore: {
    aiModels: boolean
    apiKeys: boolean
    googleDrive: boolean
    zotero: boolean
  }
  validateBeforeRestore: boolean
  password?: string
}

export interface RestoreResult {
  success: boolean
  restored: {
    aiModels: number
    apiKeys: number
    googleDrive: boolean
    zotero: boolean
  }
  errors: string[]
  warnings: string[]
}

export interface BackupMetadata {
  version: string
  createdAt: Date
  userId: string
  settingsCount: number
  checksum: string
  encrypted: boolean
  size: number
}

export interface BackupHistoryEntry {
  id: string
  createdAt: Date
  size: number
  encrypted: boolean
  settingsIncluded: string[]
  checksum: string
}

// Service factory interfaces
export interface IServiceFactory {
  createUserAiModelService(): IUserAiModelService
  createUserApiKeyService(): IUserApiKeyService
  createUserZoteroService(): IUserZoteroService
  createUserGoogleDriveService(): IUserGoogleDriveService
  createSettingsBackupService(): ISettingsBackupService
}

// Service configuration
export interface ServiceConfig {
  encryptionKey: string
  supabaseUrl: string
  supabaseKey: string
  enableCaching: boolean
  cacheTimeout: number
  enableAnalytics: boolean
  enableAuditLogging: boolean
}

// Service error types
export interface ServiceError extends Error {
  code: string
  context?: Record<string, any>
  retryable: boolean
  timestamp: Date
}

// Service response wrapper
export interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: ServiceError
  metadata?: {
    requestId: string
    timestamp: Date
    duration: number
  }
}