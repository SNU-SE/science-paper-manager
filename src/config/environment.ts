/**
 * Environment Configuration and Validation
 * Centralizes all environment variable handling with type safety
 */

import { z } from 'zod'

// Environment variable schema
const envSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // Database
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  TEST_REDIS_URL: z.string().url().optional(),
  
  // Security
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().length(32),
  ENCRYPTION_KEY_ROTATION_DAYS: z.coerce.number().default(90),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(60),
  CSRF_TOKEN_EXPIRY_MINUTES: z.coerce.number().default(30),
  
  // AI Services
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  
  // Google Drive
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().url().optional(),
  
  // Background Processing
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MAX_JOB_ATTEMPTS: z.coerce.number().default(3),
  JOB_QUEUE_PREFIX: z.string().default('science-paper-manager'),
  BACKGROUND_PROCESSING_ENABLED: z.coerce.boolean().default(true),
  
  // Performance Monitoring
  MONITORING_ENABLED: z.coerce.boolean().default(true),
  METRICS_RETENTION_DAYS: z.coerce.number().default(30),
  PERFORMANCE_ALERT_THRESHOLD: z.coerce.number().default(1000),
  SLOW_QUERY_THRESHOLD: z.coerce.number().default(500),
  API_RESPONSE_TIME_THRESHOLD: z.coerce.number().default(2000),
  
  // Security Monitoring
  SECURITY_MONITORING_ENABLED: z.coerce.boolean().default(true),
  SUSPICIOUS_ACTIVITY_THRESHOLD: z.coerce.number().default(10),
  
  // WebSocket/Notifications
  WEBSOCKET_ENABLED: z.coerce.boolean().default(true),
  WEBSOCKET_PORT: z.coerce.number().default(3001),
  NOTIFICATION_BATCH_SIZE: z.coerce.number().default(100),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().default(90),
  
  // Backup System
  BACKUP_ENABLED: z.coerce.boolean().default(true),
  BACKUP_STORAGE_PATH: z.string().default('/var/backups/science-paper-manager'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
  BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
  BACKUP_SCHEDULE_FULL: z.string().default('0 2 * * 0'),
  BACKUP_SCHEDULE_INCREMENTAL: z.string().default('0 2 * * 1-6'),
  
  // API Usage Tracking
  API_USAGE_TRACKING_ENABLED: z.coerce.boolean().default(true),
  DEFAULT_DAILY_LIMIT: z.coerce.number().default(1000),
  ADMIN_DAILY_LIMIT: z.coerce.number().default(10000),
  USAGE_ALERT_THRESHOLD: z.coerce.number().default(0.8),
  
  // Health Monitoring
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
  AUTO_RECOVERY_ENABLED: z.coerce.boolean().default(true),
  SYSTEM_RESOURCE_MONITORING: z.coerce.boolean().default(true),
  MEMORY_THRESHOLD: z.coerce.number().default(0.8),
  CPU_THRESHOLD: z.coerce.number().default(0.8),
  
  // Cache Configuration
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_DEFAULT: z.coerce.number().default(3600),
  CACHE_TTL_SEARCH: z.coerce.number().default(1800),
  CACHE_TTL_ANALYSIS: z.coerce.number().default(7200),
  CACHE_MAX_SIZE: z.coerce.number().default(1000),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.coerce.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: z.coerce.boolean().default(false),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  LOG_FILE_ENABLED: z.coerce.boolean().default(false),
  LOG_FILE_PATH: z.string().default('/var/log/science-paper-manager.log'),
  
  // Feature Flags
  FEATURE_GOOGLE_DRIVE: z.coerce.boolean().default(true),
  FEATURE_ZOTERO: z.coerce.boolean().default(true),
  FEATURE_AI_ANALYSIS: z.coerce.boolean().default(true),
  FEATURE_BULK_UPLOAD: z.coerce.boolean().default(false),
  FEATURE_BACKGROUND_PROCESSING: z.coerce.boolean().default(true),
  FEATURE_REAL_TIME_NOTIFICATIONS: z.coerce.boolean().default(true),
  FEATURE_ADVANCED_SEARCH: z.coerce.boolean().default(true),
  FEATURE_PERFORMANCE_MONITORING: z.coerce.boolean().default(true),
  FEATURE_SECURITY_MONITORING: z.coerce.boolean().default(true),
  FEATURE_BACKUP_SYSTEM: z.coerce.boolean().default(true),
  
  // Development/Testing
  DEBUG_MODE: z.coerce.boolean().default(false),
  
  // Email (Optional)
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
})

// Parse and validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    throw new Error('Environment validation failed')
  }
}

// Export validated environment configuration
export const env = validateEnv()

// Type for environment variables
export type Environment = z.infer<typeof envSchema>

