'use client'

import { useState, useEffect, useCallback } from 'react'

export interface APIKeyData {
  key: string
  isValid: boolean
  isEnabled: boolean
  lastValidated?: Date
  usage: {
    tokensUsed: number
    cost: number
    requestCount: number
  }
}

export interface UsageStats {
  tokensUsed: number
  processingTimeMs: number
  cost?: number
}

const AI_SERVICES = ['openai', 'anthropic', 'xai', 'gemini'] as const
type AIService = typeof AI_SERVICES[number]

export function useAPIKeyManager() {
  const [apiKeys, setApiKeys] = useState<Record<string, APIKeyData>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Initialize API keys from localStorage
  useEffect(() => {
    const loadedKeys: Record<string, APIKeyData> = {}
    
    AI_SERVICES.forEach(service => {
      const storedKey = localStorage.getItem(`apiKey_${service}`)
      const storedEnabled = localStorage.getItem(`apiEnabled_${service}`)
      const storedUsage = localStorage.getItem(`apiUsage_${service}`)
      
      loadedKeys[service] = {
        key: storedKey || '',
        isValid: false,
        isEnabled: storedEnabled === 'true',
        usage: storedUsage ? JSON.parse(storedUsage) : {
          tokensUsed: 0,
          cost: 0,
          requestCount: 0
        }
      }
    })
    
    setApiKeys(loadedKeys)
    setIsLoading(false)
  }, [])

  // Get API key for a service
  const getApiKey = useCallback((service: AIService): string => {
    return apiKeys[service]?.key || ''
  }, [apiKeys])

  // Check if service is enabled and has valid key
  const isServiceEnabled = useCallback((service: AIService): boolean => {
    const keyData = apiKeys[service]
    return keyData?.isEnabled && keyData?.isValid && !!keyData?.key
  }, [apiKeys])

  // Get enabled services
  const getEnabledServices = useCallback((): AIService[] => {
    return AI_SERVICES.filter(service => isServiceEnabled(service))
  }, [isServiceEnabled])

  // Update API key
  const updateApiKey = useCallback((service: AIService, key: string, isValid: boolean) => {
    setApiKeys(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        key,
        isValid,
        lastValidated: new Date()
      }
    }))

    // Store in localStorage
    if (key) {
      localStorage.setItem(`apiKey_${service}`, key)
    } else {
      localStorage.removeItem(`apiKey_${service}`)
    }
  }, [])

  // Toggle service enabled state
  const toggleService = useCallback((service: AIService, enabled: boolean) => {
    setApiKeys(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        isEnabled: enabled
      }
    }))

    localStorage.setItem(`apiEnabled_${service}`, enabled.toString())
  }, [])

  // Record usage for a service
  const recordUsage = useCallback((service: AIService, stats: UsageStats) => {
    setApiKeys(prev => {
      const currentUsage = prev[service]?.usage || { tokensUsed: 0, cost: 0, requestCount: 0 }
      const updatedUsage = {
        tokensUsed: currentUsage.tokensUsed + stats.tokensUsed,
        cost: currentUsage.cost + (stats.cost || 0),
        requestCount: currentUsage.requestCount + 1
      }

      const updatedKeys = {
        ...prev,
        [service]: {
          ...prev[service],
          usage: updatedUsage
        }
      }

      // Store updated usage in localStorage
      localStorage.setItem(`apiUsage_${service}`, JSON.stringify(updatedUsage))

      return updatedKeys
    })
  }, [])

  // Get usage stats for a service
  const getUsageStats = useCallback((service: AIService) => {
    return apiKeys[service]?.usage || { tokensUsed: 0, cost: 0, requestCount: 0 }
  }, [apiKeys])

  // Get total usage across all services
  const getTotalUsage = useCallback(() => {
    return Object.values(apiKeys).reduce((total, keyData) => ({
      tokensUsed: total.tokensUsed + (keyData.usage?.tokensUsed || 0),
      cost: total.cost + (keyData.usage?.cost || 0),
      requestCount: total.requestCount + (keyData.usage?.requestCount || 0)
    }), { tokensUsed: 0, cost: 0, requestCount: 0 })
  }, [apiKeys])

  // Reset usage stats for a service
  const resetUsageStats = useCallback((service: AIService) => {
    setApiKeys(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        usage: { tokensUsed: 0, cost: 0, requestCount: 0 }
      }
    }))

    localStorage.removeItem(`apiUsage_${service}`)
  }, [])

  // Reset all usage stats
  const resetAllUsageStats = useCallback(() => {
    setApiKeys(prev => {
      const updated = { ...prev }
      AI_SERVICES.forEach(service => {
        updated[service] = {
          ...updated[service],
          usage: { tokensUsed: 0, cost: 0, requestCount: 0 }
        }
        localStorage.removeItem(`apiUsage_${service}`)
      })
      return updated
    })
  }, [])

  // Get services with valid keys
  const getValidServices = useCallback((): AIService[] => {
    return AI_SERVICES.filter(service => apiKeys[service]?.isValid)
  }, [apiKeys])

  // Check if any service is configured
  const hasAnyValidKey = useCallback((): boolean => {
    return AI_SERVICES.some(service => apiKeys[service]?.isValid)
  }, [apiKeys])

  return {
    apiKeys,
    isLoading,
    getApiKey,
    isServiceEnabled,
    getEnabledServices,
    updateApiKey,
    toggleService,
    recordUsage,
    getUsageStats,
    getTotalUsage,
    resetUsageStats,
    resetAllUsageStats,
    getValidServices,
    hasAnyValidKey
  }
}