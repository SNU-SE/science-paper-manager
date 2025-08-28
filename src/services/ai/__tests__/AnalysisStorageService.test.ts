import { AnalysisStorageService } from '../AnalysisStorageService'
import { AIAnalysisResult } from '@/types'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock fetch
global.fetch = jest.fn()

const mockAnalysisResult: AIAnalysisResult = {
  id: 'test-analysis-1',
  paperId: 'test-paper-1',
  modelProvider: 'openai',
  modelName: 'gpt-4',
  summary: 'Test summary',
  keywords: ['test', 'keywords'],
  scientificRelevance: { score: 0.8 },
  confidenceScore: 0.9,
  tokensUsed: 1000,
  processingTimeMs: 2000,
  createdAt: new Date('2024-01-15T10:00:00Z')
}

const mockAnalysisResult2: AIAnalysisResult = {
  id: 'test-analysis-2',
  paperId: 'test-paper-1',
  modelProvider: 'anthropic',
  modelName: 'claude-3-sonnet',
  summary: 'Test summary 2',
  keywords: ['test2', 'keywords2'],
  scientificRelevance: { score: 0.7 },
  confidenceScore: 0.85,
  tokensUsed: 1200,
  processingTimeMs: 2500,
  createdAt: new Date('2024-01-15T10:05:00Z')
}

