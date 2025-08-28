import { getSupabaseClient } from '@/lib/database'
import { UserZoteroSettings, UserZoteroSettingsInsert, UserZoteroSettingsUpdate } from '@/lib/database'
import CryptoJS from 'crypto-js'

export interface ZoteroConfig {
  apiKey: string
  userIdZotero: string
  libraryType?: 'user' | 'group'
  libraryId?: string
  autoSync?: boolean
  syncInterval?: number
}

export interface ZoteroSettingsInfo {
  id: string
  userIdZotero: string
  libraryType: 'user' | 'group'
  libraryId: string | null
  autoSync: boolean
  syncInterval: number
  lastSyncAt: Date | null
  syncStatus: 'inactive' | 'syncing' | 'completed' | 'failed'
  isActive: boolean
  hasApiKey: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserZoteroService {
  private supabase = getSupabaseClient()
  private readonly encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'fallback-key-for-development'

  /**
   * Encrypt API key for storage
   */
  private encryptApiKey(apiKey: string): string {
    return CryptoJS.AES.encrypt(apiKey, this.encryptionKey).toString()
  }

  /**
   * Decrypt API key for use
   */
  private decryptApiKey(encryptedKey: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, this.encryptionKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  }

  /**
   * Get user's Zotero settings
   */
  async getUserZoteroSettings(userId: string): Promise<ZoteroSettingsInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_zotero_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        return null
      }

