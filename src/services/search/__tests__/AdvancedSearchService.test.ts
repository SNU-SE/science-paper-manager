import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  or: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  not: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  cs: jest.fn(() => mockSupabase)
}

// Mock the database module
jest.mock('@/lib/database', () => ({
  getSupabaseClient: () => mockSupabase,
  TABLES: {
    PAPERS: 'papers'
  }
}))

// Import after mocking
import { AdvancedSearchService, type SearchQuery, type SortOption } from '../AdvancedSearchService'

describe('AdvancedSearchService', () => {
  let searchService: AdvancedSearchService
  
  beforeEach(() => {
    searchService = new AdvancedSearchService()
    jest.clearAllMocks()
  })

  describe('searchPapers', () => {
    const mockPapers = [
      {
        id: '1',
        title: 'Machine Learning in Healthcare',
        authors: ['John Doe', 'Jane Smith'],
        journal: 'Nature Medicine',
        publication_year: 2023,
        abstract: 'This paper discusses machine learning applications in healthcare.',
        reading_status: 'unread',
        date_added: '2024-01-01T00:00:00Z',
        last_modified: '2024-01-01T00:00:00Z',
        user_evaluations: [{ rating: 4, tags: ['AI', 'healthcare'] }]
      },
      {
        id: '2',
        title: 'Deep Learning for Medical Imaging',
        authors: ['Alice Johnson'],
        journal: 'Medical Image Analysis',
        publication_year: 2022,
        abstract: 'Deep learning techniques for medical image analysis.',
        reading_status: 'completed',
        date_added: '2024-01-02T00:00:00Z',
        last_modified: '2024-01-02T00:00:00Z',
        user_evaluations: [{ rating: 5, tags: ['deep learning', 'imaging'] }]
      }
    ]

    beforeEach(() => {
      // Mock successful database responses
      mockSupabase.from.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.or.mockReturnValue(mockSupabase)
      mockSupabase.order.mockReturnValue(mockSupabase)
      mockSupabase.range.mockReturnValue(mockSupabase)
      
      // Mock the main query
      mockSupabase.range.mockResolvedValue({
        data: mockPapers,
        error: null
      })
      
      // Mock the count query
      mockSupabase.select.mockResolvedValueOnce({
        count: mockPapers.length,
        error: null
      })
    })

    it('should perform basic text search', async () => {
      const query: SearchQuery = {
        textQuery: 'machine learning',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      const result = await searchService.searchPapers(query)

      expect(result.results).toHaveLength(2)
      expect(result.totalResults).toBe(2)
      expect(result.currentPage).toBe(1)
      expect(result.query).toEqual(query)
    })

    it('should apply publication year filters', async () => {
      const query: SearchQuery = {
        filters: {
          publicationYear: { min: 2023, max: 2023 }
        },
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      await searchService.searchPapers(query)

      expect(mockSupabase.gte).toHaveBeenCalledWith('publication_year', 2023)
      expect(mockSupabase.lte).toHaveBeenCalledWith('publication_year', 2023)
    })

    it('should apply reading status filters', async () => {
      const query: SearchQuery = {
        filters: {
          readingStatus: ['completed', 'reading']
        },
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      await searchService.searchPapers(query)

      expect(mockSupabase.in).toHaveBeenCalledWith('reading_status', ['completed', 'reading'])
    })

    it('should apply journal filters', async () => {
      const query: SearchQuery = {
        filters: {
          journals: ['Nature Medicine', 'Science']
        },
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      await searchService.searchPapers(query)

      expect(mockSupabase.in).toHaveBeenCalledWith('journal', ['Nature Medicine', 'Science'])
    })

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      
      const query: SearchQuery = {
        filters: {
          dateRange: { start: startDate, end: endDate }
        },
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      await searchService.searchPapers(query)

      expect(mockSupabase.gte).toHaveBeenCalledWith('date_added', startDate.toISOString())
      expect(mockSupabase.lte).toHaveBeenCalledWith('date_added', endDate.toISOString())
    })

    it('should apply sorting correctly', async () => {
      const sortOptions: SortOption[] = [
        'date_added_desc',
        'date_added_asc',
        'publication_year_desc',
        'title_asc'
      ]

      for (const sortBy of sortOptions) {
        const query: SearchQuery = {
          filters: {},
          sortBy,
          pagination: { page: 1, limit: 10 }
        }

        await searchService.searchPapers(query)

        expect(mockSupabase.order).toHaveBeenCalled()
      }
    })

    it('should handle pagination correctly', async () => {
      const query: SearchQuery = {
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 2, limit: 5 }
      }

      await searchService.searchPapers(query)

      expect(mockSupabase.range).toHaveBeenCalledWith(5, 9) // offset 5, limit 5
    })

    it('should calculate similarity scores', async () => {
      const query: SearchQuery = {
        textQuery: 'machine learning',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      const result = await searchService.searchPapers(query)

      expect(result.results[0].similarity).toBeGreaterThan(0)
      expect(result.results[0].similarity).toBeLessThanOrEqual(1)
    })

    it('should extract relevant excerpts', async () => {
      const query: SearchQuery = {
        textQuery: 'machine learning',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      const result = await searchService.searchPapers(query)

      expect(result.results[0].relevantExcerpts).toBeDefined()
      expect(Array.isArray(result.results[0].relevantExcerpts)).toBe(true)
    })

    it('should identify matched fields', async () => {
      const query: SearchQuery = {
        textQuery: 'machine learning',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      const result = await searchService.searchPapers(query)

      expect(result.results[0].matchedFields).toBeDefined()
      expect(Array.isArray(result.results[0].matchedFields)).toBe(true)
    })

    it('should handle empty results', async () => {
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null
      })
      
      mockSupabase.select.mockResolvedValueOnce({
        count: 0,
        error: null
      })

      const query: SearchQuery = {
        textQuery: 'nonexistent term',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      const result = await searchService.searchPapers(query)

      expect(result.results).toHaveLength(0)
      expect(result.totalResults).toBe(0)
    })

    it('should handle database errors', async () => {
      mockSupabase.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      })

      const query: SearchQuery = {
        textQuery: 'test',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      }

      await expect(searchService.searchPapers(query)).rejects.toThrow('Search query failed: Database error')
    })
  })

  describe('getSearchSuggestions', () => {
    beforeEach(() => {
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.ilike.mockReturnValue(mockSupabase)
      mockSupabase.not.mockReturnValue(mockSupabase)
      mockSupabase.limit.mockReturnValue(mockSupabase)
    })

    it('should return suggestions for valid query', async () => {
      const mockTitles = [
        { title: 'Machine Learning Basics' },
        { title: 'Advanced Machine Learning' }
      ]
      
      const mockJournals = [
        { journal: 'Machine Learning Journal' }
      ]

      mockSupabase.limit
        .mockResolvedValueOnce({ data: mockTitles, error: null })
        .mockResolvedValueOnce({ data: mockJournals, error: null })

      const suggestions = await searchService.getSearchSuggestions('machine')

      expect(suggestions).toContain('Machine Learning Basics')
      expect(suggestions).toContain('Advanced Machine Learning')
      expect(suggestions).toContain('Machine Learning Journal')
    })

    it('should return empty array for short queries', async () => {
      const suggestions = await searchService.getSearchSuggestions('a')
      expect(suggestions).toEqual([])
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.limit.mockRejectedValue(new Error('Database error'))

      const suggestions = await searchService.getSearchSuggestions('test')
      expect(suggestions).toEqual([])
    })
  })

  describe('getFilterOptions', () => {
    beforeEach(() => {
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.not.mockReturnValue(mockSupabase)
      mockSupabase.order.mockReturnValue(mockSupabase)
    })

    it('should return filter options', async () => {
      const mockJournals = [{ journal: 'Nature' }, { journal: 'Science' }]
      const mockAuthors = [{ authors: ['John Doe', 'Jane Smith'] }]
      const mockTags = [{ tags: ['AI', 'ML'] }]
      const mockYears = [{ publication_year: 2022 }, { publication_year: 2023 }]

      mockSupabase.order
        .mockResolvedValueOnce({ data: mockJournals, error: null })
        .mockResolvedValueOnce({ data: mockAuthors, error: null })
        .mockResolvedValueOnce({ data: mockTags, error: null })
        .mockResolvedValueOnce({ data: mockYears, error: null })

      const options = await searchService.getFilterOptions()

      expect(options.journals).toContain('Nature')
      expect(options.journals).toContain('Science')
      expect(options.authors).toContain('John Doe')
      expect(options.authors).toContain('Jane Smith')
      expect(options.tags).toContain('AI')
      expect(options.tags).toContain('ML')
      expect(options.yearRange.min).toBe(2022)
      expect(options.yearRange.max).toBe(2023)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.order.mockRejectedValue(new Error('Database error'))

      const options = await searchService.getFilterOptions()

      expect(options.journals).toEqual([])
      expect(options.authors).toEqual([])
      expect(options.tags).toEqual([])
      expect(options.yearRange.min).toBe(1900)
      expect(options.yearRange.max).toBe(new Date().getFullYear())
    })
  })
})