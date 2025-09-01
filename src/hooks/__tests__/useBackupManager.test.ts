import { renderHook, act } from '@testing-library/react'
import { useBackupManager } from '../useBackupManager'
import { useToast } from '@/hooks/use-toast'

// Mock the toast hook
jest.mock('@/hooks/use-toast')
const mockToast = jest.fn()
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>
mockUseToast.mockReturnValue({ toast: mockToast } as any)

// Mock fetch
global.fetch = jest.fn()
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('useBackupManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('listBackups', () => {
    it('should fetch backups successfully', async () => {
      const mockBackups = [
        {
          id: 'backup-1',
          type: 'full',
          status: 'completed',
          filePath: '/tmp/backup1.sql',
          fileSize: 1024,
          createdAt: '2024-01-01T00:00:00Z',
          duration: 30000
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockBackups
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let backups: any[] = []
      await act(async () => {
        backups = await result.current.listBackups()
      })

      expect(backups).toHaveLength(1)
      expect(backups[0]).toEqual({
        ...mockBackups[0],
        createdAt: new Date('2024-01-01T00:00:00Z')
      })
      expect(mockFetch).toHaveBeenCalledWith('/api/backup')
    })

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Failed to fetch backups'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let backups: any[] = []
      await act(async () => {
        backups = await result.current.listBackups()
      })

      expect(backups).toEqual([])
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to fetch backups',
        variant: 'destructive'
      })
    })

    it('should apply filters to request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: []
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      const filter = {
        type: 'full' as const,
        status: 'completed',
        limit: 10,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      await act(async () => {
        await result.current.listBackups(filter)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/backup?type=full&status=completed&startDate=2024-01-01T00%3A00%3A00.000Z&endDate=2024-01-31T00%3A00%3A00.000Z&limit=10')
      )
    })
  })

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Backup created successfully'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      await act(async () => {
        await result.current.createBackup({ type: 'full' })
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({ type: 'full' })
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Backup created successfully'
      })
    })

    it('should handle creation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Failed to create backup'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      await act(async () => {
        try {
          await result.current.createBackup({ type: 'full' })
        } catch (error) {
          // Expected to throw
        }
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to create backup',
        variant: 'destructive'
      })
    })
  })

  describe('validateBackup', () => {
    it('should validate backup successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { isValid: true },
          message: 'Backup is valid'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let isValid = false
      await act(async () => {
        isValid = await result.current.validateBackup('backup-123')
      })

      expect(isValid).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/backup/backup-123/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Valid Backup',
        description: 'Backup is valid',
        variant: 'default'
      })
    })

    it('should handle invalid backup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { isValid: false },
          message: 'Backup validation failed'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let isValid = true
      await act(async () => {
        isValid = await result.current.validateBackup('backup-123')
      })

      expect(isValid).toBe(false)
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid Backup',
        description: 'Backup validation failed',
        variant: 'destructive'
      })
    })
  })

  describe('restoreBackup', () => {
    it('should restore backup successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Database restored successfully'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      await act(async () => {
        await result.current.restoreBackup('backup-123')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/backup/backup-123/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Database restored successfully'
      })
    })
  })

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      await act(async () => {
        await result.current.deleteBackup('backup-123')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/backup/backup-123', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Backup deleted successfully'
      })
    })
  })

  describe('schedules', () => {
    it('should list schedules successfully', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          name: 'Daily Backup',
          type: 'full',
          cron_expression: '0 2 * * *',
          is_active: true,
          retention_days: 30
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockSchedules
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let schedules: any[] = []
      await act(async () => {
        schedules = await result.current.listSchedules()
      })

      expect(schedules).toEqual(mockSchedules)
      expect(mockFetch).toHaveBeenCalledWith('/api/backup/schedules')
    })

    it('should create schedule successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Schedule created successfully'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      const scheduleRequest = {
        name: 'Daily Backup',
        type: 'full' as const,
        cronExpression: '0 2 * * *',
        isActive: true,
        retentionDays: 30
      }

      await act(async () => {
        await result.current.createSchedule(scheduleRequest)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/backup/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify(scheduleRequest)
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Schedule created successfully'
      })
    })
  })

  describe('statistics', () => {
    it('should get statistics successfully', async () => {
      const mockStats = [
        {
          type: 'full',
          total_backups: 10,
          successful_backups: 9,
          failed_backups: 1,
          avg_duration_ms: 30000,
          total_size_bytes: 1024000,
          last_successful_backup: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockStats
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let statistics: any[] = []
      await act(async () => {
        statistics = await result.current.getStatistics()
      })

      expect(statistics).toEqual(mockStats)
      expect(mockFetch).toHaveBeenCalledWith('/api/backup/statistics', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        }
      })
    })
  })

  describe('cleanupOldBackups', () => {
    it('should cleanup old backups successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { deletedCount: 5 },
          message: 'Cleaned up 5 old backups'
        })
      } as Response)

      const { result } = renderHook(() => useBackupManager())

      let deletedCount = 0
      await act(async () => {
        deletedCount = await result.current.cleanupOldBackups()
      })

      expect(deletedCount).toBe(5)
      expect(mockFetch).toHaveBeenCalledWith('/api/backup/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        }
      })

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Cleaned up 5 old backups'
      })
    })
  })
})