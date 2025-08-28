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
import { ZoteroSettingsInfo } from '@/services/settings/UserZoteroService'

interface ZoteroSyncStatusProps {
  settings: ZoteroSettingsInfo
}

export function ZoteroSyncStatus({ settings }: ZoteroSyncStatusProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // This component now receives settings as props, so we don't need to fetch them

  // Settings are now passed as props

  // Sync functionality is now handled in ZoteroConfig component

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleString()
  }

  const getSyncStatusBadge = () => {
    switch (settings.syncStatus) {
      case 'syncing':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing...
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Inactive
          </Badge>
        )
    }
  }

  // Component now always renders since settings are provided

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
        {settings.syncStatus === 'syncing' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Synchronizing with Zotero...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Settings Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Last Sync</p>
            <p className="text-gray-600">{formatDate(settings.lastSyncAt)}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Auto Sync</p>
            <p className="text-gray-600">{settings.autoSync ? 'Enabled' : 'Disabled'}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Library Type</p>
            <p className="text-gray-600">{settings.libraryType}</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Sync Interval</p>
            <p className="text-gray-600">{settings.syncInterval}s</p>
          </div>
        </div>

        {/* Status Information */}
        {settings.syncStatus === 'completed' && settings.lastSyncAt && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-medium text-green-800 mb-2">Sync Status</p>
            <p className="text-sm text-green-600">
              Last successful sync: {formatDate(settings.lastSyncAt)}
            </p>
          </div>
        )}
        
        {settings.syncStatus === 'failed' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="font-medium text-red-800 mb-2">Sync Failed</p>
            <p className="text-sm text-red-600">
              The last sync attempt failed. Please check your Zotero configuration and try again.
            </p>
          </div>
        )}

        {/* Additional Information */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="text-sm">
              Sync functionality allows you to keep your Zotero library synchronized with this application. 
              Manual sync can be triggered from the configuration section above.
            </p>
          </AlertDescription>
        </Alert>

        {/* Status Summary */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Sync actions are available in the Zotero Integration section above</p>
          <p>• Auto-sync will run automatically based on your configured interval</p>
          <p>• Manual sync can be triggered anytime using the "Sync Now" button</p>
        </div>
      </CardContent>
    </Card>
  )
}