import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { POST, GET } from '../route'

// Mock the AdvancedSearchService
const mockSearchService = {
  searchPapers: jest.fn(),
  getSearchSuggestions: jest.fn(),
  getFilterOptions: jest.fn()
}

jest.mock('@/services/search/AdvancedSearchService', () => ({
  AdvancedSearchService: jest.fn(() => mockSearchService)
}))

describe('/api/search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should perform search with query and filters', async () => {
      const mockSearchResponse = {
        results: [
          {
            id: '1',
            paper: {
              id: '1',
              title: 'Test Paper',
              authors: ['John Doe'],
              readingStatus: 'unread',
              dateAdded: new Date(),
              lastModified: new Date()
            },
            similarity: 0.8,
            relevantExcerpts: ['Test excerpt'],
            matchedFields: ['title']
          }
        ],
        totalResults: 1,
        totalPages: 1,
        currentPage: 1,
        query: {
          textQuery: 'test',
          filters: {},
          sortBy: 'relevance',
          pagination: { page: 1, limit: 10 }
        }
      }

      mockSearchService.searchPapers.mockResolvedValue(mockSearchResponse)

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          filters: {},
          sortBy: 'relevance',
          page: 1,
          limit: 10
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSearchResponse)
      expect(mockSearchService.searchPapers).toHaveBeenCalledWith({
        textQuery: 'test',
        filters: {},
        sortBy: 'relevance',
        pagination: { page: 1, limit: 10 }
      })
    })

    it('should handle search without query', async () => {
      const mockSearchResponse = {
        results: [],
        totalResults: 0,
        totalPages: 0,
        currentPage: 1,
        query: {
          filters: { readingStatus: ['unread'] },
          sortBy: 'date_added_desc',
          pagination: { page: 1, limit: 10 }
        }
      }

      mockSearchService.searchPapers.mockResolvedValue(mockSearchResponse)

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({
          filters: { readingStatus: ['unread'] },
          sortBy: 'date_added_desc'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should validate invalid query type', async () => {
      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 123, // Invalid type
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Search query must be a string')
    })

    it('should handle search service errors', async () => {
      mockSearchService.searchPapers.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform search')
      expect(data.details).toBe('Database error')
    })
  })

  describe('GET', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = ['Machine Learning', 'Deep Learning', 'Neural Networks']
      mockSearchService.getSearchSuggestions.mockResolvedValue(mockSuggestions)

      const request = new NextRequest('http://localhost:3000/api/search?action=suggestions&q=machine')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSuggestions)
      expect(mockSearchService.getSearchSuggestions).toHaveBeenCalledWith('machine')
    })

    it('should return empty suggestions for short query', async () => {
      const request = new NextRequest('http://localhost:3000/api/search?action=suggestions&q=a')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
      expect(mockSearchService.getSearchSuggestions).not.toHaveBeenCalled()
    })

    it('should return filter options', async () => {
      const mockFilterOptions = {
        journals: ['Nature', 'Science'],
        authors: ['John Doe', 'Jane Smith'],
        tags: ['AI', 'ML'],
        yearRange: { min: 2020, max: 2024 }
      }
      mockSearchService.getFilterOptions.mockResolvedValue(mockFilterOptions)

      const request = new NextRequest('http://localhost:3000/api/search?action=filter-options')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockFilterOptions)
      expect(mockSearchService.getFilterOptions).toHaveBeenCalled()
    })

    it('should handle invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/search?action=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid action parameter')
    })

    it('should handle service errors', async () => {
      mockSearchService.getSearchSuggestions.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/search?action=suggestions&q=test')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process request')
      expect(data.details).toBe('Service error')
    })
  })
})