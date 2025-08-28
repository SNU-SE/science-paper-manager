'use client'

import { useState, useEffect, useCallback } from 'react'
import { AIProvider, AIServiceFactory } from '@/services/ai/AIServiceFactory'
import { MultiModelAnalyzer } from '@/services/ai/MultiModelAnalyzer'
import { AnalysisStorageService } from '@/services/ai/AnalysisStorageService'
import { AIAnalysisResult, MultiModelAnalysis, Paper } from '@/types'

export interface UseAIAnalysisOptions {
  paperId?: string
  autoLoad?: boolean
}

export interface UseAIAnalysisReturn {
  // State
  analyses: MultiModelAnalysis
  isAnalyzing: boolean
  selectedModels: AIProvider[]
  apiKeys: Record<string, string>
  analysisProgress: Record<AIProvider, 'idle' | 'analyzing' | 'completed' | 'error'>
  error: string | null

  // Actions
  setSelectedModels: (models: AIProvider[]) => void
  updateApiKey: (provider: AIProvider, key: string) => void
  validateApiKey: (provider: AIProvider, key: string) => Promise<boolean>
  startAnalysis: (paper: Paper, providers?: AIProvider[]) => Promise<void>
  reanalyzeWithProvider: (paper: Paper, provider: AIProvider) => Promise<void>
  loadAnalysis: (paperId: string) => Promise<void>
  clearAnalysis: (paperId: string) => Promise<void>
  
  // Utilities
  hasValidApiKey: (provider: AIProvider) => boolean
  getAnalysisStats: () => ReturnType<typeof AnalysisStorageService.getAnalysisStats>
}

