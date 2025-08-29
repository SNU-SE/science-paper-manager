import { getSupabaseClient } from '@/lib/database'
import { UserGoogleDriveSettings, UserGoogleDriveSettingsInsert, UserGoogleDriveSettingsUpdate } from '@/lib/database'

export interface UserGoogleDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
  rootFolderId?: string
}

/**
 * Client-safe version of UserGoogleDriveService
 * Only handles database operations, no server-only Google API calls
 */
export class UserGoogleDriveServiceClient {
  private supabase = getSupabaseClient()

  /**
   * Get user's Google Drive settings
   */
  async getUserSettings(userId: string): Promise<UserGoogleDriveSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_google_drive_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      return data
    } catch (error) {
      console.error('Error fetching user Google Drive settings:', error)
      throw error
    }
  }

  /**
   * Save user's Google Drive settings
   */
  async saveUserSettings(userId: string, config: UserGoogleDriveConfig): Promise<UserGoogleDriveSettings> {
    try {
      const settingsData: UserGoogleDriveSettingsInsert = {
        user_id: userId,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        refresh_token: config.refreshToken || null,
        root_folder_id: config.rootFolderId || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Use upsert to handle both insert and update
      const { data, error } = await this.supabase
        .from('user_google_drive_settings')
        .upsert(settingsData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Error saving user Google Drive settings:', error)
      throw error
    }
  }

  /**
   * Update user's Google Drive settings
   */
  async updateUserSettings(userId: string, updates: Partial<UserGoogleDriveConfig>): Promise<UserGoogleDriveSettings> {
    try {
      const updateData: UserGoogleDriveSettingsUpdate = {
        updated_at: new Date().toISOString(),
        ...(updates.clientId && { client_id: updates.clientId }),
        ...(updates.clientSecret && { client_secret: updates.clientSecret }),
        ...(updates.redirectUri && { redirect_uri: updates.redirectUri }),
        ...(updates.refreshToken !== undefined && { refresh_token: updates.refreshToken || null }),
        ...(updates.rootFolderId !== undefined && { root_folder_id: updates.rootFolderId || null })
      }

      const { data, error } = await this.supabase
        .from('user_google_drive_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Error updating user Google Drive settings:', error)
      throw error
    }
  }

  /**
   * Delete user's Google Drive settings
   */
  async deleteUserSettings(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_google_drive_settings')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting user Google Drive settings:', error)
      throw error
    }
  }

  /**
   * Test connection via API route (client-safe)
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/google-drive/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        return false
      }

      const result = await response.json()
      return result.success === true
    } catch (error) {
      console.error('Error testing Google Drive connection:', error)
      return false
    }
  }
}