import { Paper } from '@/types'
import { ZoteroService, ZoteroSyncResult, ZoteroItem } from './ZoteroService'
import { supabase } from '@/lib/database'

export interface SyncStatus {
  isRunning: boolean
  lastSyncTime: Date | null
  lastSyncVersion: number
  totalItems: number
  errors: string[]
}

export class ZoteroSyncService {
  private zoteroService: ZoteroService
  private syncStatus: SyncStatus = {
    isRunning: false,
    lastSyncTime: null,
    lastSyncVersion: 0,
    totalItems: 0,
    errors: []
  }

  constructor(zoteroService: ZoteroService) {
    this.zoteroService = zoteroService
    this.loadSyncStatus()
  }

  /**
   * Perform full synchronization with Zotero
   */
  async performFullSync(): Promise<ZoteroSyncResult> {
    if (this.syncStatus.isRunning) {
      throw new Error('Sync already in progress')
    }

    if (!this.zoteroService.isConfigured()) {
      throw new Error('Zotero not configured')
    }

    this.syncStatus.isRunning = true
    this.syncStatus.errors = []

    try {
      console.log('Starting full Zotero sync...')
      
      // Fetch all items from Zotero
      const zoteroItems = await this.zoteroService.fetchAllItems()
      console.log(`Fetched ${zoteroItems.length} items from Zotero`)

      // Get current library version
      const currentVersion = await this.zoteroService.getLibraryVersion()

      // Process items
      const result = await this.processItems(zoteroItems)

      // Update sync status
      this.syncStatus.lastSyncTime = new Date()
      this.syncStatus.lastSyncVersion = currentVersion
      this.syncStatus.totalItems = zoteroItems.length
      this.saveSyncStatus()

      console.log('Full sync completed:', result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.syncStatus.errors.push(errorMessage)
      console.error('Full sync failed:', error)
      throw error
    } finally {
      this.syncStatus.isRunning = false
    }
  }

  /**
   * Perform incremental synchronization
   */
  async performIncrementalSync(): Promise<ZoteroSyncResult> {
    if (this.syncStatus.isRunning) {
      throw new Error('Sync already in progress')
    }

    if (!this.zoteroService.isConfigured()) {
      throw new Error('Zotero not configured')
    }

    this.syncStatus.isRunning = true
    this.syncStatus.errors = []

    try {
      console.log('Starting incremental Zotero sync...')
      
      // Get current library version
      const currentVersion = await this.zoteroService.getLibraryVersion()
      
      // If no previous sync or version hasn't changed, skip
      if (this.syncStatus.lastSyncVersion >= currentVersion) {
        console.log('No changes detected, skipping sync')
        return {
          totalItems: 0,
          newItems: 0,
          updatedItems: 0,
          errors: [],
          lastSyncTime: new Date()
        }
      }

      // Fetch only changed items
      const zoteroItems = await this.zoteroService.fetchAllItems(this.syncStatus.lastSyncVersion)
      console.log(`Fetched ${zoteroItems.length} changed items from Zotero`)

      // Process items
      const result = await this.processItems(zoteroItems)

      // Update sync status
      this.syncStatus.lastSyncTime = new Date()
      this.syncStatus.lastSyncVersion = currentVersion
      this.saveSyncStatus()

      console.log('Incremental sync completed:', result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.syncStatus.errors.push(errorMessage)
      console.error('Incremental sync failed:', error)
      throw error
    } finally {
      this.syncStatus.isRunning = false
    }
  }

  /**
   * Process Zotero items and update database
   */
  private async processItems(zoteroItems: ZoteroItem[]): Promise<ZoteroSyncResult> {
    let newItems = 0
    let updatedItems = 0
    const errors: string[] = []

    for (const zoteroItem of zoteroItems) {
      try {
        // Skip non-document items
        if (!this.isDocumentItem(zoteroItem)) {
          continue
        }

        // Convert to Paper format
        const paperData = this.zoteroService.convertToPaper(zoteroItem)
        
        // Check if paper already exists
        const existingPaper = await this.findExistingPaper(zoteroItem.key)

        if (existingPaper) {
          // Update existing paper
          await this.updatePaper(existingPaper.id, paperData)
          updatedItems++
          console.log(`Updated paper: ${paperData.title}`)
        } else {
          // Create new paper
          await this.createPaper(paperData)
          newItems++
          console.log(`Created new paper: ${paperData.title}`)
        }

      } catch (error) {
        const errorMessage = `Failed to process item ${zoteroItem.key}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMessage)
        console.error(errorMessage)
      }
    }

    return {
      totalItems: zoteroItems.length,
      newItems,
      updatedItems,
      errors,
      lastSyncTime: new Date()
    }
  }

  /**
   * Check if Zotero item is a document (paper)
   */
  private isDocumentItem(item: ZoteroItem): boolean {
    const documentTypes = [
      'journalArticle',
      'conferencePaper',
      'preprint',
      'report',
      'thesis',
      'book',
      'bookSection'
    ]
    return documentTypes.includes(item.itemType)
  }

  /**
   * Find existing paper by Zotero key
   */
  private async findExistingPaper(zoteroKey: string): Promise<Paper | null> {
    try {
      const { data, error } = await supabase
        .from('papers')
        .select('*')
        .eq('zotero_key', zoteroKey)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error
      }

      return data || null
    } catch (error) {
      console.error('Error finding existing paper:', error)
      return null
    }
  }

  /**
   * Create new paper in database
   */
  private async createPaper(paperData: Partial<Paper>): Promise<void> {
    const { error } = await supabase
      .from('papers')
      .insert({
        title: paperData.title,
        authors: paperData.authors,
        journal: paperData.journal,
        publication_year: paperData.publicationYear,
        doi: paperData.doi,
        abstract: paperData.abstract,
        zotero_key: paperData.zoteroKey,
        date_added: paperData.dateAdded?.toISOString(),
        last_modified: paperData.lastModified?.toISOString()
      })

    if (error) {
      throw new Error(`Failed to create paper: ${error.message}`)
    }
  }

  /**
   * Update existing paper in database
   */
  private async updatePaper(paperId: string, paperData: Partial<Paper>): Promise<void> {
    const { error } = await supabase
      .from('papers')
      .update({
        title: paperData.title,
        authors: paperData.authors,
        journal: paperData.journal,
        publication_year: paperData.publicationYear,
        doi: paperData.doi,
        abstract: paperData.abstract,
        last_modified: paperData.lastModified?.toISOString()
      })
      .eq('id', paperId)

    if (error) {
      throw new Error(`Failed to update paper: ${error.message}`)
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Load sync status from localStorage
   */
  private loadSyncStatus(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zotero-sync-status')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          this.syncStatus = {
            ...this.syncStatus,
            ...parsed,
            lastSyncTime: parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : null,
            isRunning: false // Always reset running status on load
          }
        } catch (error) {
          console.error('Failed to parse sync status:', error)
        }
      }
    }
  }

  /**
   * Save sync status to localStorage
   */
  private saveSyncStatus(): void {
    if (typeof window !== 'undefined') {
      const statusToSave = {
        ...this.syncStatus,
        isRunning: false // Don't persist running status
      }
      localStorage.setItem('zotero-sync-status', JSON.stringify(statusToSave))
    }
  }

  /**
   * Reset sync status
   */
  resetSyncStatus(): void {
    this.syncStatus = {
      isRunning: false,
      lastSyncTime: null,
      lastSyncVersion: 0,
      totalItems: 0,
      errors: []
    }
    this.saveSyncStatus()
  }
}

export const zoteroSyncService = new ZoteroSyncService(new ZoteroService())