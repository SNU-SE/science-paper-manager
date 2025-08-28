'use client'

import { useState, useEffect } from 'react'
import { Paper, UserEvaluation, AIAnalysisResult, UsageStats, AIModel } from '@/types'

interface SyncService {
  name: string
  status: 'synced' | 'syncing' | 'error' | 'never'
  lastSync?: Date
  nextSync?: Date
  itemCount?: number
  errorMessage?: string
  progress?: number
}

interface DashboardData {
  papers: Paper[]
  evaluations: UserEvaluation[]
  aiAnalyses: AIAnalysisResult[]
  apiKeys: Record<string, string>
  activeModels: Set<string>
  usageStats: Record<string, UsageStats>
  syncServices: SyncService[]
  isLoading: boolean
  error: string | null
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData>({
    papers: [],
    evaluations: [],
    aiAnalyses: [],
    apiKeys: {},
    activeModels: new Set(),
    usageStats: {},
    syncServices: [],
    isLoading: true,
    error: null
  })

  const loadDashboardData = async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }))

      // Load papers
      const papersResponse = await fetch('/api/papers')
      const papers = papersResponse.ok ? await papersResponse.json() : []

      // Load evaluations
      const evaluationsResponse = await fetch('/api/evaluations')
      const evaluations = evaluationsResponse.ok ? await evaluationsResponse.json() : []

      // Load AI analyses
      const analysesResponse = await fetch('/api/ai-analysis')
      const aiAnalyses = analysesResponse.ok ? await analysesResponse.json() : []

      // Load API keys from localStorage
      const apiKeys = {
        openai: localStorage.getItem('openai_api_key') || '',
        anthropic: localStorage.getItem('anthropic_api_key') || '',
        xai: localStorage.getItem('xai_api_key') || '',
        gemini: localStorage.getItem('gemini_api_key') || ''
      }

      // Load active models from localStorage
      const activeModelsStr = localStorage.getItem('active_ai_models')
      const activeModels = new Set(activeModelsStr ? JSON.parse(activeModelsStr) : [])

      // Load usage stats from localStorage
      const usageStatsStr = localStorage.getItem('ai_usage_stats')
      const usageStats = usageStatsStr ? JSON.parse(usageStatsStr) : {}

      // Mock sync services data (in real app, this would come from API)
      const syncServices: SyncService[] = [
        {
          name: 'Zotero',
          status: 'synced',
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          nextSync: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
          itemCount: papers.length
        },
        {
          name: 'Google Drive',
          status: 'synced',
          lastSync: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          itemCount: papers.filter(p => p.googleDriveId).length
        },
        {
          name: 'Vector Database',
          status: papers.length > 0 ? 'synced' : 'never',
          lastSync: papers.length > 0 ? new Date(Date.now() - 10 * 60 * 1000) : undefined, // 10 minutes ago
          itemCount: papers.length
        }
      ]

      setData({
        papers,
        evaluations,
        aiAnalyses,
        apiKeys,
        activeModels,
        usageStats,
        syncServices,
        isLoading: false,
        error: null
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load dashboard data'
      }))
    }
  }

  const handleSyncService = async (serviceName: string) => {
    setData(prev => ({
      ...prev,
      syncServices: prev.syncServices.map(service =>
        service.name === serviceName
          ? { ...service, status: 'syncing', progress: 0 }
          : service
      )
    }))

    // Simulate sync process
    const progressInterval = setInterval(() => {
      setData(prev => ({
        ...prev,
        syncServices: prev.syncServices.map(service =>
          service.name === serviceName && service.progress !== undefined
            ? { ...service, progress: Math.min((service.progress || 0) + 20, 100) }
            : service
        )
      }))
    }, 500)

    // Complete sync after 3 seconds
    setTimeout(() => {
      clearInterval(progressInterval)
      setData(prev => ({
        ...prev,
        syncServices: prev.syncServices.map(service =>
          service.name === serviceName
            ? {
                ...service,
                status: 'synced',
                lastSync: new Date(),
                progress: undefined
              }
            : service
        )
      }))
    }, 3000)
  }

  const refreshData = () => {
    loadDashboardData()
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  return {
    ...data,
    handleSyncService,
    refreshData
  }
}