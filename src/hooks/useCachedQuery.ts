import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, invalidateCache } from '@/utils/cache'
import { PerformanceMonitor } from '@/utils/performance'

// Custom hook for cached paper queries
export function usePapers() {
  const monitor = PerformanceMonitor.getInstance()
  
  return useQuery({
    queryKey: queryKeys.papers,
    queryFn: async () => {
      return monitor.measureApiCall('papers', async () => {
        const response = await fetch('/api/papers')
        if (!response.ok) {
          throw new Error('Failed to fetch papers')
        }
        return response.json()
      })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Custom hook for cached paper detail
export function usePaper(paperId: string) {
  const monitor = PerformanceMonitor.getInstance()
  
  return useQuery({
    queryKey: queryKeys.paper(paperId),
    queryFn: async () => {
      return monitor.measureApiCall(`paper_${paperId}`, async () => {
        const response = await fetch(`/api/papers/${paperId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch paper')
        }
        return response.json()
      })
    },
    enabled: !!paperId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Custom hook for cached AI analyses
export function useAIAnalyses(paperId: string) {
  const monitor = PerformanceMonitor.getInstance()
  
  return useQuery({
    queryKey: queryKeys.aiAnalyses(paperId),
    queryFn: async () => {
      return monitor.measureApiCall(`ai_analyses_${paperId}`, async () => {
        const response = await fetch(`/api/ai-analysis/${paperId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch AI analyses')
        }
        return response.json()
      })
    },
    enabled: !!paperId,
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
  })
}

// Custom hook for cached search results
export function useSearchResults(query: string) {
  const monitor = PerformanceMonitor.getInstance()
  
  return useQuery({
    queryKey: queryKeys.searchResults(query),
    queryFn: async () => {
      return monitor.measureApiCall(`search_${query}`, async () => {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })
        if (!response.ok) {
          throw new Error('Failed to search papers')
        }
        return response.json()
      })
    },
    enabled: !!query && query.length > 2,
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Custom hook for cached dashboard stats
export function useDashboardStats() {
  const monitor = PerformanceMonitor.getInstance()
  
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      return monitor.measureApiCall('dashboard_stats', async () => {
        const response = await fetch('/api/dashboard/stats')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats')
        }
        return response.json()
      })
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Mutation hooks with cache invalidation
export function useCreatePaper() {
  const queryClient = useQueryClient()
  const monitor = PerformanceMonitor.getInstance()
  
  return useMutation({
    mutationFn: async (paperData: any) => {
      return monitor.measureApiCall('create_paper', async () => {
        const response = await fetch('/api/papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paperData)
        })
        if (!response.ok) {
          throw new Error('Failed to create paper')
        }
        return response.json()
      })
    },
    onSuccess: () => {
      // Invalidate papers list
      queryClient.invalidateQueries({ queryKey: queryKeys.papers })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats })
      invalidateCache.papers()
    }
  })
}

export function useUpdatePaper() {
  const queryClient = useQueryClient()
  const monitor = PerformanceMonitor.getInstance()
  
  return useMutation({
    mutationFn: async ({ paperId, updates }: { paperId: string, updates: any }) => {
      return monitor.measureApiCall('update_paper', async () => {
        const response = await fetch(`/api/papers/${paperId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        })
        if (!response.ok) {
          throw new Error('Failed to update paper')
        }
        return response.json()
      })
    },
    onSuccess: (_, { paperId }) => {
      // Invalidate specific paper and papers list
      queryClient.invalidateQueries({ queryKey: queryKeys.paper(paperId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.papers })
      invalidateCache.paper(paperId)
    }
  })
}

export function useDeletePaper() {
  const queryClient = useQueryClient()
  const monitor = PerformanceMonitor.getInstance()
  
  return useMutation({
    mutationFn: async (paperId: string) => {
      return monitor.measureApiCall('delete_paper', async () => {
        const response = await fetch(`/api/papers/${paperId}`, {
          method: 'DELETE'
        })
        if (!response.ok) {
          throw new Error('Failed to delete paper')
        }
        return response.json()
      })
    },
    onSuccess: (_, paperId) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.paper(paperId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.papers })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats })
      invalidateCache.paper(paperId)
    }
  })
}

export function useCreateAIAnalysis() {
  const queryClient = useQueryClient()
  const monitor = PerformanceMonitor.getInstance()
  
  return useMutation({
    mutationFn: async ({ paperId, provider }: { paperId: string, provider: string }) => {
      return monitor.measureApiCall('create_ai_analysis', async () => {
        const response = await fetch(`/api/ai-analysis/${paperId}/${provider}`, {
          method: 'POST'
        })
        if (!response.ok) {
          throw new Error('Failed to create AI analysis')
        }
        return response.json()
      })
    },
    onSuccess: (_, { paperId }) => {
      // Invalidate AI analyses for this paper
      queryClient.invalidateQueries({ queryKey: queryKeys.aiAnalyses(paperId) })
      invalidateCache.aiAnalysis(paperId)
    }
  })
}

// Prefetch utilities
export function usePrefetch() {
  const queryClient = useQueryClient()
  
  return {
    prefetchPaper: (paperId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.paper(paperId),
        queryFn: async () => {
          const response = await fetch(`/api/papers/${paperId}`)
          if (!response.ok) throw new Error('Failed to fetch paper')
          return response.json()
        },
        staleTime: 10 * 60 * 1000
      })
    },
    
    prefetchAIAnalyses: (paperId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.aiAnalyses(paperId),
        queryFn: async () => {
          const response = await fetch(`/api/ai-analysis/${paperId}`)
          if (!response.ok) throw new Error('Failed to fetch AI analyses')
          return response.json()
        },
        staleTime: 60 * 60 * 1000
      })
    }
  }
}