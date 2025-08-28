import { renderHook, act, waitFor } from '@testing-library/react'
import { useUserEvaluation, useTagSuggestions } from '../useUserEvaluation'
import { UserEvaluation } from '@/types'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the service
const mockService = {
  getEvaluation: jest.fn(),
  saveEvaluation: jest.fn(),
  deleteEvaluation: jest.fn(),
  getAllTags: jest.fn()
}

jest.mock('@/services/evaluation/UserEvaluationService', () => ({
  UserEvaluationService: jest.fn(() => mockService)
}))

describe('useUserEvaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads evaluation on mount when autoLoad is true', async () => {
    const mockEvaluation: UserEvaluation = {
      id: '1',
      paperId: 'paper-1',
      rating: 4,
      notes: 'Great paper',
      tags: ['ai'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockService.getEvaluation.mockResolvedValue(mockEvaluation)

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1', autoLoad: true })
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.evaluation).toEqual(mockEvaluation)
    expect(result.current.error).toBeNull()
    expect(mockService.getEvaluation).toHaveBeenCalledWith('paper-1')
  })

  it('does not load evaluation when autoLoad is false', () => {
    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1', autoLoad: false })
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.evaluation).toBeNull()
    expect(mockService.getEvaluation).not.toHaveBeenCalled()
  })

  it('handles loading error', async () => {
    mockService.getEvaluation.mockRejectedValue(new Error('Load failed'))

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1' })
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Load failed')
    })

    expect(result.current.evaluation).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('saves evaluation successfully', async () => {
    const mockSavedEvaluation: UserEvaluation = {
      id: '1',
      paperId: 'paper-1',
      rating: 5,
      notes: 'Updated notes',
      tags: ['ai', 'ml'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockService.getEvaluation.mockResolvedValue(null)
    mockService.saveEvaluation.mockResolvedValue(mockSavedEvaluation)

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1' })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.saveEvaluation({
        rating: 5,
        notes: 'Updated notes',
        tags: ['ai', 'ml']
      })
    })

    expect(result.current.evaluation).toEqual(mockSavedEvaluation)
    expect(mockService.saveEvaluation).toHaveBeenCalledWith({
      rating: 5,
      notes: 'Updated notes',
      tags: ['ai', 'ml'],
      paperId: 'paper-1'
    })
  })

  it('handles save error', async () => {
    mockService.getEvaluation.mockResolvedValue(null)
    mockService.saveEvaluation.mockRejectedValue(new Error('Save failed'))

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1' })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await expect(
      act(async () => {
        await result.current.saveEvaluation({ rating: 5 })
      })
    ).rejects.toThrow('Save failed')

    expect(result.current.error).toBe('Save failed')
  })

  it('deletes evaluation successfully', async () => {
    const mockEvaluation: UserEvaluation = {
      id: '1',
      paperId: 'paper-1',
      rating: 4,
      notes: 'Great paper',
      tags: ['ai'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockService.getEvaluation.mockResolvedValue(mockEvaluation)
    mockService.deleteEvaluation.mockResolvedValue(undefined)

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1' })
    )

    await waitFor(() => {
      expect(result.current.evaluation).toEqual(mockEvaluation)
    })

    await act(async () => {
      await result.current.deleteEvaluation()
    })

    expect(result.current.evaluation).toBeNull()
    expect(mockService.deleteEvaluation).toHaveBeenCalledWith('paper-1')
  })

  it('reloads evaluation', async () => {
    const mockEvaluation: UserEvaluation = {
      id: '1',
      paperId: 'paper-1',
      rating: 4,
      notes: 'Great paper',
      tags: ['ai'],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockService.getEvaluation.mockResolvedValue(mockEvaluation)

    const { result } = renderHook(() => 
      useUserEvaluation({ paperId: 'paper-1', autoLoad: false })
    )

    expect(result.current.evaluation).toBeNull()

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.evaluation).toEqual(mockEvaluation)
    expect(mockService.getEvaluation).toHaveBeenCalledWith('paper-1')
  })
})

describe('useTagSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads tags on mount', async () => {
    const mockTags = ['ai', 'machine-learning', 'deep-learning']
    mockService.getAllTags.mockResolvedValue(mockTags)

    const { result } = renderHook(() => useTagSuggestions())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.tags).toEqual(mockTags)
    expect(result.current.error).toBeNull()
    expect(mockService.getAllTags).toHaveBeenCalled()
  })

  it('handles loading error', async () => {
    mockService.getAllTags.mockRejectedValue(new Error('Failed to load tags'))

    const { result } = renderHook(() => useTagSuggestions())

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load tags')
    })

    expect(result.current.tags).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('reloads tags', async () => {
    const mockTags = ['ai', 'ml']
    mockService.getAllTags.mockResolvedValue(mockTags)

    const { result } = renderHook(() => useTagSuggestions())

    await waitFor(() => {
      expect(result.current.tags).toEqual(mockTags)
    })

    const newTags = ['ai', 'ml', 'nlp']
    mockService.getAllTags.mockResolvedValue(newTags)

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.tags).toEqual(newTags)
    expect(mockService.getAllTags).toHaveBeenCalledTimes(2)
  })
})