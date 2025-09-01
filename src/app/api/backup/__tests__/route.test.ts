import { GET, POST } from '../route'
import { NextRequest } from 'next/server'
import { BackupService } from '@/services/backup/BackupService'

// Mock the BackupService
jest.mock('@/services/backup/BackupService')

const mockBackupService = {
  listBackups: jest.fn(),
  createBackup: jest.fn()
}

// Mock the BackupService constructor
const MockedBackupService = BackupService as jest.MockedClass<typeof BackupService>
MockedBackupService.mockImplementation(() => mockBackupService as any)

describe('/api/backup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return list of backups', async () => {
      const mockBackups = [
        {
          id: 'backup-1',
          type: 'full',
          status: 'completed',
          filePath: '/tmp/backup1.sql',
          fileSize: 1024,
          createdAt: new Date('2024-01-01'),
          duration: 30000
        }
      ]

      mockBackupService.listBackups.mockResolvedValue(mockBackups)

      const request = new NextRequest('http://localhost:3000/api/backup')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: mockBackups,
        count: 1
      })
    })

    it('should handle query parameters', async () => {
      mockBackupService.listBackups.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/backup?type=full&status=completed&limit=10')
      await GET(request)

      expect(mockBackupService.listBackups).toHaveBeenCalledWith({
        type: 'full',
        status: 'completed',
        limit: 10
      })
    })

    it('should handle service errors', async () => {
      mockBackupService.listBackups.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/backup')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Service error'
      })
    })
  })

  describe('POST', () => {
    it('should create a new backup', async () => {
      const mockResult = {
        id: 'backup-123',
        type: 'full',
        size: 1024,
        duration: 30000,
        checksum: 'test-checksum',
        createdAt: new Date(),
        status: 'success',
        filePath: '/tmp/backup.sql'
      }

      mockBackupService.createBackup.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({ type: 'full' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        data: mockResult,
        message: 'full backup created successfully'
      })
      expect(mockBackupService.createBackup).toHaveBeenCalledWith('full')
    })

    it('should validate backup type', async () => {
      const request = new NextRequest('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({ type: 'invalid' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({
        success: false,
        error: 'Invalid backup type. Must be one of: full, incremental, differential'
      })
    })

    it('should require authorization', async () => {
      const request = new NextRequest('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'full' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data).toEqual({
        success: false,
        error: 'Authorization required'
      })
    })

    it('should handle service errors', async () => {
      mockBackupService.createBackup.mockRejectedValue(new Error('Backup failed'))

      const request = new NextRequest('http://localhost:3000/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token'
        },
        body: JSON.stringify({ type: 'full' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({
        success: false,
        error: 'Backup failed'
      })
    })
  })
})