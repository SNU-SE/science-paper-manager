import { renderHook, act } from '@testing-library/react'
import { usePaperStore } from '../paperStore'
import { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'

// Mock fetch
global.fetch = jest.fn()

const mockPaper: Paper = {
  id: '1',
  title: 'Test Paper',
  authors: ['Author 1', 'Author 2'],
  journal: 'Test Journal',
  publicationYear: 2023,
  doi: '10.1000/test',
  abstract: 'Test abstract',
  readingStatus: 'unread',
  dateAdded: new Date('2023-01-01'),
  lastModified: new Date('2023-01-01')
}

const mockEvaluation: UserEvaluation = {
  id: '1',
  paperId: '1',
  rating: 4,
  notes: 'Great paper',
  tags: ['important', 'research'],
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01')
}

const mockAnalysis: MultiModelAnalysis = {
  openai: {
    id: '1',
    paperId: '1',
    modelProvider: 'openai',
    modelName: 'gpt-4',
    summary: 'AI generated summary',
    keywords: ['keyword1', 'keyword2'],
    confidenceScore: 0.9,
    tokensUsed: 100,
    processingTimeMs: 1000,
    createdAt: new Date('2023-01-01')
  }
}

describe('paperStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state
    usePaperStore.setState({
      papers: new Map(),
      evaluations: new Map(),
      aiAnalyses: new Map(),
      selectedPaper: null,
      isLoading: false,
      error: null
    })
  })

  describe('fetchPapers', () => {
    it('should fetch papers successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockPaper]
      } as Response)

      const { result } = renderHook(() => usePaperStore())

      await act(async () => {
        await result.current.fetchPapers()
      })

      expect(result.current.papers.get('1')).toEqual(mockPaper)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle fetch error', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response)

      const { result } = renderHook(() => usePaperStore())

      await act(async () => {
        await result.current.fetchPapers()
      })

      expect(result.current.papers.size).toBe(0)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Failed to fetch papers')
    })
  })

  describe('addPaper', () => {
    it('should add paper successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaper
      } as Response)

      const { result } = renderHook(() => usePaperStore())

      await act(async () => {
        await result.current.addPaper(mockPaper)
      })

      expect(result.current.papers.get('1')).toEqual(mockPaper)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })
  })

  describe('updatePaper', () => {
    it('should update paper successfully', async () => {
      const updatedPaper = { ...mockPaper, title: 'Updated Title' }
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedPaper
      } as Response)

      const { result } = renderHook(() => usePaperStore())
      
      // Set initial paper
      act(() => {
        result.current.papers.set('1', mockPaper)
      })

      await act(async () => {
        await result.current.updatePaper('1', { title: 'Updated Title' })
      })

      expect(result.current.papers.get('1')?.title).toBe('Updated Title')
    })
  })

  describe('deletePaper', () => {
    it('should delete paper successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true
      } as Response)

      const { result } = renderHook(() => usePaperStore())
      
      // Set initial paper
      act(() => {
        const newPapers = new Map()
        newPapers.set('1', mockPaper)
        usePaperStore.setState({ papers: newPapers })
      })

      await act(async () => {
        await result.current.deletePaper('1')
      })

      expect(result.current.papers.has('1')).toBe(false)
    })
  })

  describe('selectPaper', () => {
    it('should select paper', () => {
      const { result } = renderHook(() => usePaperStore())

      act(() => {
        result.current.selectPaper(mockPaper)
      })

      expect(result.current.selectedPaper).toEqual(mockPaper)
    })
  })

  describe('updateEvaluation', () => {
    it('should update evaluation successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvaluation
      } as Response)

      const { result } = renderHook(() => usePaperStore())

      await act(async () => {
        await result.current.updateEvaluation('1', { rating: 4, notes: 'Great paper' })
      })

      expect(result.current.evaluations.get('1')).toEqual(mockEvaluation)
    })
  })

  describe('getEvaluation', () => {
    it('should get evaluation', () => {
      const { result } = renderHook(() => usePaperStore())
      
      act(() => {
        const newEvaluations = new Map()
        newEvaluations.set('1', mockEvaluation)
        usePaperStore.setState({ evaluations: newEvaluations })
      })

      const evaluation = result.current.getEvaluation('1')
      expect(evaluation).toEqual(mockEvaluation)
    })
  })

  describe('updateAnalysis', () => {
    it('should update analysis successfully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true
      } as Response)

      const { result } = renderHook(() => usePaperStore())

      await act(async () => {
        await result.current.updateAnalysis('1', mockAnalysis)
      })

      expect(result.current.aiAnalyses.get('1')).toEqual(mockAnalysis)
    })
  })

  describe('getAnalysis', () => {
    it('should get analysis', () => {
      const { result } = renderHook(() => usePaperStore())
      
      act(() => {
        const newAnalyses = new Map()
        newAnalyses.set('1', mockAnalysis)
        usePaperStore.setState({ aiAnalyses: newAnalyses })
      })

      const analysis = result.current.getAnalysis('1')
      expect(analysis).toEqual(mockAnalysis)
    })
  })

  describe('utility actions', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => usePaperStore())
      
      act(() => {
        usePaperStore.setState({ error: 'Test error' })
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })

    it('should set loading', () => {
      const { result } = renderHook(() => usePaperStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)
    })
  })
})