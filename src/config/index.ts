// Application configuration

export const config = {
  // Authentication
  auth: {
    adminCredentials: {
      email: 'admin@email.com',
      password: '1234567890'
    }
  },

  // AI Services
  aiServices: {
    openai: {
      name: 'OpenAI',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      embeddingModel: 'text-embedding-3-small'
    },
    anthropic: {
      name: 'Anthropic',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
    },
    xai: {
      name: 'xAI',
      models: ['grok-1']
    },
    gemini: {
      name: 'Google Gemini',
      models: ['gemini-pro', 'gemini-pro-vision']
    }
  },

  // Database
  database: {
    vectorDimensions: 1536, // OpenAI text-embedding-3-small dimensions
    similarityThreshold: 0.7,
    maxSearchResults: 10
  },

  // File Upload
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf'],
    googleDriveFolderStructure: '{year}/{journal}/{title}'
  },

  // UI
  ui: {
    itemsPerPage: 20,
    maxTagsDisplay: 5,
    debounceDelay: 300
  }
}

export default config