// Environment-specific configurations
export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Database configuration
  database: {
    url: env.DATABASE_URL,
    testUrl: env.TEST_DATABASE_URL,
  },
  
  // Redis configuration
  redis: {
    url: env.REDIS_URL || null,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    testUrl: env.TEST_REDIS_URL,
  },
  
  // Security configuration
  security: {
    encryptionKey: env.ENCRYPTION_KEY,
    sessionTimeout: env.SESSION_TIMEOUT_MINUTES * 60 * 1000, // Convert to milliseconds
    csrfTokenExpiry: env.CSRF_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    keyRotationInterval: env.ENCRYPTION_KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000,
  },
  
  // Background processing configuration
  backgroundJobs: {
    concurrency: env.WORKER_CONCURRENCY,
    maxAttempts: env.MAX_JOB_ATTEMPTS,
    queuePrefix: env.JOB_QUEUE_PREFIX,
    enabled: env.BACKGROUND_PROCESSING_ENABLED,
  },
  
  // Monitoring configuration
  monitoring: {
    enabled: env.MONITORING_ENABLED,
    retentionDays: env.METRICS_RETENTION_DAYS,
    alertThreshold: env.PERFORMANCE_ALERT_THRESHOLD,
    slowQueryThreshold: env.SLOW_QUERY_THRESHOLD,
    apiResponseTimeThreshold: env.API_RESPONSE_TIME_THRESHOLD,
  },
  
  // WebSocket configuration
  websocket: {
    enabled: env.WEBSOCKET_ENABLED,
    port: env.WEBSOCKET_PORT,
  },
  
  // Backup configuration
  backup: {
    enabled: env.BACKUP_ENABLED,
    storagePath: env.BACKUP_STORAGE_PATH,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    encryptionKey: env.BACKUP_ENCRYPTION_KEY,
    schedules: {
      full: env.BACKUP_SCHEDULE_FULL,
      incremental: env.BACKUP_SCHEDULE_INCREMENTAL,
    },
  },
  
  // Feature flags
  features: {
    googleDrive: env.FEATURE_GOOGLE_DRIVE,
    zotero: env.FEATURE_ZOTERO,
    aiAnalysis: env.FEATURE_AI_ANALYSIS,
    bulkUpload: env.FEATURE_BULK_UPLOAD,
    backgroundProcessing: env.FEATURE_BACKGROUND_PROCESSING,
    realTimeNotifications: env.FEATURE_REAL_TIME_NOTIFICATIONS,
    advancedSearch: env.FEATURE_ADVANCED_SEARCH,
    performanceMonitoring: env.FEATURE_PERFORMANCE_MONITORING,
    securityMonitoring: env.FEATURE_SECURITY_MONITORING,
    backupSystem: env.FEATURE_BACKUP_SYSTEM,
  },
  
  // Cache configuration
  cache: {
    enabled: env.CACHE_ENABLED,
    ttl: {
      default: env.CACHE_TTL_DEFAULT,
      search: env.CACHE_TTL_SEARCH,
      analysis: env.CACHE_TTL_ANALYSIS,
    },
    maxSize: env.CACHE_MAX_SIZE,
  },
  
  // Rate limiting configuration
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    skipSuccessfulRequests: env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
    skipFailedRequests: env.RATE_LIMIT_SKIP_FAILED_REQUESTS,
  },
  
  // API usage tracking
  apiUsage: {
    enabled: env.API_USAGE_TRACKING_ENABLED,
    defaultDailyLimit: env.DEFAULT_DAILY_LIMIT,
    adminDailyLimit: env.ADMIN_DAILY_LIMIT,
    alertThreshold: env.USAGE_ALERT_THRESHOLD,
  },
  
  // Health monitoring
  health: {
    enabled: env.HEALTH_CHECK_ENABLED,
    checkInterval: env.HEALTH_CHECK_INTERVAL,
    autoRecovery: env.AUTO_RECOVERY_ENABLED,
    resourceMonitoring: env.SYSTEM_RESOURCE_MONITORING,
    thresholds: {
      memory: env.MEMORY_THRESHOLD,
      cpu: env.CPU_THRESHOLD,
    },
  },
  
  // Logging configuration
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
    fileEnabled: env.LOG_FILE_ENABLED,
    filePath: env.LOG_FILE_PATH,
  },
} as const

// Utility function to check if a feature is enabled
export function isFeatureEnabled(feature: keyof typeof config.features): boolean {
  return config.features[feature]
}

// Utility function to get environment-specific database URL
export function getDatabaseUrl(): string {
  if (config.isTest && env.TEST_DATABASE_URL) {
    return env.TEST_DATABASE_URL
  }
  return env.DATABASE_URL
}

// Utility function to get environment-specific Redis URL
export function getRedisUrl(): string | null {
  if (config.isTest && env.TEST_REDIS_URL) {
    return env.TEST_REDIS_URL
  }
  return env.REDIS_URL || null
}