'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  Settings,
  BarChart3,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BackupInfo {
  id: string
  type: 'full' | 'incremental' | 'differential'
  status: string
  filePath: string
  fileSize?: number
  checksum?: string
  createdAt: Date
  completedAt?: Date
  duration?: number
}

interface BackupSchedule {
  id: string
  name: string
  type: 'full' | 'incremental' | 'differential'
  cron_expression: string
  is_active: boolean
  retention_days: number
  last_run_at?: string
  next_run_at?: string
}

interface BackupStatistics {
  type: string
  total_backups: number
  successful_backups: number
  failed_backups: number
  avg_duration_ms: number
  total_size_bytes: number
  last_successful_backup: string
}

export function BackupDashboard() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [schedules, setSchedules] = useState<BackupSchedule[]>([])
  const [statistics, setStatistics] = useState<BackupStatistics[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadBackups(),
        loadSchedules(),
        loadStatistics()
      ])
    } catch (error) {
      console.error('Failed to load backup data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load backup data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadBackups = async () => {
    const response = await fetch('/api/backup')
    if (response.ok) {
      const data = await response.json()
      setBackups(data.data.map((backup: any) => ({
        ...backup,
        createdAt: new Date(backup.createdAt),
        completedAt: backup.completedAt ? new Date(backup.completedAt) : undefined
      })))
    }
  }

  const loadSchedules = async () => {
    const response = await fetch('/api/backup/schedules')
    if (response.ok) {
      const data = await response.json()
      setSchedules(data.data)
    }
  }

  const loadStatistics = async () => {
    const response = await fetch('/api/backup/statistics')
    if (response.ok) {
      const data = await response.json()
      setStatistics(data.data)
    }
  }

  const createBackup = async (type: 'full' | 'incremental' | 'differential') => {
    try {
      setCreating(true)
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token' // 실제 구현에서는 JWT 토큰 사용
        },
        body: JSON.stringify({ type })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: `${type} backup started successfully`
        })
        setShowCreateDialog(false)
        await loadBackups()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create backup',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const validateBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/backup/${backupId}/validate`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: data.data.isValid ? 'Valid' : 'Invalid',
          description: data.message,
          variant: data.data.isValid ? 'default' : 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate backup',
        variant: 'destructive'
      })
    }
  }

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore from this backup? This will overwrite current data.')) {
      return
    }

    try {
      const response = await fetch(`/api/backup/${backupId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Database restored successfully'
        })
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restore backup',
        variant: 'destructive'
      })
    }
  }

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return
    }

    try {
      const response = await fetch(`/api/backup/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Backup deleted successfully'
        })
        await loadBackups()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete backup',
        variant: 'destructive'
      })
    }
  }

  const cleanupOldBackups = async () => {
    try {
      const response = await fetch('/api/backup/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: 'Success',
          description: data.message
        })
        await loadBackups()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cleanup old backups',
        variant: 'destructive'
      })
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Unknown'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const colors = {
      full: 'bg-blue-100 text-blue-800',
      incremental: 'bg-yellow-100 text-yellow-800',
      differential: 'bg-purple-100 text-purple-800'
    }
    return <Badge className={colors[type as keyof typeof colors] || ''}>{type}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup Management</h1>
          <p className="text-muted-foreground">Manage database backups and recovery</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={cleanupOldBackups} variant="outline">
            <Trash2 className="w-4 h-4 mr-2" />
            Cleanup Old Backups
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Database className="w-4 h-4 mr-2" />
                Create Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Backup</DialogTitle>
                <DialogDescription>
                  Choose the type of backup to create
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    onClick={() => createBackup('full')} 
                    disabled={creating}
                    className="justify-start"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Full Backup
                  </Button>
                  <Button 
                    onClick={() => createBackup('incremental')} 
                    disabled={creating}
                    variant="outline"
                    className="justify-start"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Incremental Backup
                  </Button>
                  <Button 
                    onClick={() => createBackup('differential')} 
                    disabled={creating}
                    variant="outline"
                    className="justify-start"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Differential Backup
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statistics.map((stat) => (
          <Card key={stat.type}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.type.charAt(0).toUpperCase() + stat.type.slice(1)} Backups
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.successful_backups}/{stat.total_backups}</div>
              <p className="text-xs text-muted-foreground">
                Success rate: {stat.total_backups > 0 ? Math.round((stat.successful_backups / stat.total_backups) * 100) : 0}%
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                <div>Avg duration: {formatDuration(stat.avg_duration_ms)}</div>
                <div>Total size: {formatFileSize(stat.total_size_bytes)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backups">Backup History</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Backups</CardTitle>
              <CardDescription>
                View and manage your database backups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {backups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No backups found. Create your first backup to get started.
                  </div>
                ) : (
                  backups.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Database className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            {getTypeBadge(backup.type)}
                            {getStatusBadge(backup.status)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Created: {backup.createdAt.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Size: {formatFileSize(backup.fileSize)} • Duration: {formatDuration(backup.duration)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => validateBackup(backup.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Validate
                        </Button>
                        {backup.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreBackup(backup.id)}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteBackup(backup.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup Schedules</CardTitle>
              <CardDescription>
                Manage automated backup schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Calendar className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{schedule.name}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          {getTypeBadge(schedule.type)}
                          <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                            {schedule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Schedule: {schedule.cron_expression} • Retention: {schedule.retention_days} days
                        </div>
                        {schedule.last_run_at && (
                          <div className="text-sm text-muted-foreground">
                            Last run: {new Date(schedule.last_run_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}