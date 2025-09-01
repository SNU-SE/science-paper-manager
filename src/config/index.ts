// Application configuration
import { env, config as envConfig, isFeatureEnabled } from './environment'

export const config = {
  // Environment configuration
  env: envConfig,
  
  // Authentication
  auth: {
    adminCredentials: {
      email: 'admin@email.com',
      password: '1234567890'
    },
    session: {
      timeout: envConfig.security.sessionTimeout,
      csrfTokenExpiry: envConfig.security.csrfTokenExpiry,
    }
  },

  // AI Services
  aiServices: {
    openai: {
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      embeddingModel: 'text-embedding-3-small',
      enabled: isFeatureEnabled('aiAnalysis') && !!env.OPENAI_API_KEY
    },
    anthropic: {
      name: 'Anthropic',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      enabled: isFeatureEnabled('aiAnalysis') && !!env.ANTHROPIC_API_KEY
    },
    xai: {
      name: 'xAI',
      models: ['grok-1'],
      enabled: isFeatureEnabled('aiAnalysis')
    },
    gemini: {
      name: 'Google Gemini',
      models: ['gemini-pro', 'gemini-pro-vision'],
      enabled: isFeatureEnabled('aiAnalysis') && !!env.GOOGLE_AI_API_KEY
    }
  },

  // Database
  database: {
    vectorDimensions: 1536, // OpenAI text-embedding-3-small dimensions
    similarityThreshold: 0.7,
    maxSearchResults: 10,
    url: envConfig.database.url
  },

  // Redis/Cache
  redis: {
    url: envConfig.redis.url,
    password: envConfig.redis.password,
    db: envConfig.redis.db
  },

  // Background Processing
  backgroundJobs: envConfig.backgroundJobs,

  // Monitoring
  monitoring: envConfig.monitoring,

  // Security
  security: {
    ...envConfig.security,
    monitoring: {
      enabled: envConfig.features.securityMonitoring,
      suspiciousActivityThreshold: env.SUSPICIOUS_ACTIVITY_THRESHOLD
    }
  },

  // WebSocket/Notifications
  websocket: envConfig.websocket,
  notifications: {
    batchSize: env.NOTIFICATION_BATCH_SIZE,
    retentionDays: env.NOTIFICATION_RETENTION_DAYS,
    enabled: envConfig.features.realTimeNotifications
  },

  // Backup System
  backup: envConfig.backup,

  // API Usage Tracking
  apiUsage: envConfig.apiUsage,

  // Health Monitoring
  health: envConfig.health,

  // Cache Configuration
  cache: envConfig.cache,

  // Rate Limiting
  rateLimit: envConfig.rateLimit,

  // File Upload
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf'],
    googleDriveFolderStructure: '{year}/{journal}/{title}',
    enabled: isFeatureEnabled('googleDrive')
  },

  // Google Drive
  googleDrive: {
    enabled: isFeatureEnabled('googleDrive'),
    clientId: env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_DRIVE_REDIRECT_URI
  },

  // Zotero
  zotero: {
    enabled: isFeatureEnabled('zotero')
  },

  // Feature Flags
  features: envConfig.features,

  // Logging
  logging: envConfig.logging,

  // UI
  ui: {
    itemsPerPage: 20,
    maxTagsDisplay: 5,
    debounceDelay: 300
  }
}

// Export environment variables for direct access
export { env, isFeatureEnabled }

export default config