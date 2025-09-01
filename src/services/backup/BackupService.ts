import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as cron from 'node-cron'

const execAsync = promisify(exec)

export interface BackupResult {
  id: string
  type: BackupType
  size: number
  duration: number
  checksum: string
  createdAt: Date
  status: 'success' | 'failed' | 'partial'
  filePath: string
  errorMessage?: string
}

export interface BackupSchedule {
  id: string
  name: string
  type: BackupType
  cronExpression: string
  isActive: boolean
  retentionDays: number
  lastRunAt?: Date
  nextRunAt?: Date
}

export interface RestoreResult {
  id: string
  backupRecordId: string
  status: 'success' | 'failed' | 'partial'
  duration: number
  restoredTables: string[]
  errorMessage?: string
}

export interface ValidationResult {
  isValid: boolean
  checksum: string
  fileSize: number
  errorMessage?: string
}

export interface BackupInfo {
  id: string
  type: BackupType
  status: string
  filePath: string
  fileSize?: number
  checksum?: string
  createdAt: Date
  completedAt?: Date
  duration?: number
}

export interface BackupFilter {
  type?: BackupType
  status?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

export type BackupType = 'full' | 'incremental' | 'differential'

export class BackupService {
  private supabase: SupabaseClient<Database>
  private backupPath: string
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map()

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase
    this.backupPath = process.env.BACKUP_STORAGE_PATH || '/tmp/backups'
    this.initializeBackupDirectory()
    this.loadScheduledBackups()
  }