export function useAIAnalysis(options: UseAIAnalysisOptions = {}): UseAIAnalysisReturn {
  const { paperId, autoLoad = true } = options

  // State
  const [analyses, setAnalyses] = useState<MultiModelAnalysis>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedModels, setSelectedModels] = useState<AIProvider[]>([])
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [analysisProgress, setAnalysisProgress] = useState<Record<AIProvider, 'idle' | 'analyzing' | 'completed' | 'error'>>({
    openai: 'idle',
    anthropic: 'idle',
    xai: 'idle',
    gemini: 'idle'
  })
  const [error, setError] = useState<string | null>(null)

  // Load API keys from localStorage on mount
  useEffect(() => {
    const loadApiKeys = () => {
      try {
        const stored = localStorage.getItem('ai_api_keys')
        if (stored) {
          const keys = JSON.parse(stored)
          setApiKeys(keys)
          
          // Auto-select models with valid API keys
          const validProviders = Object.entries(keys)
            .filter(([, key]) => Boolean(key))
            .map(([provider]) => provider as AIProvider)
          
          setSelectedModels(validProviders)
        }
      } catch (error) {
        console.error('Failed to load API keys:', error)
      }
    }

    loadApiKeys()
  }, [])

  // Auto-load analysis if paperId is provided
  useEffect(() => {
    if (paperId && autoLoad) {
      loadAnalysis(paperId)
    }
  }, [paperId, autoLoad])

  // Save API keys to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('ai_api_keys', JSON.stringify(apiKeys))
    } catch (error) {
      console.error('Failed to save API keys:', error)
    }
  }, [apiKeys])

  const updateApiKey = useCallback((provider: AIProvider, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }))
    
    // Auto-add to selected models if key is valid and not already selected
    if (key && !selectedModels.includes(provider)) {
      setSelectedModels(prev => [...prev, provider])
    }
  }, [selectedModels])

  const validateApiKey = useCallback(async (provider: AIProvider, key: string): Promise<boolean> => {
    try {
      setError(null)
      return await AIServiceFactory.validateApiKey(provider, key)
    } catch (error) {
      console.error(`API key validation failed for ${provider}:`, error)
      setError(`Failed to validate ${provider} API key`)
      return false
    }
  }, [])

  const hasValidApiKey = useCallback((provider: AIProvider): boolean => {
    return Boolean(apiKeys[provider])
  }, [apiKeys])

  const loadAnalysis = useCallback(async (targetPaperId: string) => {
    try {
      setError(null)
      const results = await AnalysisStorageService.getAnalysisResults(targetPaperId)
      setAnalyses(results)
      
      // Update progress based on loaded results
      const newProgress = { ...analysisProgress }
      Object.keys(newProgress).forEach(provider => {
        newProgress[provider as AIProvider] = results[provider as AIProvider] ? 'completed' : 'idle'
      })
      setAnalysisProgress(newProgress)
    } catch (error) {
      console.error('Failed to load analysis:', error)
      setError('Failed to load analysis results')
    }
  }, [analysisProgress])

  const startAnalysis = useCallback(async (paper: Paper, providers?: AIProvider[]) => {
    const targetProviders = providers || selectedModels
    
    if (targetProviders.length === 0) {
      setError('No AI models selected for analysis')
      return
    }

    // Validate that all selected providers have API keys
    const missingKeys = targetProviders.filter(provider => !hasValidApiKey(provider))
    if (missingKeys.length > 0) {
      setError(`Missing API keys for: ${missingKeys.join(', ')}`)
      return
    }

    try {
      setIsAnalyzing(true)
      setError(null)
      
      // Reset progress for selected providers
      const newProgress = { ...analysisProgress }
      targetProviders.forEach(provider => {
        newProgress[provider] = 'analyzing'
      })
      setAnalysisProgress(newProgress)

      // Create services for selected providers
      const serviceConfigs = targetProviders.map(provider => ({
        provider,
        apiKey: apiKeys[provider]
      }))
      
      const services = AIServiceFactory.createServices(serviceConfigs)
      const analyzer = new MultiModelAnalyzer(services)

      // Start analysis
      const results = await analyzer.analyzePaper(paper, targetProviders)
      
      // Store results
      const resultArray = Object.values(results).filter(Boolean) as AIAnalysisResult[]
      await AnalysisStorageService.storeMultipleResults(resultArray)
      
      // Update state
      setAnalyses(prev => ({ ...prev, ...results }))
      
      // Update progress
      const finalProgress = { ...analysisProgress }
      targetProviders.forEach(provider => {
        finalProgress[provider] = results[provider] ? 'completed' : 'error'
      })
      setAnalysisProgress(finalProgress)

    } catch (error) {
      console.error('Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed')
      
      // Mark all as error
      const errorProgress = { ...analysisProgress }
      targetProviders.forEach(provider => {
        errorProgress[provider] = 'error'
      })
      setAnalysisProgress(errorProgress)
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedModels, apiKeys, hasValidApiKey, analysisProgress])

  const reanalyzeWithProvider = useCallback(async (paper: Paper, provider: AIProvider) => {
    if (!hasValidApiKey(provider)) {
      setError(`Missing API key for ${provider}`)
      return
    }

    try {
      setError(null)
      setAnalysisProgress(prev => ({ ...prev, [provider]: 'analyzing' }))

      const serviceConfig = {
        provider,
        apiKey: apiKeys[provider]
      }
      
      const service = AIServiceFactory.createService(serviceConfig)
      const services = new Map([[provider, service]])
      const analyzer = new MultiModelAnalyzer(services)

      const results = await analyzer.analyzePaper(paper, [provider])
      const result = results[provider]
      
      if (result) {
        await AnalysisStorageService.storeAnalysisResult(result)
        setAnalyses(prev => ({ ...prev, [provider]: result }))
        setAnalysisProgress(prev => ({ ...prev, [provider]: 'completed' }))
      } else {
        throw new Error(`No result returned for ${provider}`)
      }

    } catch (error) {
      console.error(`Reanalysis failed for ${provider}:`, error)
      setError(`Reanalysis failed for ${provider}`)
      setAnalysisProgress(prev => ({ ...prev, [provider]: 'error' }))
    }
  }, [apiKeys, hasValidApiKey])

  const clearAnalysis = useCallback(async (targetPaperId: string) => {
    try {
      setError(null)
      await AnalysisStorageService.deleteAnalysisResults(targetPaperId)
      
      if (targetPaperId === paperId) {
        setAnalyses({})
        setAnalysisProgress({
          openai: 'idle',
          anthropic: 'idle',
          xai: 'idle',
          gemini: 'idle'
        })
      }
    } catch (error) {
      console.error('Failed to clear analysis:', error)
      setError('Failed to clear analysis results')
    }
  }, [paperId])

  const getAnalysisStats = useCallback(() => {
    return AnalysisStorageService.getAnalysisStats()
  }, [])

  return {
    // State
    analyses,
    isAnalyzing,
    selectedModels,
    apiKeys,
    analysisProgress,
    error,

    // Actions
    setSelectedModels,
    updateApiKey,
    validateApiKey,
    startAnalysis,
    reanalyzeWithProvider,
    loadAnalysis,
    clearAnalysis,

    // Utilities
    hasValidApiKey,
    getAnalysisStats
  }
}