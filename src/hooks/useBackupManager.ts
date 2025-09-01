import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface BackupInfo {
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

export interface BackupSchedule {
  id: string
  name: string
  type: 'full' | 'incremental' | 'differential'
  cron_expression: string
  is_active: boolean
  retention_days: number
  last_run_at?: string
  next_run_at?: string
}

export interface BackupStatistics {
  type: string
  total_backups: number
  successful_backups: number
  failed_backups: number
  avg_duration_ms: number
  total_size_bytes: number
  last_successful_backup: string
}

export interface CreateBackupRequest {
  type: 'full' | 'incremental' | 'differential'
}

export interface CreateScheduleRequest {
  name: string
  type: 'full' | 'incremental' | 'differential'
  cronExpression: string
  isActive?: boolean
  retentionDays?: number
}

export interface BackupFilter {
  type?: 'full' | 'incremental' | 'differential'
  status?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export function useBackupManager() {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer admin-token' // 실제 구현에서는 JWT 토큰 사용
  })

  const handleApiError = (error: any, defaultMessage: string) => {
    const message = error instanceof Error ? error.message : defaultMessage
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive'
    })
    throw error
  }

  const listBackups = useCallback(async (filter?: BackupFilter): Promise<BackupInfo[]> => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (filter?.type) params.append('type', filter.type)
      if (filter?.status) params.append('status', filter.status)
      if (filter?.startDate) params.append('startDate', filter.startDate.toISOString())
      if (filter?.endDate) params.append('endDate', filter.endDate.toISOString())
      if (filter?.limit) params.append('limit', filter.limit.toString())

      const url = `/api/backup${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch backups')
      }

      const data = await response.json()
      return data.data.map((backup: any) => ({
        ...backup,
        createdAt: new Date(backup.createdAt),
        completedAt: backup.completedAt ? new Date(backup.completedAt) : undefined
      }))
    } catch (error) {
      handleApiError(error, 'Failed to fetch backups')
      return []
    } finally {
      setLoading(false)
    }
  }, [toast])

  const createBackup = useCallback(async (request: CreateBackupRequest): Promise<void> => {
    try {
      setCreating(true)
      
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create backup')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Backup created successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to create backup')
    } finally {
      setCreating(false)
    }
  }, [toast])

  const validateBackup = useCallback(async (backupId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/backup/${backupId}/validate`, {
        method: 'POST',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to validate backup')
      }

      const data = await response.json()
      toast({
        title: data.data.isValid ? 'Valid Backup' : 'Invalid Backup',
        description: data.message,
        variant: data.data.isValid ? 'default' : 'destructive'
      })

      return data.data.isValid
    } catch (error) {
      handleApiError(error, 'Failed to validate backup')
      return false
    }
  }, [toast])

  const restoreBackup = useCallback(async (backupId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/backup/${backupId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to restore backup')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Database restored successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to restore backup')
    }
  }, [toast])

  const deleteBackup = useCallback(async (backupId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/backup/${backupId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete backup')
      }

      toast({
        title: 'Success',
        description: 'Backup deleted successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to delete backup')
    }
  }, [toast])

  const listSchedules = useCallback(async (): Promise<BackupSchedule[]> => {
    try {
      const response = await fetch('/api/backup/schedules')

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch schedules')
      }

      const data = await response.json()
      return data.data
    } catch (error) {
      handleApiError(error, 'Failed to fetch schedules')
      return []
    }
  }, [toast])

  const createSchedule = useCallback(async (request: CreateScheduleRequest): Promise<void> => {
    try {
      const response = await fetch('/api/backup/schedules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create schedule')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Schedule created successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to create schedule')
    }
  }, [toast])

  const updateSchedule = useCallback(async (
    scheduleId: string, 
    updates: Partial<CreateScheduleRequest>
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/backup/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update schedule')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Schedule updated successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to update schedule')
    }
  }, [toast])

  const deleteSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/backup/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete schedule')
      }

      toast({
        title: 'Success',
        description: 'Schedule deleted successfully'
      })
    } catch (error) {
      handleApiError(error, 'Failed to delete schedule')
    }
  }, [toast])

  const getStatistics = useCallback(async (): Promise<BackupStatistics[]> => {
    try {
      const response = await fetch('/api/backup/statistics', {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch statistics')
      }

      const data = await response.json()
      return data.data
    } catch (error) {
      handleApiError(error, 'Failed to fetch statistics')
      return []
    }
  }, [toast])

  const cleanupOldBackups = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/backup/cleanup', {
        method: 'POST',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cleanup backups')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Old backups cleaned up successfully'
      })

      return data.data.deletedCount
    } catch (error) {
      handleApiError(error, 'Failed to cleanup backups')
      return 0
    }
  }, [toast])

  return {
    // State
    loading,
    creating,

    // Backup operations
    listBackups,
    createBackup,
    validateBackup,
    restoreBackup,
    deleteBackup,

    // Schedule operations
    listSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,

    // Statistics and maintenance
    getStatistics,
    cleanupOldBackups
  }
}