'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  Cloud,
  Zap
} from 'lucide-react'

interface SyncService {
  name: string
  status: 'synced' | 'syncing' | 'error' | 'never'
  lastSync?: Date
  nextSync?: Date
  itemCount?: number
  errorMessage?: string
  progress?: number
}

interface SyncStatusProps {
  services: SyncService[]
  onSyncClick: (serviceName: string) => void
  isLoading?: boolean
}

export function SyncStatus({ services, onSyncClick, isLoading = false }: SyncStatusProps) {
  const getStatusIcon = (status: SyncService['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'never':
        return <Clock className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusBadge = (status: SyncService['status']) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-100 text-green-800">Synced</Badge>
      case 'syncing':
        return <Badge className="bg-blue-100 text-blue-800">Syncing</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'never':
        return <Badge variant="secondary">Never Synced</Badge>
    }
  }

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'zotero':
        return <Database className="h-5 w-5" />
      case 'google drive':
        return <Cloud className="h-5 w-5" />
      case 'vector database':
        return <Zap className="h-5 w-5" />
      default:
        return <RefreshCw className="h-5 w-5" />
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-48"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-200 rounded"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-24"></div>
                    <div className="h-3 bg-slate-200 rounded w-32"></div>
                  </div>
                </div>
                <div className="h-8 w-16 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Status</CardTitle>
        <CardDescription>External service synchronization status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    {getServiceIcon(service.name)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">{service.name}</p>
                      {getStatusIcon(service.status)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {service.lastSync ? (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {formatDistanceToNow(service.lastSync, { addSuffix: true })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Never synced</p>
                      )}
                      {service.itemCount !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          • {service.itemCount} items
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(service.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSyncClick(service.name)}
                    disabled={service.status === 'syncing'}
                  >
                    {service.status === 'syncing' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              {service.status === 'syncing' && service.progress !== undefined && (
                <Progress value={service.progress} className="h-2" />
              )}
              
              {service.status === 'error' && service.errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {service.errorMessage}
                  </p>
                </div>
              )}
              
              {service.nextSync && service.status === 'synced' && (
                <p className="text-xs text-muted-foreground">
                  Next sync: {formatDistanceToNow(service.nextSync, { addSuffix: true })}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}