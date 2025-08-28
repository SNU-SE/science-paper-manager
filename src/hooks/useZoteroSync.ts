'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from './use-toast'

interface SyncStatus {
  isRunning: boolean
  lastSyncTime: string | null
  lastSyncVersion: number
  totalItems: number
  errors: string[]
}

interface SyncResult {
  totalItems: number
  newItems: number
  updatedItems: number
  errors: string[]
  lastSyncTime: string
}

interface ZoteroConfig {
  isConfigured: boolean
  config: {
    userId: string
    libraryType: string
    libraryId?: string
    hasApiKey: boolean
  } | null
}

export function useZoteroSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [config, setConfig] = useState<ZoteroConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const { toast } = useToast()

  // Fetch sync status
  const fetchSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/zotero/sync')
      const result = await response.json()
      
      if (result.success) {
        setSyncStatus(result.data)
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }, [])

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/zotero/config')
      const result = await response.json()
      
      if (result.success) {
        setConfig(result.data)
      }
    } catch (error) {
      console.error('Error fetching Zotero config:', error)
    }
  }, [])

  // Configure Zotero
  const configure = useCallback(async (configData: {
    userId: string
    apiKey: string
    libraryType: 'user' | 'group'
    libraryId?: string
  }) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zotero/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      })

      const result = await response.json()

      if (result.success) {
        await fetchConfig()
        toast({
          title: 'Success',
          description: 'Zotero configured successfully'
        })
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to configure Zotero'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [fetchConfig, toast])

  // Disconnect Zotero
  const disconnect = useCallback(async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zotero/config', {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setConfig(null)
        setSyncStatus(null)
        setLastSyncResult(null)
        toast({
          title: 'Success',
          description: 'Zotero disconnected successfully'
        })
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Zotero',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Perform sync
  const performSync = useCallback(async (type: 'incremental' | 'full' = 'incremental') => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zotero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      })

      const result = await response.json()

      if (result.success) {
        setLastSyncResult(result.data)
        await fetchSyncStatus()
        toast({
          title: 'Sync Completed',
          description: `${result.data.newItems} new papers, ${result.data.updatedItems} updated`
        })
        return result.data
      } else {
        toast({
          title: 'Sync Failed',
          description: result.error,
          variant: 'destructive'
        })
        return null
      }
    } catch (error) {
      toast({
        title: 'Sync Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [fetchSyncStatus, toast])

  // Initialize data on mount
  useEffect(() => {
    fetchConfig()
    fetchSyncStatus()
  }, [fetchConfig, fetchSyncStatus])

  // Poll sync status when sync is running
  useEffect(() => {
    if (!syncStatus?.isRunning) return

    const interval = setInterval(() => {
      fetchSyncStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [syncStatus?.isRunning, fetchSyncStatus])

  return {
    // State
    syncStatus,
    config,
    isLoading,
    lastSyncResult,
    
    // Actions
    configure,
    disconnect,
    performSync,
    fetchSyncStatus,
    fetchConfig,
    
    // Computed
    isConfigured: config?.isConfigured ?? false,
    isSyncing: syncStatus?.isRunning ?? false,
    hasErrors: (syncStatus?.errors?.length ?? 0) > 0
  }
}