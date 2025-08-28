// Utility functions for the Science Paper Manager

import { AppError, ErrorType } from '@/types'

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Create an AppError
 */
export function createError(
  type: ErrorType,
  message: string,
  details?: Record<string, unknown>
): AppError {
  return {
    type,
    message,
    details,
    timestamp: new Date()
  }
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

/**
 * Extract DOI from various formats
 */
export function extractDOI(text: string): string | null {
  const doiRegex = /10\.\d{4,}\/[^\s]+/
  const match = text.match(doiRegex)
  return match ? match[0] : null
}

/**
 * Validate DOI format
 */
export function isValidDOI(doi: string): boolean {
  const doiRegex = /^10\.\d{4,}\/[^\s]+$/
  return doiRegex.test(doi)
}

/**
 * Generate folder name from paper metadata
 */
export function generateFolderName(
  year?: number,
  journal?: string,
  title?: string
): string {
  const yearStr = year?.toString() || 'Unknown'
  const journalStr = journal?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown'
  const titleStr = title?.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_') || 'Untitled'
  
  return `${yearStr}/${journalStr}/${titleStr}`
}

/**
 * Calculate reading time estimate
 */
export function estimateReadingTime(wordCount: number): string {
  const wordsPerMinute = 200
  const minutes = Math.ceil(wordCount / wordsPerMinute)
  
  if (minutes < 60) {
    return `${minutes} min read`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m read`
  }
}

// Performance utilities
export * from './performance'
export * from './analytics'
export * from './monitoring'
export * from './cache'
export * from './dynamic-imports'