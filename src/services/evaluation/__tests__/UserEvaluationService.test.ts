import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { UserEvaluationService } from '../UserEvaluationService'
import { UserEvaluation } from '@/types'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn()
}

// Fix the chaining for delete
mockSupabase.delete.mockImplementation(() => ({
  eq: jest.fn().mockResolvedValue({ error: null })
}))

// Fix the chaining for select with in
mockSupabase.select.mockImplementation(() => ({
  in: jest.fn().mockResolvedValue({ data: [], error: null }),
  not: jest.fn().mockResolvedValue({ data: [], error: null }),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn()
}))

// Fix the chaining for upsert
mockSupabase.upsert.mockImplementation(() => ({
  select: jest.fn().mockReturnThis(),
  single: jest.fn()
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}))

describe('UserEvaluationService', () => {
  let service: UserEvaluationService

  beforeEach(() => {
    service = new UserEvaluationService('test-url', 'test-key')
    jest.clearAllMocks()
  })

  describe('getEvaluation', () => {
    it('returns evaluation when found', async () => {
      const mockData = {
        id: '1',
        paper_id: 'paper-1',
        rating: 4,
        notes: 'Great paper',
        tags: ['ai', 'ml'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null })

      const result = await service.getEvaluation('paper-1')

      expect(result).toEqual({
        id: '1',
        paperId: 'paper-1',
        rating: 4,
        notes: 'Great paper',
        tags: ['ai', 'ml'],
        highlights: undefined,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('user_evaluations')
      expect(mockSupabase.eq).toHaveBeenCalledWith('paper_id', 'paper-1')
    })

    it('returns null when evaluation not found', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      })

      const result = await service.getEvaluation('paper-1')
      expect(result).toBeNull()
    })

    it('throws error on database error', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'OTHER_ERROR', message: 'Database error' } 
      })

      await expect(service.getEvaluation('paper-1')).rejects.toThrow('Failed to fetch user evaluation')
    })
  })

  describe('saveEvaluation', () => {
    it('saves evaluation successfully', async () => {
      const evaluation: Partial<UserEvaluation> = {
        paperId: 'paper-1',
        rating: 5,
        notes: 'Excellent paper',
        tags: ['research']
      }

      const mockSavedData = {
        id: '1',
        paper_id: 'paper-1',
        rating: 5,
        notes: 'Excellent paper',
        tags: ['research'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.single.mockResolvedValue({ data: mockSavedData, error: null })

      const result = await service.saveEvaluation(evaluation)

      expect(result.paperId).toBe('paper-1')
      expect(result.rating).toBe(5)
      expect(mockSupabase.upsert).toHaveBeenCalled()
    })

    it('throws error on save failure', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Save failed' } 
      })

      const evaluation: Partial<UserEvaluation> = {
        paperId: 'paper-1',
        rating: 5
      }

      await expect(service.saveEvaluation(evaluation)).rejects.toThrow('Failed to save user evaluation')
    })
  })

  describe('deleteEvaluation', () => {
    it('deletes evaluation successfully', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null })

      await service.deleteEvaluation('paper-1')

      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('paper_id', 'paper-1')
    })

    it('throws error on delete failure', async () => {
      mockSupabase.delete.mockResolvedValue({ error: { message: 'Delete failed' } })

      await expect(service.deleteEvaluation('paper-1')).rejects.toThrow('Failed to delete user evaluation')
    })
  })

  describe('getEvaluationsByPaperIds', () => {
    it('returns evaluations map', async () => {
      const mockData = [
        {
          id: '1',
          paper_id: 'paper-1',
          rating: 4,
          tags: ['ai'],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          paper_id: 'paper-2',
          rating: 5,
          tags: ['ml'],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockData, error: null })

      const result = await service.getEvaluationsByPaperIds(['paper-1', 'paper-2'])

      expect(result.size).toBe(2)
      expect(result.get('paper-1')?.rating).toBe(4)
      expect(result.get('paper-2')?.rating).toBe(5)
      expect(mockSupabase.in).toHaveBeenCalledWith('paper_id', ['paper-1', 'paper-2'])
    })
  })

  describe('getAllTags', () => {
    it('returns unique sorted tags', async () => {
      const mockData = [
        { tags: ['ai', 'machine-learning'] },
        { tags: ['ai', 'deep-learning'] },
        { tags: ['research'] }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockData, error: null })

      const result = await service.getAllTags()

      expect(result).toEqual(['ai', 'deep-learning', 'machine-learning', 'research'])
      expect(mockSupabase.not).toHaveBeenCalledWith('tags', 'is', null)
    })

    it('handles empty tags', async () => {
      const mockData = [
        { tags: ['ai', ''] },
        { tags: null },
        { tags: ['  ', 'ml'] }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockData, error: null })

      const result = await service.getAllTags()

      expect(result).toEqual(['ai', 'ml'])
    })
  })

  describe('getEvaluationStats', () => {
    it('calculates statistics correctly', async () => {
      const mockData = [
        { rating: 5, tags: ['ai', 'ml'] },
        { rating: 4, tags: ['ai'] },
        { rating: 3, tags: ['research'] },
        { rating: null, tags: ['unrated'] }
      ]

      mockSupabase.select.mockResolvedValue({ data: mockData, error: null })

      const result = await service.getEvaluationStats()

      expect(result.totalEvaluations).toBe(4)
      expect(result.averageRating).toBe(4) // (5+4+3)/3
      expect(result.ratingDistribution).toEqual({ 3: 1, 4: 1, 5: 1 })
      expect(result.topTags).toEqual([
        { tag: 'ai', count: 2 },
        { tag: 'ml', count: 1 },
        { tag: 'research', count: 1 },
        { tag: 'unrated', count: 1 }
      ])
    })

    it('handles empty data', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null })

      const result = await service.getEvaluationStats()

      expect(result.totalEvaluations).toBe(0)
      expect(result.averageRating).toBe(0)
      expect(result.ratingDistribution).toEqual({})
      expect(result.topTags).toEqual([])
    })
  })
})