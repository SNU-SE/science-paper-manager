// Core data types for the Science Paper Manager
import * as React from 'react'

export interface Paper {
  id: string
  title: string
  authors: string[]
  journal?: string
  publicationYear?: number
  doi?: string
  abstract?: string
  zoteroKey?: string
  googleDriveId?: string
  googleDriveUrl?: string
  pdfPath?: string
  readingStatus: 'unread' | 'reading' | 'completed'
  dateAdded: Date
  dateRead?: Date
  lastModified: Date
}

export interface UserEvaluation {
  id: string
  paperId: string
  rating?: number // 1-5
  notes?: string
  tags: string[]
  highlights?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface AIAnalysisResult {
  id: string
  paperId: string
  modelProvider: 'openai' | 'anthropic' | 'xai' | 'gemini'
  modelName: string
  summary: string
  keywords: string[]
  scientificRelevance?: Record<string, unknown>
  confidenceScore: number
  tokensUsed: number
  processingTimeMs: number
  createdAt: Date
}

export interface MultiModelAnalysis {
  openai?: AIAnalysisResult
  anthropic?: AIAnalysisResult
  xai?: AIAnalysisResult
  gemini?: AIAnalysisResult
}

export interface SearchResult {
  id: string
  paper: Paper
  similarity: number
  relevantExcerpts: string[]
}

export interface RAGResponse {
  answer: string
  sources: Paper[]
  confidence: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Paper[]
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SearchFilters {
  readingStatus?: string[]
  publicationYear?: { min?: number; max?: number }
  tags?: string[]
  rating?: { min?: number; max?: number }
}

export interface UsageStats {
  tokensUsed: number
  requestCount: number
  estimatedCost: number
  lastUsed: Date
}

export type AIModel = 'openai' | 'anthropic' | 'xai' | 'gemini'

export enum ErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  API_KEY_INVALID = 'API_KEY_INVALID',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface AppError {
  type: ErrorType
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

// Settings-related types
export interface SettingsFormData {
  provider: string
  apiKey?: string
  modelName?: string
  parameters?: Record<string, any>
  isDefault?: boolean
  isEnabled?: boolean
}

export interface SettingsFormErrors {
  [key: string]: string | undefined
}

export interface SettingsFormState {
  data: SettingsFormData
  errors: SettingsFormErrors
  isSubmitting: boolean
  isDirty: boolean
}

// Navigation types
export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

export interface NavigationConfig {
  items: NavigationItem[]
  userMenuItems: NavigationItem[]
  breadcrumbs?: BreadcrumbItem[]
}

export interface NavigationItem {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  requiresAuth?: boolean
  badge?: string | number
  children?: NavigationItem[]
}

// Settings backup/restore types
export interface BackupMetadata {
  version: string
  createdAt: Date
  userId: string
  settingsCount: number
  checksum: string
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

// Component prop types for settings
export interface SettingsTabProps {
  userId: string
  onSettingsChange?: (settings: any) => void
  onError?: (error: AppError) => void
}

export interface SettingsValidationProps {
  value: any
  rules: ValidationRule[]
  onValidation?: (result: ValidationResult) => void
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Performance monitoring types for settings
export interface SettingsPerformanceMetrics {
  loadTime: number
  saveTime: number
  validationTime: number
  renderTime: number
  errorCount: number
  lastUpdated: Date
}

// Accessibility types
export interface AccessibilityConfig {
  announceChanges: boolean
  keyboardNavigation: boolean
  screenReaderSupport: boolean
  highContrast: boolean
  reducedMotion: boolean
}

// Theme and UI preferences
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system'
  compactMode: boolean
  showAdvancedOptions: boolean
  autoSave: boolean
  confirmBeforeDelete: boolean
  accessibility: AccessibilityConfig
}

// Re-export types from specialized modules
export * from './settings'
export * from './navigation'
// Selective re-export from services to avoid conflicts
export type {
  IUserAiModelService,
  IUserApiKeyService,
  IUserZoteroService,
  IUserGoogleDriveService,
  ISettingsBackupService,
  IServiceFactory,
  ServiceConfig,
  ServiceError,
  ServiceResponse,
  ModelUsageStats,
  KeyUsageHistory,
  KeyTestConfig,
  KeyTestResult,
  ZoteroSyncStatus,
  ZoteroLibraryInfo,
  ZoteroSyncHistory,
  ZoteroCollection,
  GoogleDriveQuota,
  GoogleDriveFolder,
  BackupHistoryEntry
} from './services'