      return {
        id: data.id,
        userIdZotero: data.user_id_zotero,
        libraryType: data.library_type as 'user' | 'group',
        libraryId: data.library_id,
        autoSync: data.auto_sync,
        syncInterval: data.sync_interval,
        lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : null,
        syncStatus: data.sync_status as 'inactive' | 'syncing' | 'completed' | 'failed',
        isActive: data.is_active,
        hasApiKey: true,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Error getting user Zotero settings:', error)
      throw error
    }
  }

  /**
   * Get decrypted Zotero API key
   */
  async getZoteroApiKey(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_zotero_settings')
        .select('api_key_encrypted')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        return null
      }

      return this.decryptApiKey(data.api_key_encrypted)
    } catch (error) {
      console.error('Error getting Zotero API key:', error)
      throw error
    }
  }

  /**
   * Save or update user's Zotero settings
   */
  async saveZoteroSettings(userId: string, config: ZoteroConfig): Promise<ZoteroSettingsInfo> {
    try {
      const encryptedKey = this.encryptApiKey(config.apiKey)

      // First, deactivate any existing active settings
      await this.supabase
        .from('user_zotero_settings')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)

      // Insert new active settings
      const settingsData: UserZoteroSettingsInsert = {
        user_id: userId,
        api_key_encrypted: encryptedKey,
        user_id_zotero: config.userIdZotero,
        library_type: config.libraryType || 'user',
        library_id: config.libraryId || null,
        auto_sync: config.autoSync || false,
        sync_interval: config.syncInterval || 3600,
        is_active: true
      }

      const { data, error } = await this.supabase
        .from('user_zotero_settings')
        .insert(settingsData)
        .select()
        .single()

      if (error) {
        throw error
      }

      return {
        id: data.id,
        userIdZotero: data.user_id_zotero,
        libraryType: data.library_type as 'user' | 'group',
        libraryId: data.library_id,
        autoSync: data.auto_sync,
        syncInterval: data.sync_interval,
        lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : null,
        syncStatus: data.sync_status as 'inactive' | 'syncing' | 'completed' | 'failed',
        isActive: data.is_active,
        hasApiKey: true,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }
    } catch (error) {
      console.error('Error saving Zotero settings:', error)
      throw error
    }
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(
    userId: string,
    settings: {
      autoSync?: boolean
      syncInterval?: number
    }
  ): Promise<void> {
    try {
      const updateData: UserZoteroSettingsUpdate = {
        updated_at: new Date().toISOString()
      }

      if (settings.autoSync !== undefined) {
        updateData.auto_sync = settings.autoSync
      }
      if (settings.syncInterval !== undefined) {
        updateData.sync_interval = settings.syncInterval
      }

      const { error } = await this.supabase
        .from('user_zotero_settings')
        .update(updateData)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating sync settings:', error)
      throw error
    }
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    userId: string,
    status: 'inactive' | 'syncing' | 'completed' | 'failed',
    lastSyncAt?: Date
  ): Promise<void> {
    try {
      const updateData: UserZoteroSettingsUpdate = {
        sync_status: status,
        updated_at: new Date().toISOString()
      }

      if (lastSyncAt) {
        updateData.last_sync_at = lastSyncAt.toISOString()
      }

      const { error } = await this.supabase
        .from('user_zotero_settings')
        .update(updateData)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating sync status:', error)
      throw error
    }
  }

  /**
   * Test Zotero API connection
   */
  async testZoteroConnection(userId: string): Promise<boolean> {
    try {
      const apiKey = await this.getZoteroApiKey(userId)
      const settings = await this.getUserZoteroSettings(userId)
      
      if (!apiKey || !settings) {
        return false
      }

      // Test API key with a simple request to get user info
      const baseUrl = settings.libraryType === 'group' && settings.libraryId
        ? `https://api.zotero.org/groups/${settings.libraryId}`
        : `https://api.zotero.org/users/${settings.userIdZotero}`

      const response = await fetch(`${baseUrl}/items?limit=1`, {
        headers: {
          'Zotero-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      })

      return response.status === 200
    } catch (error) {
      console.error('Zotero connection test failed:', error)
      return false
    }
  }

  /**
   * Get Zotero library info
   */
  async getZoteroLibraryInfo(userId: string): Promise<{
    totalItems: number
    collections: number
    lastModified: Date | null
  } | null> {
    try {
      const apiKey = await this.getZoteroApiKey(userId)
      const settings = await this.getUserZoteroSettings(userId)
      
      if (!apiKey || !settings) {
        return null
      }

      const baseUrl = settings.libraryType === 'group' && settings.libraryId
        ? `https://api.zotero.org/groups/${settings.libraryId}`
        : `https://api.zotero.org/users/${settings.userIdZotero}`

      // Get total items count
      const itemsResponse = await fetch(`${baseUrl}/items?limit=1`, {
        headers: {
          'Zotero-API-Key': apiKey
        }
      })

      if (!itemsResponse.ok) {
        return null
      }

      const totalItems = parseInt(itemsResponse.headers.get('Total-Results') || '0')
      const lastModifiedHeader = itemsResponse.headers.get('Last-Modified-Version')
      
      // Get collections count
      const collectionsResponse = await fetch(`${baseUrl}/collections?limit=1`, {
        headers: {
          'Zotero-API-Key': apiKey
        }
      })

      const collections = collectionsResponse.ok 
        ? parseInt(collectionsResponse.headers.get('Total-Results') || '0')
        : 0

      return {
        totalItems,
        collections,
        lastModified: lastModifiedHeader ? new Date() : null
      }
    } catch (error) {
      console.error('Error getting Zotero library info:', error)
      return null
    }
  }

  /**
   * Delete Zotero settings
   */
  async deleteZoteroSettings(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_zotero_settings')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting Zotero settings:', error)
      throw error
    }
  }

  /**
   * Trigger manual sync
   */
  async triggerSync(userId: string): Promise<void> {
    try {
      await this.updateSyncStatus(userId, 'syncing')
      
      // Here you would implement the actual sync logic
      // For now, we'll just simulate a sync operation
      
      // This would typically involve:
      // 1. Fetching items from Zotero API
      // 2. Comparing with local database
      // 3. Importing new items
      // 4. Updating existing items
      // 5. Handling deletions
      
      // Simulate sync completion
      setTimeout(async () => {
        try {
          await this.updateSyncStatus(userId, 'completed', new Date())
        } catch (error) {
          console.error('Error updating sync completion status:', error)
        }
      }, 5000)
      
    } catch (error) {
      await this.updateSyncStatus(userId, 'failed')
      console.error('Error triggering Zotero sync:', error)
      throw error
    }
  }
}