describe('AnalysisStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    ;(fetch as jest.Mock).mockClear()
  })

  describe('storeAnalysisResult', () => {
    it('stores analysis result in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      await AnalysisStorageService.storeAnalysisResult(mockAnalysisResult)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai_analysis_results',
        expect.stringContaining('test-paper-1-openai')
      )
    })

    it('handles localStorage errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      // Should not throw - getStoredResults handles the error gracefully
      await expect(AnalysisStorageService.storeAnalysisResult(mockAnalysisResult))
        .resolves.not.toThrow()
      
      // Should still attempt to store in localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('attempts to store in database', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      await AnalysisStorageService.storeAnalysisResult(mockAnalysisResult)

      expect(fetch).toHaveBeenCalledWith('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockAnalysisResult),
      })
    })

    it('continues when database storage fails', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Database error'))

      // Should not throw even if database fails
      await expect(AnalysisStorageService.storeAnalysisResult(mockAnalysisResult))
        .resolves.not.toThrow()

      // Should still store in localStorage
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('storeMultipleResults', () => {
    it('stores multiple results', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      const results = [mockAnalysisResult, mockAnalysisResult2]
      await AnalysisStorageService.storeMultipleResults(results)

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('handles partial failures gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('Database error'))

      const results = [mockAnalysisResult, mockAnalysisResult2]
      
      // Should not throw even if some fail
      await expect(AnalysisStorageService.storeMultipleResults(results))
        .resolves.not.toThrow()
    })
  })

  describe('getAnalysisResults', () => {
    it('retrieves results from localStorage', async () => {
      const now = new Date()
      const storedData = {
        'test-paper-1-openai': {
          ...mockAnalysisResult,
          createdAt: { __type: 'Date', value: now.toISOString() }
        },
        'test-paper-1-anthropic': {
          ...mockAnalysisResult2,
          createdAt: { __type: 'Date', value: now.toISOString() }
        }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const results = await AnalysisStorageService.getAnalysisResults('test-paper-1')

      expect(results.openai).toBeDefined()
      expect(results.anthropic).toBeDefined()
      expect(results.openai?.summary).toBe('Test summary')
    })

    it('handles localStorage parsing errors', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const results = await AnalysisStorageService.getAnalysisResults('test-paper-1')

      expect(results).toEqual({})
    })

    it('fetches from database when available', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          openai: mockAnalysisResult
        })
      })

      const results = await AnalysisStorageService.getAnalysisResults('test-paper-1')

      expect(fetch).toHaveBeenCalledWith('/api/ai-analysis/test-paper-1')
      expect(results.openai).toBeDefined()
    })

    it('handles database fetch errors gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const results = await AnalysisStorageService.getAnalysisResults('test-paper-1')

      expect(results).toEqual({})
    })
  })

  describe('getAnalysisResult', () => {
    it('retrieves specific provider result', async () => {
      const now = new Date()
      const storedData = {
        'test-paper-1-openai': {
          ...mockAnalysisResult,
          createdAt: { __type: 'Date', value: now.toISOString() }
        }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const result = await AnalysisStorageService.getAnalysisResult('test-paper-1', 'openai')

      expect(result).toBeDefined()
      expect(result?.modelProvider).toBe('openai')
    })

    it('returns undefined for non-existent result', async () => {
      localStorageMock.getItem.mockReturnValue('{}')
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const result = await AnalysisStorageService.getAnalysisResult('test-paper-1', 'openai')

      expect(result).toBeUndefined()
    })
  })

  describe('deleteAnalysisResults', () => {
    it('deletes all results for a paper', async () => {
      const storedData = {
        'test-paper-1-openai': mockAnalysisResult,
        'test-paper-1-anthropic': mockAnalysisResult2,
        'test-paper-2-openai': { ...mockAnalysisResult, paperId: 'test-paper-2' }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      await AnalysisStorageService.deleteAnalysisResults('test-paper-1')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai_analysis_results',
        expect.not.stringContaining('test-paper-1')
      )
      expect(fetch).toHaveBeenCalledWith('/api/ai-analysis/test-paper-1', {
        method: 'DELETE'
      })
    })
  })

  describe('deleteAnalysisResult', () => {
    it('deletes specific provider result', async () => {
      const storedData = {
        'test-paper-1-openai': mockAnalysisResult,
        'test-paper-1-anthropic': mockAnalysisResult2
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({ ok: true })

      await AnalysisStorageService.deleteAnalysisResult('test-paper-1', 'openai')

      const setItemCall = localStorageMock.setItem.mock.calls[0]
      const storedValue = JSON.parse(setItemCall[1])
      
      expect(storedValue['test-paper-1-openai']).toBeUndefined()
      expect(storedValue['test-paper-1-anthropic']).toBeDefined()
    })
  })

  describe('hasAnalysis', () => {
    it('returns true for existing non-expired analysis', async () => {
      const recentResult = {
        ...mockAnalysisResult,
        createdAt: new Date() // Recent date
      }
      const storedData = {
        'test-paper-1-openai': {
          ...recentResult,
          createdAt: { __type: 'Date', value: recentResult.createdAt.toISOString() }
        }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const hasAnalysis = await AnalysisStorageService.hasAnalysis('test-paper-1', 'openai')

      expect(hasAnalysis).toBe(true)
    })

    it('returns false for expired analysis', async () => {
      const expiredResult = {
        ...mockAnalysisResult,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      }
      const storedData = {
        'test-paper-1-openai': {
          ...expiredResult,
          createdAt: { __type: 'Date', value: expiredResult.createdAt.toISOString() }
        }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      })

      const hasAnalysis = await AnalysisStorageService.hasAnalysis('test-paper-1', 'openai')

      expect(hasAnalysis).toBe(false)
    })
  })

  describe('getAnalysisStats', () => {
    it('calculates statistics correctly', () => {
      const storedData = {
        'test-paper-1-openai': mockAnalysisResult,
        'test-paper-1-anthropic': mockAnalysisResult2
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))

      const stats = AnalysisStorageService.getAnalysisStats()

      expect(stats.totalAnalyses).toBe(2)
      expect(stats.analysesByProvider.openai).toBe(1)
      expect(stats.analysesByProvider.anthropic).toBe(1)
      expect(stats.totalTokensUsed).toBe(2200) // 1000 + 1200
      expect(stats.averageProcessingTime).toBe(2250) // (2000 + 2500) / 2
    })

    it('handles empty storage', () => {
      localStorageMock.getItem.mockReturnValue('{}')

      const stats = AnalysisStorageService.getAnalysisStats()

      expect(stats.totalAnalyses).toBe(0)
      expect(stats.totalTokensUsed).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
    })
  })

  describe('clearExpiredResults', () => {
    it('removes expired results', () => {
      const recentResult = {
        ...mockAnalysisResult,
        createdAt: { __type: 'Date', value: new Date().toISOString() }
      }
      const expiredResult = {
        ...mockAnalysisResult2,
        createdAt: { __type: 'Date', value: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }
      }
      
      const storedData = {
        'test-paper-1-openai': recentResult,
        'test-paper-1-anthropic': expiredResult
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))

      AnalysisStorageService.clearExpiredResults()

      const setItemCall = localStorageMock.setItem.mock.calls[0]
      const filteredData = JSON.parse(setItemCall[1])
      
      expect(filteredData['test-paper-1-openai']).toBeDefined()
      expect(filteredData['test-paper-1-anthropic']).toBeUndefined()
    })
  })

  describe('clearAllResults', () => {
    it('removes all stored results', () => {
      AnalysisStorageService.clearAllResults()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ai_analysis_results')
    })
  })
})