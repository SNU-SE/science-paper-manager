"use client"

import { useState, useEffect, useCallback } from 'react'
import { UserEvaluation } from '@/types'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'

interface UseUserEvaluationOptions {
  paperId: string
  autoLoad?: boolean
}

interface UseUserEvaluationReturn {
  evaluation: UserEvaluation | null
  isLoading: boolean
  error: string | null
  saveEvaluation: (evaluation: Partial<UserEvaluation>) => Promise<void>
  deleteEvaluation: () => Promise<void>
  reload: () => Promise<void>
}

export function useUserEvaluation({ 
  paperId, 
  autoLoad = true 
}: UseUserEvaluationOptions): UseUserEvaluationReturn {
  const [evaluation, setEvaluation] = useState<UserEvaluation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize service
  const service = new UserEvaluationService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadEvaluation = useCallback(async () => {
    if (!paperId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await service.getEvaluation(paperId)
      setEvaluation(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evaluation'
      setError(errorMessage)
      console.error('Error loading evaluation:', err)
    } finally {
      setIsLoading(false)
    }
  }, [paperId, service])

  const saveEvaluation = useCallback(async (evaluationData: Partial<UserEvaluation>) => {
    setError(null)

    try {
      const savedEvaluation = await service.saveEvaluation({
        ...evaluationData,
        paperId
      })
      setEvaluation(savedEvaluation)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save evaluation'
      setError(errorMessage)
      throw err
    }
  }, [paperId, service])

  const deleteEvaluation = useCallback(async () => {
    setError(null)

    try {
      await service.deleteEvaluation(paperId)
      setEvaluation(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete evaluation'
      setError(errorMessage)
      throw err
    }
  }, [paperId, service])

  const reload = useCallback(async () => {
    await loadEvaluation()
  }, [loadEvaluation])

  // Auto-load evaluation on mount
  useEffect(() => {
    if (autoLoad && paperId) {
      loadEvaluation()
    }
  }, [autoLoad, paperId, loadEvaluation])

  return {
    evaluation,
    isLoading,
    error,
    saveEvaluation,
    deleteEvaluation,
    reload
  }
}

// Hook for managing multiple evaluations
interface UseUserEvaluationsOptions {
  paperIds: string[]
  autoLoad?: boolean
}

interface UseUserEvaluationsReturn {
  evaluations: Map<string, UserEvaluation>
  isLoading: boolean
  error: string | null
  getEvaluation: (paperId: string) => UserEvaluation | undefined
  saveEvaluation: (evaluation: Partial<UserEvaluation>) => Promise<void>
  deleteEvaluation: (paperId: string) => Promise<void>
  reload: () => Promise<void>
}

export function useUserEvaluations({ 
  paperIds, 
  autoLoad = true 
}: UseUserEvaluationsOptions): UseUserEvaluationsReturn {
  const [evaluations, setEvaluations] = useState<Map<string, UserEvaluation>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize service
  const service = new UserEvaluationService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadEvaluations = useCallback(async () => {
    if (!paperIds.length) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await service.getEvaluationsByPaperIds(paperIds)
      setEvaluations(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evaluations'
      setError(errorMessage)
      console.error('Error loading evaluations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [paperIds, service])

  const getEvaluation = useCallback((paperId: string) => {
    return evaluations.get(paperId)
  }, [evaluations])

  const saveEvaluation = useCallback(async (evaluationData: Partial<UserEvaluation>) => {
    if (!evaluationData.paperId) {
      throw new Error('Paper ID is required')
    }

    setError(null)

    try {
      const savedEvaluation = await service.saveEvaluation(evaluationData)
      setEvaluations(prev => new Map(prev).set(savedEvaluation.paperId, savedEvaluation))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save evaluation'
      setError(errorMessage)
      throw err
    }
  }, [service])

  const deleteEvaluation = useCallback(async (paperId: string) => {
    setError(null)

    try {
      await service.deleteEvaluation(paperId)
      setEvaluations(prev => {
        const newMap = new Map(prev)
        newMap.delete(paperId)
        return newMap
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete evaluation'
      setError(errorMessage)
      throw err
    }
  }, [service])

  const reload = useCallback(async () => {
    await loadEvaluations()
  }, [loadEvaluations])

  // Auto-load evaluations on mount
  useEffect(() => {
    if (autoLoad && paperIds.length > 0) {
      loadEvaluations()
    }
  }, [autoLoad, paperIds, loadEvaluations])

  return {
    evaluations,
    isLoading,
    error,
    getEvaluation,
    saveEvaluation,
    deleteEvaluation,
    reload
  }
}

// Hook for tag suggestions
interface UseTagSuggestionsReturn {
  tags: string[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useTagSuggestions(): UseTagSuggestionsReturn {
  const [tags, setTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize service
  const service = new UserEvaluationService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadTags = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.getAllTags()
      setTags(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tags'
      setError(errorMessage)
      console.error('Error loading tags:', err)
    } finally {
      setIsLoading(false)
    }
  }, [service])

  const reload = useCallback(async () => {
    await loadTags()
  }, [loadTags])

  // Auto-load tags on mount
  useEffect(() => {
    loadTags()
  }, [loadTags])

  return {
    tags,
    isLoading,
    error,
    reload
  }
}