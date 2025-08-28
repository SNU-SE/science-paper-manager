import { VectorServiceFactory } from '../VectorServiceFactory'
import { SupabaseVectorService } from '../SupabaseVectorService'

// Mock the SupabaseVectorService
jest.mock('../SupabaseVectorService', () => {
  const mockSupabaseVectorService = jest.fn().mockImplementation(() => ({
    embedPaperWithContext: jest.fn(),
    semanticSearch: jest.fn(),
    ragQuery: jest.fn(),
  }))
  
  return {
    SupabaseVectorService: mockSupabaseVectorService,
  }
})

describe('VectorServiceFactory', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    VectorServiceFactory.resetInstance()
    jest.clearAllMocks()
  })

  describe('getInstance', () => {
    it('should create a new instance when none exists', () => {
      const apiKey = 'test-api-key'
      const instance = VectorServiceFactory.getInstance(apiKey)

      expect(instance).toBeDefined()
      expect(SupabaseVectorService).toHaveBeenCalledWith(apiKey)
    })

    it('should return the same instance on subsequent calls', () => {
      const apiKey = 'test-api-key'
      const instance1 = VectorServiceFactory.getInstance(apiKey)
      const instance2 = VectorServiceFactory.getInstance()

      expect(instance1).toBe(instance2)
      expect(SupabaseVectorService).toHaveBeenCalledTimes(1)
    })

    it('should throw error when no API key provided and no instance exists', () => {
      expect(() => VectorServiceFactory.getInstance()).toThrow(
        'OpenAI API key is required to initialize vector service'
      )
    })

    it('should not require API key when instance already exists', () => {
      const apiKey = 'test-api-key'
      VectorServiceFactory.getInstance(apiKey)
      
      // Should not throw when called without API key after initialization
      expect(() => VectorServiceFactory.getInstance()).not.toThrow()
    })
  })

  describe('resetInstance', () => {
    it('should reset the singleton instance', () => {
      const apiKey = 'test-api-key'
      VectorServiceFactory.getInstance(apiKey)
      
      expect(VectorServiceFactory.isInitialized()).toBe(true)
      
      VectorServiceFactory.resetInstance()
      
      expect(VectorServiceFactory.isInitialized()).toBe(false)
    })

    it('should allow creating new instance after reset', () => {
      const apiKey1 = 'test-api-key-1'
      const apiKey2 = 'test-api-key-2'
      
      VectorServiceFactory.getInstance(apiKey1)
      VectorServiceFactory.resetInstance()
      VectorServiceFactory.getInstance(apiKey2)

      expect(SupabaseVectorService).toHaveBeenCalledTimes(2)
      expect(SupabaseVectorService).toHaveBeenNthCalledWith(1, apiKey1)
      expect(SupabaseVectorService).toHaveBeenNthCalledWith(2, apiKey2)
    })
  })

  describe('isInitialized', () => {
    it('should return false when no instance exists', () => {
      expect(VectorServiceFactory.isInitialized()).toBe(false)
    })

    it('should return true when instance exists', () => {
      const apiKey = 'test-api-key'
      VectorServiceFactory.getInstance(apiKey)
      
      expect(VectorServiceFactory.isInitialized()).toBe(true)
    })

    it('should return false after reset', () => {
      const apiKey = 'test-api-key'
      VectorServiceFactory.getInstance(apiKey)
      VectorServiceFactory.resetInstance()
      
      expect(VectorServiceFactory.isInitialized()).toBe(false)
    })
  })
})