  private async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupPath, { recursive: true })
    } catch (error) {
      console.error('Failed to create backup directory:', error)
      throw new Error('Backup directory initialization failed')
    }
  }

  async createBackup(type: BackupType): Promise<BackupResult> {
    const startTime = Date.now()
    const backupId = crypto.randomUUID()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup_${type}_${timestamp}.sql`
    const filePath = path.join(this.backupPath, fileName)

    try {
      // 백업 기록 생성
      const { data: backupRecord, error: insertError } = await this.supabase
        .from('backup_records')
        .insert({
          id: backupId,
          type,
          status: 'in_progress',
          file_path: filePath
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Failed to create backup record: ${insertError.message}`)
      }

      // 데이터베이스 백업 실행
      await this.performDatabaseBackup(type, filePath)

      // 파일 정보 수집
      const stats = await fs.stat(filePath)
      const checksum = await this.calculateChecksum(filePath)
      const duration = Date.now() - startTime

      // 백업 기록 업데이트
      const { error: updateError } = await this.supabase
        .from('backup_records')
        .update({
          status: 'completed',
          file_size: stats.size,
          checksum,
          duration_ms: duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId)

      if (updateError) {
        console.error('Failed to update backup record:', updateError)
      }

      return {
        id: backupId,
        type,
        size: stats.size,
        duration,
        checksum,
        createdAt: new Date(),
        status: 'success',
        filePath
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // 실패한 백업 기록 업데이트
      await this.supabase
        .from('backup_records')
        .update({
          status: 'failed',
          error_message: errorMessage,
          duration_ms: duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId)

      // 실패한 백업 파일 정리
      try {
        await fs.unlink(filePath)
      } catch (cleanupError) {
        console.error('Failed to cleanup failed backup file:', cleanupError)
      }

      throw new Error(`Backup failed: ${errorMessage}`)
    }
  }

  private async performDatabaseBackup(type: BackupType, filePath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured')
    }

    let command: string

    switch (type) {
      case 'full':
        command = `pg_dump "${dbUrl}" --no-password --verbose --clean --no-acl --no-owner -f "${filePath}"`
        break
      case 'incremental':
        // 간단한 구현: 최근 변경된 데이터만 백업
        const lastBackupTime = await this.getLastBackupTime(type)
        command = `pg_dump "${dbUrl}" --no-password --verbose --clean --no-acl --no-owner --where="updated_at > '${lastBackupTime}'" -f "${filePath}"`
        break
      case 'differential':
        // 차등 백업: 마지막 전체 백업 이후 변경된 데이터
        const lastFullBackupTime = await this.getLastBackupTime('full')
        command = `pg_dump "${dbUrl}" --no-password --verbose --clean --no-acl --no-owner --where="updated_at > '${lastFullBackupTime}'" -f "${filePath}"`
        break
      default:
        throw new Error(`Unsupported backup type: ${type}`)
    }

    try {
      const { stdout, stderr } = await execAsync(command)
      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Backup warnings:', stderr)
      }
    } catch (error) {
      throw new Error(`Database backup command failed: ${error}`)
    }
  }

  private async getLastBackupTime(type: BackupType): Promise<string> {
    const { data, error } = await this.supabase
      .from('backup_records')
      .select('created_at')
      .eq('type', type)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      // 백업이 없으면 1주일 전으로 설정
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    return data.created_at
  }

  async scheduleBackup(schedule: BackupSchedule): Promise<void> {
    // 기존 스케줄이 있으면 제거
    const existingJob = this.scheduledJobs.get(schedule.id)
    if (existingJob) {
      existingJob.stop()
      this.scheduledJobs.delete(schedule.id)
    }

    if (!schedule.isActive) {
      return
    }

    // 새 스케줄 생성
    const task = cron.schedule(schedule.cronExpression, async () => {
      try {
        console.log(`Starting scheduled backup: ${schedule.name}`)
        await this.createBackup(schedule.type)
        
        // 스케줄 업데이트
        await this.supabase
          .from('backup_schedules')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', schedule.id)

        console.log(`Completed scheduled backup: ${schedule.name}`)
      } catch (error) {
        console.error(`Scheduled backup failed: ${schedule.name}`, error)
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    })

    this.scheduledJobs.set(schedule.id, task)

    // 데이터베이스에 스케줄 저장/업데이트
    const { error } = await this.supabase
      .from('backup_schedules')
      .upsert({
        id: schedule.id,
        name: schedule.name,
        type: schedule.type,
        cron_expression: schedule.cronExpression,
        is_active: schedule.isActive,
        retention_days: schedule.retentionDays
      })

    if (error) {
      throw new Error(`Failed to save backup schedule: ${error.message}`)
    }
  }

  async restoreFromBackup(backupId: string): Promise<RestoreResult> {
    const startTime = Date.now()
    const restoreId = crypto.randomUUID()

    try {
      // 백업 기록 조회
      const { data: backupRecord, error: fetchError } = await this.supabase
        .from('backup_records')
        .select('*')
        .eq('id', backupId)
        .eq('status', 'completed')
        .single()

      if (fetchError || !backupRecord) {
        throw new Error('Backup record not found or not completed')
      }

      // 복구 로그 생성
      const { error: logError } = await this.supabase
        .from('backup_restore_logs')
        .insert({
          id: restoreId,
          backup_record_id: backupId,
          status: 'in_progress',
          restore_point: new Date().toISOString()
        })

      if (logError) {
        throw new Error(`Failed to create restore log: ${logError.message}`)
      }

      // 백업 파일 유효성 검증
      const validation = await this.validateBackup(backupId)
      if (!validation.isValid) {
        throw new Error(`Backup validation failed: ${validation.errorMessage}`)
      }

      // 데이터베이스 복구 실행
      const restoredTables = await this.performDatabaseRestore(backupRecord.file_path)
      const duration = Date.now() - startTime

      // 복구 로그 업데이트
      await this.supabase
        .from('backup_restore_logs')
        .update({
          status: 'completed',
          duration_ms: duration,
          restored_tables: restoredTables,
          completed_at: new Date().toISOString()
        })
        .eq('id', restoreId)

      return {
        id: restoreId,
        backupRecordId: backupId,
        status: 'success',
        duration,
        restoredTables
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // 실패한 복구 로그 업데이트
      await this.supabase
        .from('backup_restore_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          duration_ms: duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', restoreId)

      throw new Error(`Restore failed: ${errorMessage}`)
    }
  }

  private async performDatabaseRestore(filePath: string): Promise<string[]> {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured')
    }

    // 백업 파일 존재 확인
    try {
      await fs.access(filePath)
    } catch (error) {
      throw new Error(`Backup file not found: ${filePath}`)
    }

    // 데이터베이스 복구 실행
    const command = `psql "${dbUrl}" -f "${filePath}"`
    
    try {
      const { stdout, stderr } = await execAsync(command)
      
      // 복구된 테이블 목록 추출 (간단한 구현)
      const restoredTables = this.extractTableNames(stdout)
      
      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Restore warnings:', stderr)
      }

      return restoredTables
    } catch (error) {
      throw new Error(`Database restore command failed: ${error}`)
    }
  }

  private extractTableNames(output: string): string[] {
    // SQL 출력에서 테이블 이름 추출 (간단한 정규식 사용)
    const tableMatches = output.match(/CREATE TABLE (\w+)/g) || []
    return tableMatches.map(match => match.replace('CREATE TABLE ', ''))
  }

  async validateBackup(backupId: string): Promise<ValidationResult> {
    try {
      const { data: backupRecord, error } = await this.supabase
        .from('backup_records')
        .select('*')
        .eq('id', backupId)
        .single()

      if (error || !backupRecord) {
        return {
          isValid: false,
          checksum: '',
          fileSize: 0,
          errorMessage: 'Backup record not found'
        }
      }

      // 파일 존재 확인
      try {
        const stats = await fs.stat(backupRecord.file_path)
        
        // 파일 크기 검증
        if (backupRecord.file_size && stats.size !== backupRecord.file_size) {
          return {
            isValid: false,
            checksum: '',
            fileSize: stats.size,
            errorMessage: 'File size mismatch'
          }
        }

        // 체크섬 검증
        const currentChecksum = await this.calculateChecksum(backupRecord.file_path)
        if (backupRecord.checksum && currentChecksum !== backupRecord.checksum) {
          return {
            isValid: false,
            checksum: currentChecksum,
            fileSize: stats.size,
            errorMessage: 'Checksum mismatch'
          }
        }

        return {
          isValid: true,
          checksum: currentChecksum,
          fileSize: stats.size
        }

      } catch (fileError) {
        return {
          isValid: false,
          checksum: '',
          fileSize: 0,
          errorMessage: 'Backup file not accessible'
        }
      }

    } catch (error) {
      return {
        isValid: false,
        checksum: '',
        fileSize: 0,
        errorMessage: error instanceof Error ? error.message : 'Validation error'
      }
    }
  }

  async listBackups(filter?: BackupFilter): Promise<BackupInfo[]> {
    let query = this.supabase
      .from('backup_records')
      .select('*')

    if (filter?.type) {
      query = query.eq('type', filter.type)
    }

    if (filter?.status) {
      query = query.eq('status', filter.status)
    }

    if (filter?.startDate) {
      query = query.gte('created_at', filter.startDate.toISOString())
    }

    if (filter?.endDate) {
      query = query.lte('created_at', filter.endDate.toISOString())
    }

    query = query.order('created_at', { ascending: false })

    if (filter?.limit) {
      query = query.limit(filter.limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to list backups: ${error.message}`)
    }

    return data.map(record => ({
      id: record.id,
      type: record.type,
      status: record.status,
      filePath: record.file_path,
      fileSize: record.file_size,
      checksum: record.checksum,
      createdAt: new Date(record.created_at),
      completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
      duration: record.duration_ms
    }))
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256')
    const fileBuffer = await fs.readFile(filePath)
    hash.update(fileBuffer)
    return hash.digest('hex')
  }

  private async loadScheduledBackups(): Promise<void> {
    try {
      const { data: schedules, error } = await this.supabase
        .from('backup_schedules')
        .select('*')
        .eq('is_active', true)

      if (error) {
        console.error('Failed to load backup schedules:', error)
        return
      }

      for (const schedule of schedules) {
        await this.scheduleBackup({
          id: schedule.id,
          name: schedule.name,
          type: schedule.type,
          cronExpression: schedule.cron_expression,
          isActive: schedule.is_active,
          retentionDays: schedule.retention_days,
          lastRunAt: schedule.last_run_at ? new Date(schedule.last_run_at) : undefined,
          nextRunAt: schedule.next_run_at ? new Date(schedule.next_run_at) : undefined
        })
      }

      console.log(`Loaded ${schedules.length} backup schedules`)
    } catch (error) {
      console.error('Error loading backup schedules:', error)
    }
  }

  async cleanupOldBackups(): Promise<number> {
    try {
      // 데이터베이스에서 정리 함수 실행
      const { data, error } = await this.supabase.rpc('cleanup_old_backups')

      if (error) {
        throw new Error(`Cleanup function failed: ${error.message}`)
      }

      // 실제 파일 정리
      const { data: oldBackups } = await this.supabase
        .from('backup_records')
        .select('file_path')
        .eq('status', 'completed')
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (oldBackups) {
        for (const backup of oldBackups) {
          try {
            await fs.unlink(backup.file_path)
          } catch (fileError) {
            console.warn(`Failed to delete backup file: ${backup.file_path}`, fileError)
          }
        }
      }

      return data || 0
    } catch (error) {
      console.error('Backup cleanup failed:', error)
      return 0
    }
  }

  async getBackupStatistics() {
    const { data, error } = await this.supabase
      .from('backup_statistics')
      .select('*')

    if (error) {
      throw new Error(`Failed to get backup statistics: ${error.message}`)
    }

    return data
  }

  // 스케줄러 정리
  destroy(): void {
    for (const [scheduleId, task] of this.scheduledJobs) {
      task.stop()
      this.scheduledJobs.delete(scheduleId)
    }
  }
}

export function createBackupService(supabase: SupabaseClient<Database>): BackupService {
  return new BackupService(supabase)
}

export function getBackupService(): BackupService | null {
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return null
  }
  return new BackupService(supabase)
}

export default BackupService