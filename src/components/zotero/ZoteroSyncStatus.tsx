'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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

export function ZoteroSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchSyncStatus()
    
    // Poll sync status every 5 seconds when sync is running
    const interval = setInterval(() => {
      if (syncStatus?.isRunning) {
        fetchSyncStatus()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [syncStatus?.isRunning])

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/zotero/sync')
      const result = await response.json()
      
      if (result.success) {
        setSyncStatus(result.data)
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  const performSync = async (type: 'incremental' | 'full' = 'incremental') => {
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
        toast({
          title: 'Sync Completed',
          description: `${result.data.newItems} new papers, ${result.data.updatedItems} updated`
        })
        
        // Refresh status
        await fetchSyncStatus()
      } else {
        toast({
          title: 'Sync Failed',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Sync Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const getSyncStatusBadge = () => {
    if (!syncStatus) return null

    if (syncStatus.isRunning) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing...
        </Badge>
      )
    }

    if (syncStatus.errors.length > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Errors
        </Badge>
      )
    }

    if (syncStatus.lastSyncTime) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Synced
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Not Synced
      </Badge>
    )
  }

  if (!syncStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Zotero Sync Status</span>
          {getSyncStatusBadge()}
        </CardTitle>
        <CardDescription>
          Synchronize your Zotero library with the paper manager
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Progress */}
        {syncStatus.isRunning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Synchronizing with Zotero...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Last Sync Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Last Sync</p>
            <p className="text-gray-600">{formatDate(syncStatus.lastSyncTime)}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Total Items</p>
            <p className="text-gray-600">{syncStatus.totalItems}</p>
          </div>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-medium text-green-800 mb-2">Last Sync Results</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-green-600">New: {lastSyncResult.newItems}</p>
              </div>
              <div>
                <p className="text-green-600">Updated: {lastSyncResult.updatedItems}</p>
              </div>
              <div>
                <p className="text-green-600">Total: {lastSyncResult.totalItems}</p>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {syncStatus.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Sync Errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {syncStatus.errors.slice(0, 3).map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
                {syncStatus.errors.length > 3 && (
                  <li className="text-sm">... and {syncStatus.errors.length - 3} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => performSync('incremental')}
            disabled={isLoading || syncStatus.isRunning}
            className="flex-1"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            Quick Sync
          </Button>
          <Button
            onClick={() => performSync('full')}
            disabled={isLoading || syncStatus.isRunning}
            variant="outline"
            className="flex-1"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="mr-2 h-4 w-4" />
            Full Sync
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Quick Sync: Only syncs changes since last sync</p>
          <p>• Full Sync: Downloads all items from your Zotero library</p>
        </div>
      </CardContent>
    </Card>
  )
}