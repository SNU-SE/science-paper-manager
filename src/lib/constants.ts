// Application constants

export const APP_NAME = 'Science Paper Manager'
export const APP_DESCRIPTION = 'AI-powered research paper management system with multi-model analysis and semantic search'

// Authentication
export const ADMIN_CREDENTIALS = {
  email: 'admin@email.com',
  password: '1234567890'
} as const

// AI Services
export const AI_SERVICES = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  XAI: 'xai',
  GEMINI: 'gemini'
} as const

export const AI_SERVICE_NAMES = {
  [AI_SERVICES.OPENAI]: 'OpenAI',
  [AI_SERVICES.ANTHROPIC]: 'Anthropic',
  [AI_SERVICES.XAI]: 'xAI',
  [AI_SERVICES.GEMINI]: 'Google Gemini'
} as const

// Reading Status
export const READING_STATUS = {
  UNREAD: 'unread',
  READING: 'reading',
  COMPLETED: 'completed'
} as const

export const READING_STATUS_LABELS = {
  [READING_STATUS.UNREAD]: 'Unread',
  [READING_STATUS.READING]: 'Reading',
  [READING_STATUS.COMPLETED]: 'Completed'
} as const

// Rating
export const MIN_RATING = 1
export const MAX_RATING = 5

// File Upload
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const ALLOWED_FILE_TYPES = ['application/pdf'] as const

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Search
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7
export const MAX_SEARCH_RESULTS = 50
export const DEBOUNCE_DELAY = 300

// Vector Database
export const EMBEDDING_DIMENSIONS = 1536 // OpenAI text-embedding-3-small
export const EMBEDDING_MODEL = 'text-embedding-3-small'

// Local Storage Keys
export const STORAGE_KEYS = {
  API_KEYS: 'spm_api_keys',
  ACTIVE_MODELS: 'spm_active_models',
  USER_PREFERENCES: 'spm_user_preferences',
  AUTH_TOKEN: 'spm_auth_token'
} as const

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  PAPERS: '/api/papers',
  ANALYSES: '/api/analyses',
  SEARCH: '/api/search',
  RAG: '/api/rag',
  UPLOAD: '/api/upload',
  SYNC: '/api/sync'
} as const

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_API_KEY: 'Invalid API key for this service',
  UPLOAD_FAILED: 'Failed to upload file',
  ANALYSIS_FAILED: 'Failed to analyze paper',
  SEARCH_FAILED: 'Search request failed',
  NETWORK_ERROR: 'Network connection error',
  UNKNOWN_ERROR: 'An unexpected error occurred'
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in',
  LOGOUT_SUCCESS: 'Successfully logged out',
  PAPER_ADDED: 'Paper added successfully',
  PAPER_UPDATED: 'Paper updated successfully',
  PAPER_DELETED: 'Paper deleted successfully',
  ANALYSIS_COMPLETE: 'Analysis completed successfully',
  SYNC_COMPLETE: 'Synchronization completed successfully'
} as const

// Theme
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
} as const