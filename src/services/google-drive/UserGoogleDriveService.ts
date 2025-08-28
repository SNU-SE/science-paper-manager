import { getSupabaseClient } from '@/lib/database'
import { UserGoogleDriveSettings, UserGoogleDriveSettingsInsert, UserGoogleDriveSettingsUpdate } from '@/lib/database'
import { GoogleDriveService } from '@/lib/google-drive'

export interface UserGoogleDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  refreshToken?: string
  rootFolderId?: string
}

export class UserGoogleDriveService {
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
      console.error('Error getting user Google Drive settings:', error)
      throw error
    }
  }

  /**
   * Save or update user's Google Drive settings
   */
  async saveUserSettings(
    userId: string,
    config: UserGoogleDriveConfig
  ): Promise<UserGoogleDriveSettings> {
    try {
      // First, deactivate any existing active settings
      await this.supabase
        .from('user_google_drive_settings')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)

      // Insert new active settings
      const settingsData: UserGoogleDriveSettingsInsert = {
        user_id: userId,
        client_id: config.clientId,
        client_secret: config.clientSecret, // Should be encrypted in production
        redirect_uri: config.redirectUri,
        refresh_token: config.refreshToken || null,
        root_folder_id: config.rootFolderId || null,
        is_active: true
      }

      const { data, error } = await this.supabase
        .from('user_google_drive_settings')
        .insert(settingsData)
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
   * Update user's tokens after OAuth
   */
  async updateUserTokens(
    userId: string,
    tokens: {
      refreshToken?: string
      accessToken?: string
      expiryDate?: Date
    }
  ): Promise<void> {
    try {
      const updateData: UserGoogleDriveSettingsUpdate = {
        updated_at: new Date().toISOString()
      }

      if (tokens.refreshToken) {
        updateData.refresh_token = tokens.refreshToken
      }
      if (tokens.accessToken) {
        updateData.access_token = tokens.accessToken
      }
      if (tokens.expiryDate) {
        updateData.token_expiry = tokens.expiryDate.toISOString()
      }

      const { error } = await this.supabase
        .from('user_google_drive_settings')
        .update(updateData)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating user tokens:', error)
      throw error
    }
  }

  /**
   * Create GoogleDriveService instance for user
   */
  async createGoogleDriveService(userId: string): Promise<GoogleDriveService | null> {
    try {
      const settings = await this.getUserSettings(userId)
      
      if (!settings) {
        return null
      }

      const config = {
        clientId: settings.client_id,
        clientSecret: settings.client_secret,
        redirectUri: settings.redirect_uri,
        refreshToken: settings.refresh_token || undefined
      }

      return new GoogleDriveService(config)
    } catch (error) {
      console.error('Error creating Google Drive service for user:', error)
      throw error
    }
  }

  /**
   * Test user's Google Drive connection
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      const driveService = await this.createGoogleDriveService(userId)
      
      if (!driveService) {
        return false
      }

      // Try to list files to test connection
      await driveService.listFiles(undefined, undefined)
      return true
    } catch (error) {
      console.error('Google Drive connection test failed:', error)
      return false
    }
  }

  /**
   * Delete user's Google Drive settings
   */
  async deleteUserSettings(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_google_drive_settings')
        .delete()
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
   * Get all users with Google Drive settings (admin only)
   */
  async getAllUsersWithSettings(): Promise<UserGoogleDriveSettings[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_google_drive_settings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error getting all users with Google Drive settings:', error)
      throw error
    }
  }
}