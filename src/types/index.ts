// Core data types for the Science Paper Manager

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