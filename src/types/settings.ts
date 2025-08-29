// Settings-specific type definitions
import * as React from 'react'

// AI Provider type (defined locally to avoid circular imports)
export type AIProvider = 'openai' | 'anthropic' | 'xai' | 'gemini'

// Service configuration types
export interface AIServiceConfig {
  provider: AIProvider
  apiKey: string
  modelName?: string
  parameters?: Record<string, any>
}

export interface ZoteroConfig {
  apiKey: string
  userIdZotero: string
  libraryType?: 'user' | 'group'
  libraryId?: string
  autoSync?: boolean
  syncInterval?: number
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

// Settings form types
export interface SettingsFormField {
  name: string
  label: string
  type: 'text' | 'password' | 'select' | 'checkbox' | 'number' | 'textarea'
  placeholder?: string
  required?: boolean
  validation?: ValidationRule[]
  options?: { value: string; label: string }[]
  helpText?: string
  sensitive?: boolean // For API keys, passwords, etc.
}

export interface SettingsFormSection {
  id: string
  title: string
  description?: string
  fields: SettingsFormField[]
  collapsible?: boolean
  defaultExpanded?: boolean
}

export interface SettingsFormConfig {
  sections: SettingsFormSection[]
  submitLabel?: string
  resetLabel?: string
  showReset?: boolean
  autoSave?: boolean
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit'
}

// Settings validation types
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom' | 'apiKey'
  value?: any
  message: string
  validator?: (value: any) => boolean | Promise<boolean>
}

export interface FieldValidationResult {
  isValid: boolean
  error?: string
  warning?: string
}

export interface FormValidationResult {
  isValid: boolean
  fieldErrors: Record<string, string>
  fieldWarnings: Record<string, string>
  globalErrors: string[]
  globalWarnings: string[]
}

// Settings state management types
export interface SettingsState {
  loading: boolean
  saving: boolean
  validating: boolean
  dirty: boolean
  lastSaved?: Date
  error?: string
  validationErrors: Record<string, string>
}

export interface SettingsAction {
  type: 'SET_LOADING' | 'SET_SAVING' | 'SET_VALIDATING' | 'SET_DIRTY' | 
        'SET_ERROR' | 'SET_VALIDATION_ERRORS' | 'RESET_STATE' | 'SET_LAST_SAVED'
  payload?: any
}

// Settings context types
export interface SettingsContextValue {
  state: SettingsState
  dispatch: React.Dispatch<SettingsAction>
  saveSettings: (data: any) => Promise<void>
  validateField: (field: string, value: any) => Promise<FieldValidationResult>
  resetForm: () => void
  exportSettings: (options: ExportOptions) => Promise<string>
  importSettings: (data: string, options: RestoreOptions) => Promise<RestoreResult>
}

// Settings backup/export types
export interface ExportOptions {
  includeApiKeys: boolean
  includeGoogleDrive: boolean
  includeZotero: boolean
  includeAiModels: boolean
  encryptData: boolean
  password?: string
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

export interface BackupFile {
  metadata: BackupMetadata
  data: SettingsBackupData
  checksum: string
}

export interface BackupMetadata {
  version: string
  createdAt: string
  userId: string
  settingsCount: number
  encrypted: boolean
}

export interface SettingsBackupData {
  aiModels?: any[]
  apiKeys?: any[]
  googleDrive?: any
  zotero?: any
}

// Settings UI component types
export interface SettingsTabConfig {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  component: React.ComponentType<SettingsTabProps>
  requiresAuth?: boolean
  badge?: string | number
}

export interface SettingsTabProps {
  userId: string
  onSettingsChange?: (settings: any) => void
  onError?: (error: Error) => void
  onSuccess?: (message: string) => void
}

export interface SettingsLayoutProps {
  children: React.ReactNode
  tabs: SettingsTabConfig[]
  activeTab: string
  onTabChange: (tabId: string) => void
  actions?: React.ReactNode
}

// Settings notification types
export interface SettingsNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  actions?: NotificationAction[]
  persistent?: boolean
}

export interface NotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary' | 'danger'
}

// Settings analytics types
export interface SettingsAnalytics {
  settingsSaved: number
  validationErrors: number
  apiKeyValidations: number
  backupsCreated: number
  restoresPerformed: number
  lastActivity: Date
}

// Settings security types
export interface SecurityConfig {
  encryptionEnabled: boolean
  keyRotationInterval: number
  auditLogging: boolean
  sessionTimeout: number
  requireReauth: boolean
}

export interface AuditLogEntry {
  id: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'export' | 'import' | 'validate'
  resource: 'api_key' | 'ai_model' | 'zotero' | 'google_drive' | 'backup'
  details: Record<string, any>
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

// Settings synchronization types
export interface SyncConfig {
  enabled: boolean
  interval: number
  conflictResolution: 'local' | 'remote' | 'manual'
  lastSync?: Date
  syncErrors: string[]
}

export interface SyncStatus {
  inProgress: boolean
  lastSync?: Date
  pendingChanges: number
  conflicts: SyncConflict[]
  errors: string[]
}

export interface SyncConflict {
  id: string
  resource: string
  localValue: any
  remoteValue: any
  timestamp: Date
  resolved: boolean
}

// Settings performance types
export interface PerformanceMetrics {
  loadTime: number
  saveTime: number
  validationTime: number
  renderTime: number
  memoryUsage: number
  errorRate: number
  lastMeasured: Date
}

// Settings accessibility types
export interface AccessibilitySettings {
  announceChanges: boolean
  keyboardNavigation: boolean
  screenReaderSupport: boolean
  highContrast: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large'
  focusIndicators: boolean
}

// Settings theme types
export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  accentColor: string
  borderRadius: 'none' | 'small' | 'medium' | 'large'
  compactMode: boolean
  animations: boolean
}

// Settings internationalization types
export interface I18nSettings {
  locale: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  numberFormat: string
  currency: string
  timezone: string
}