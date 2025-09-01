import { BackupService } from '../BackupService'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'
import { exec } from 'child_process'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('fs/promises')
jest.mock('child_process')
jest.mock('crypto')
jest.mock('node-cron')

const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      order: jest.fn(() => ({
        limit: jest.fn()
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    })),
    upsert: jest.fn()
  })),
  rpc: jest.fn()
}

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockFs = fs as jest.Mocked<typeof fs>
const mockExec = exec as jest.MockedFunction<typeof exec>
const mockCrypto = crypto as jest.Mocked<typeof crypto>

describe('BackupService', () => {
  let backupService: BackupService
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockReturnValue(mockSupabase as any)
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.BACKUP_STORAGE_PATH = '/tmp/test-backups'
    
    backupService = new BackupService()
  })

  afterEach(() => {
    backupService.destroy()
  })

  describe('createBackup', () => {
    it('should create a full backup successfully', async () => {
      // Mock successful database operations
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'backup-123', type: 'full' },
        error: null
      })
      
      mockSupabase.from().update().eq.mockResolvedValue({ error: null })
      
      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.stat.mockResolvedValue({ size: 1024 } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('test backup data'))
      
      // Mock crypto operations
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('test-checksum')
      }
      mockCrypto.createHash.mockReturnValue(mockHash as any)
      mockCrypto.randomUUID.mockReturnValue('backup-123')
      
      // Mock exec for pg_dump
      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: 'Backup completed',
        stderr: ''
      })
      jest.doMock('util', () => ({
        promisify: () => mockExecAsync
      }))

      const result = await backupService.createBackup('full')

      expect(result).toEqual({
        id: 'backup-123',
        type: 'full',
        size: 1024,
        duration: expect.any(Number),
        checksum: 'test-checksum',
        createdAt: expect.any(Date),
        status: 'success',
        filePath: expect.stringContaining('backup_full_')
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('backup_records')
    })

    it('should handle backup creation failure', async () => {
      // Mock database insert failure
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect(backupService.createBackup('full')).rejects.toThrow('Failed to create backup record: Database error')
    })

    it('should handle pg_dump command failure', async () => {
      // Mock successful database operations
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'backup-123', type: 'full' },
        error: null
      })
      
      mockSupabase.from().update().eq.mockResolvedValue({ error: null })
      
      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined)
      
      // Mock crypto operations
      mockCrypto.randomUUID.mockReturnValue('backup-123')
      
      // Mock exec failure
      const mockExecAsync = jest.fn().mockRejectedValue(new Error('pg_dump failed'))
      jest.doMock('util', () => ({
        promisify: () => mockExecAsync
      }))

      await expect(backupService.createBackup('full')).rejects.toThrow('Backup failed')
    })
  })

  describe('validateBackup', () => {
    it('should validate backup successfully', async () => {
      const backupRecord = {
        id: 'backup-123',
        file_path: '/tmp/backup.sql',
        file_size: 1024,
        checksum: 'test-checksum'
      }

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: backupRecord,
        error: null
      })

      mockFs.stat.mockResolvedValue({ size: 1024 } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('test backup data'))

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('test-checksum')
      }
      mockCrypto.createHash.mockReturnValue(mockHash as any)

      const result = await backupService.validateBackup('backup-123')

      expect(result).toEqual({
        isValid: true,
        checksum: 'test-checksum',
        fileSize: 1024
      })
    })

    it('should detect file size mismatch', async () => {
      const backupRecord = {
        id: 'backup-123',
        file_path: '/tmp/backup.sql',
        file_size: 1024,
        checksum: 'test-checksum'
      }

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: backupRecord,
        error: null
      })

      mockFs.stat.mockResolvedValue({ size: 2048 } as any) // Different size

      const result = await backupService.validateBackup('backup-123')

      expect(result).toEqual({
        isValid: false,
        checksum: '',
        fileSize: 2048,
        errorMessage: 'File size mismatch'
      })
    })

    it('should detect checksum mismatch', async () => {
      const backupRecord = {
        id: 'backup-123',
        file_path: '/tmp/backup.sql',
        file_size: 1024,
        checksum: 'original-checksum'
      }

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: backupRecord,
        error: null
      })

      mockFs.stat.mockResolvedValue({ size: 1024 } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('test backup data'))

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('different-checksum')
      }
      mockCrypto.createHash.mockReturnValue(mockHash as any)

      const result = await backupService.validateBackup('backup-123')

      expect(result).toEqual({
        isValid: false,
        checksum: 'different-checksum',
        fileSize: 1024,
        errorMessage: 'Checksum mismatch'
      })
    })
  })

  describe('restoreFromBackup', () => {
    it('should restore backup successfully', async () => {
      const backupRecord = {
        id: 'backup-123',
        file_path: '/tmp/backup.sql',
        status: 'completed'
      }

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: backupRecord,
        error: null
      })

      mockSupabase.from().insert.mockResolvedValue({ error: null })
      mockSupabase.from().update().eq.mockResolvedValue({ error: null })

      // Mock validation success
      mockFs.stat.mockResolvedValue({ size: 1024 } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('test backup data'))
      mockFs.access.mockResolvedValue(undefined)

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('test-checksum')
      }
      mockCrypto.createHash.mockReturnValue(mockHash as any)
      mockCrypto.randomUUID.mockReturnValue('restore-123')

      // Mock psql command
      const mockExecAsync = jest.fn().mockResolvedValue({
        stdout: 'CREATE TABLE users\nCREATE TABLE papers',
        stderr: ''
      })
      jest.doMock('util', () => ({
        promisify: () => mockExecAsync
      }))

      const result = await backupService.restoreFromBackup('backup-123')

      expect(result).toEqual({
        id: 'restore-123',
        backupRecordId: 'backup-123',
        status: 'success',
        duration: expect.any(Number),
        restoredTables: ['users', 'papers']
      })
    })

    it('should handle restore failure', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Backup not found' }
      })

      await expect(backupService.restoreFromBackup('backup-123')).rejects.toThrow('Restore failed')
    })
  })

  describe('listBackups', () => {
    it('should list backups with filters', async () => {
      const mockBackups = [
        {
          id: 'backup-1',
          type: 'full',
          status: 'completed',
          file_path: '/tmp/backup1.sql',
          file_size: 1024,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'backup-2',
          type: 'incremental',
          status: 'completed',
          file_path: '/tmp/backup2.sql',
          file_size: 512,
          created_at: '2024-01-02T00:00:00Z'
        }
      ]

      mockSupabase.from().select().eq.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: mockBackups,
            error: null
          })
        })
      })

      const result = await backupService.listBackups({ type: 'full', limit: 10 })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'backup-1',
        type: 'full',
        status: 'completed',
        filePath: '/tmp/backup1.sql',
        fileSize: 1024,
        checksum: undefined,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: undefined,
        duration: undefined
      })
    })
  })

  describe('scheduleBackup', () => {
    it('should create backup schedule', async () => {
      const schedule = {
        id: 'schedule-123',
        name: 'Daily Backup',
        type: 'full' as const,
        cronExpression: '0 2 * * *',
        isActive: true,
        retentionDays: 30
      }

      mockSupabase.from().upsert.mockResolvedValue({ error: null })

      await expect(backupService.scheduleBackup(schedule)).resolves.not.toThrow()
      expect(mockSupabase.from).toHaveBeenCalledWith('backup_schedules')
    })
  })

  describe('getBackupStatistics', () => {
    it('should return backup statistics', async () => {
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

      mockSupabase.from().select().mockResolvedValue({
        data: mockStats,
        error: null
      })

      const result = await backupService.getBackupStatistics()

      expect(result).toEqual(mockStats)
      expect(mockSupabase.from).toHaveBeenCalledWith('backup_statistics')
    })
  })

  describe('cleanupOldBackups', () => {
    it('should cleanup old backups', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 5,
        error: null
      })

      mockSupabase.from().select().eq().lt().mockResolvedValue({
        data: [
          { file_path: '/tmp/old1.sql' },
          { file_path: '/tmp/old2.sql' }
        ],
        error: null
      })

      mockFs.unlink.mockResolvedValue(undefined)

      const result = await backupService.cleanupOldBackups()

      expect(result).toBe(5)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_old_backups')
      expect(mockFs.unlink).toHaveBeenCalledTimes(2)
    })
  })
})