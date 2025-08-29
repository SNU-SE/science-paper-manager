'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/components/auth/AuthProvider'
import { UserGoogleDriveServiceClient, UserGoogleDriveConfig } from '@/services/google-drive/UserGoogleDriveService.client'
import { UserGoogleDriveSettings } from '@/lib/database'
import { 
  Save, 
  TestTube, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

export function GoogleDriveSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserGoogleDriveSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)

  // Form state
  const [formData, setFormData] = useState<UserGoogleDriveConfig>({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    refreshToken: '',
    rootFolderId: ''
  })

  const userGoogleDriveService = new UserGoogleDriveServiceClient()

  // Load user settings on mount
  useEffect(() => {
    if (user?.id) {
      loadUserSettings()
    }
  }, [user?.id])

  const loadUserSettings = async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const userSettings = await userGoogleDriveService.getUserSettings(user.id)
      
      setSettings(userSettings)
      
      if (userSettings) {
        setFormData({
          clientId: userSettings.client_id,
          clientSecret: userSettings.client_secret,
          redirectUri: userSettings.redirect_uri,
          refreshToken: userSettings.refresh_token || '',
          rootFolderId: userSettings.root_folder_id || ''
        })
      }
    } catch (error) {
      console.error('Error loading Google Drive settings:', error)
      toast.error('Failed to load Google Drive settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof UserGoogleDriveConfig, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user?.id) return

    // Validate required fields
    if (!formData.clientId || !formData.clientSecret || !formData.redirectUri) {
      toast.error('Please fill in all required fields (Client ID, Client Secret, Redirect URI)')
      return
    }

    try {
      setIsSaving(true)
      
      const config: UserGoogleDriveConfig = {
        clientId: formData.clientId.trim(),
        clientSecret: formData.clientSecret.trim(),
        redirectUri: formData.redirectUri.trim(),
        refreshToken: formData.refreshToken?.trim() || undefined,
        rootFolderId: formData.rootFolderId?.trim() || undefined
      }

      const savedSettings = await userGoogleDriveService.saveUserSettings(user.id, config)
      setSettings(savedSettings)
      setIsConnected(null) // Reset connection status
      
      toast.success('Google Drive settings saved successfully!')
    } catch (error) {
      console.error('Error saving Google Drive settings:', error)
      toast.error('Failed to save Google Drive settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!user?.id) return

    try {
      setIsTesting(true)
      const connectionResult = await userGoogleDriveService.testConnection(user.id)
      setIsConnected(connectionResult)
      
      if (connectionResult) {
        toast.success('Google Drive connection successful!')
      } else {
        toast.error('Google Drive connection failed. Please check your settings.')
      }
    } catch (error) {
      console.error('Error testing Google Drive connection:', error)
      setIsConnected(false)
      toast.error('Connection test failed')
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!user?.id || !settings) return

    const confirmed = confirm('Are you sure you want to delete your Google Drive settings? This action cannot be undone.')
    if (!confirmed) return

    try {
      await userGoogleDriveService.deleteUserSettings(user.id)
      setSettings(null)
      setFormData({
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        refreshToken: '',
        rootFolderId: ''
      })
      setIsConnected(null)
      
      toast.success('Google Drive settings deleted successfully')
    } catch (error) {
      console.error('Error deleting Google Drive settings:', error)
      toast.error('Failed to delete Google Drive settings')
    }
  }

  const getAuthUrl = async () => {
    try {
      // Call API route instead of direct service
      const response = await fetch('/api/google-drive/auth?action=auth-url', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL')
      }
      
      const { authUrl } = await response.json()
      window.open(authUrl, '_blank')
      toast.info('Complete the OAuth flow and copy the refresh token back here')
    } catch (error) {
      console.error('Error getting auth URL:', error)
      toast.error('Failed to generate auth URL. Please save your settings first.')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading Google Drive settings...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Google Drive Integration
              {isConnected === true && <CheckCircle className="h-5 w-5 text-green-500" />}
              {isConnected === false && <AlertCircle className="h-5 w-5 text-red-500" />}
            </CardTitle>
            <CardDescription>
              Configure your personal Google Drive API credentials for file uploads
            </CardDescription>
          </div>
          
          {settings && (
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected === true ? 'Connected' : isConnected === false ? 'Disconnected' : 'Unknown'}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>To set up Google Drive integration:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
              <li>Create a project and enable the Google Drive API</li>
              <li>Create OAuth 2.0 credentials (Web Application)</li>
              <li>Add your redirect URI to authorized redirects</li>
              <li>Copy the Client ID and Client Secret here</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID *</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="your-client-id.googleusercontent.com"
              value={formData.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret *</Label>
            <div className="relative">
              <Input
                id="clientSecret"
                type={showSecrets ? "text" : "password"}
                placeholder="Enter client secret"
                value={formData.clientSecret}
                onChange={(e) => handleInputChange('clientSecret', e.target.value)}
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Redirect URI */}
        <div className="space-y-2">
          <Label htmlFor="redirectUri">Redirect URI *</Label>
          <Input
            id="redirectUri"
            type="url"
            placeholder="https://your-app.vercel.app/auth/google-drive/callback"
            value={formData.redirectUri}
            onChange={(e) => handleInputChange('redirectUri', e.target.value)}
            disabled={isSaving}
          />
          <p className="text-sm text-gray-500">
            Add this exact URI to your Google Cloud Console OAuth credentials
          </p>
        </div>

        {/* Refresh Token */}
        <div className="space-y-2">
          <Label htmlFor="refreshToken">Refresh Token</Label>
          <div className="flex gap-2">
            <Input
              id="refreshToken"
              type={showSecrets ? "text" : "password"}
              placeholder="Obtain via OAuth flow"
              value={formData.refreshToken}
              onChange={(e) => handleInputChange('refreshToken', e.target.value)}
              disabled={isSaving}
            />
            <Button
              type="button"
              variant="outline"
              onClick={getAuthUrl}
              disabled={!formData.clientId || !formData.clientSecret}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            Click the external link button to generate an OAuth URL and get your refresh token
          </p>
        </div>

        {/* Root Folder ID */}
        <div className="space-y-2">
          <Label htmlFor="rootFolderId">Root Folder ID (Optional)</Label>
          <Input
            id="rootFolderId"
            type="text"
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={formData.rootFolderId}
            onChange={(e) => handleInputChange('rootFolderId', e.target.value)}
            disabled={isSaving}
          />
          <p className="text-sm text-gray-500">
            Specify a folder where all your papers will be uploaded. Leave empty for root directory.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.clientId || !formData.clientSecret}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>

            {settings && (
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
          </div>

          {settings && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        {/* Status Information */}
        {settings && (
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Configuration Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created:</span> {' '}
                {new Date(settings.created_at).toLocaleString()}
              </div>
              <div>
                <span className="text-gray-500">Last Updated:</span> {' '}
                {new Date(settings.updated_at).toLocaleString()}
              </div>
              <div>
                <span className="text-gray-500">Has Refresh Token:</span> {' '}
                <Badge variant={settings.refresh_token ? 'default' : 'secondary'}>
                  {settings.refresh_token ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">Root Folder:</span> {' '}
                {settings.root_folder_id || 'Default'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}