'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw, Activity, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/AuthProvider'
import { UserZoteroService, ZoteroConfig as ZoteroConfigType, ZoteroSettingsInfo } from '@/services/settings/UserZoteroService'
import { useSettingsValidation, useSettingsSave } from '@/hooks/useSettingsValidation'
import { SettingsValidationFeedback } from '@/components/settings/SettingsValidationFeedback'

interface ZoteroConfigProps {
  onConfigured?: (settings: ZoteroSettingsInfo) => void
}

const ZoteroConfig = memo(({ onConfigured }: ZoteroConfigProps) => {
  const [config, setConfig] = useState<ZoteroConfigType>({
    apiKey: '',
    userIdZotero: '',
    libraryType: 'user',
    libraryId: '',
    autoSync: false,
    syncInterval: 3600
  })
  const [settings, setSettings] = useState<ZoteroSettingsInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [libraryInfo, setLibraryInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const zoteroService = new UserZoteroService()
  
  // Enhanced validation and error handling
  const { validateSetting, validationState, retryValidation, clearValidation, isRetryable } = useSettingsValidation()
  const { saveSettings, saveState } = useSettingsSave()

  useEffect(() => {
    if (user) {
      loadZoteroSettings()
    }
  }, [user])

  const loadZoteroSettings = useCallback(async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      const userSettings = await zoteroService.getUserZoteroSettings(user.id)
      
      if (userSettings) {
        setSettings(userSettings)
        setConfig({
          apiKey: '', // Don't show the actual API key
          userIdZotero: userSettings.userIdZotero,
          libraryType: userSettings.libraryType,
          libraryId: userSettings.libraryId || '',
          autoSync: userSettings.autoSync,
          syncInterval: userSettings.syncInterval
        })
        
        // Load library info if configured
        const info = await zoteroService.getZoteroLibraryInfo(user.id)
        setLibraryInfo(info)
        
        onConfigured?.(userSettings)
      }
    } catch (error) {
      console.error('Error loading Zotero settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load Zotero settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [user, zoteroService, toast, onConfigured])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !config.apiKey.trim()) return
    
    setError(null)
    
    // Create save operation function
    const saveZoteroConfig = async () => {
      // Validate form data
      if (!config.userIdZotero.trim()) {
        throw new Error('User ID is required')
      }
      
      if (!/^\d+$/.test(config.userIdZotero.trim())) {
        throw new Error('User ID must be a numeric value')
      }
      
      if (config.apiKey.length < 32) {
        throw new Error('API key must be at least 32 characters long')
      }
      
      if (config.libraryType === 'group' && !config.libraryId?.trim()) {
        throw new Error('Group Library ID is required for group libraries')
      }
      
      if (config.libraryType === 'group' && config.libraryId && !/^\d+$/.test(config.libraryId.trim())) {
        throw new Error('Group Library ID must be a numeric value')
      }

      // First test the connection before saving
      const testConfig = {
        ...config,
        userIdZotero: config.userIdZotero.trim(),
        libraryId: config.libraryId?.trim() || null
      }
      
      // Test API key validity by making a simple request
      const baseUrl = testConfig.libraryType === 'group' && testConfig.libraryId
        ? `https://api.zotero.org/groups/${testConfig.libraryId}`
        : `https://api.zotero.org/users/${testConfig.userIdZotero}`

      const testResponse = await fetch(`${baseUrl}/items?limit=1`, {
        headers: {
          'Zotero-API-Key': testConfig.apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!testResponse.ok) {
        if (testResponse.status === 403) {
          throw new Error('Invalid API key or insufficient permissions')
        } else if (testResponse.status === 404) {
          throw new Error('User ID or Library ID not found')
        } else if (testResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before trying again.')
        } else {
          throw new Error(`API validation failed (${testResponse.status}): ${testResponse.statusText}`)
        }
      }
      
      // Save the settings
      const savedSettings = await zoteroService.saveZoteroSettings(user.id, testConfig)
      
      // Load library info
      const info = await zoteroService.getZoteroLibraryInfo(user.id)
      setLibraryInfo(info)
      
      return savedSettings
    }

    // Use enhanced save with retry capability
    const result = await saveSettings(
      saveZoteroConfig,
      { provider: 'Zotero', operation: 'save' },
      {
        showToast: true,
        onSuccess: (savedSettings) => {
          setSettings(savedSettings)
          setError(null)
          onConfigured?.(savedSettings)
        },
        onError: (error) => {
          setError(error.message)
        }
      }
    )
  }

  const handleDisconnect = async () => {
    if (!user) return
    
    const disconnectZotero = async () => {
      await zoteroService.deleteZoteroSettings(user.id)
      return true
    }

    const result = await saveSettings(
      disconnectZotero,
      { provider: 'Zotero', operation: 'disconnect' },
      {
        showToast: true,
        onSuccess: () => {
          setSettings(null)
          setLibraryInfo(null)
          setConfig({
            apiKey: '',
            userIdZotero: '',
            libraryType: 'user',
            libraryId: '',
            autoSync: false,
            syncInterval: 3600
          })
          clearValidation()
          setError(null)
        }
      }
    )
  }
  
  const handleTestConnection = async () => {
    if (!user) return
    
    // Clear previous errors
    setError(null)
    clearValidation()
    
    // Create test function for validation
    const testZoteroConnection = async (): Promise<boolean> => {
      // Validate form data
      if (!config.userIdZotero.trim()) {
        throw new Error('User ID is required')
      }
      
      if (!/^\d+$/.test(config.userIdZotero.trim())) {
        throw new Error('User ID must be a numeric value')
      }
      
      if (!config.apiKey.trim()) {
        throw new Error('API key is required')
      }
      
      if (config.apiKey.length < 32) {
        throw new Error('API key must be at least 32 characters long')
      }
      
      if (config.libraryType === 'group' && !config.libraryId?.trim()) {
        throw new Error('Group Library ID is required for group libraries')
      }
      
      if (config.libraryType === 'group' && config.libraryId && !/^\d+$/.test(config.libraryId.trim())) {
        throw new Error('Group Library ID must be a numeric value')
      }
      
      // Test connection with current form data
      const testConfig = {
        ...config,
        userIdZotero: config.userIdZotero.trim(),
        libraryId: config.libraryId?.trim() || null
      }
      
      const baseUrl = testConfig.libraryType === 'group' && testConfig.libraryId
        ? `https://api.zotero.org/groups/${testConfig.libraryId}`
        : `https://api.zotero.org/users/${testConfig.userIdZotero}`

      const response = await fetch(`${baseUrl}/items?limit=1`, {
        headers: {
          'Zotero-API-Key': testConfig.apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Invalid API key or insufficient permissions')
        } else if (response.status === 404) {
          throw new Error('User ID or Library ID not found')
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before trying again.')
        } else {
          throw new Error(`API error (${response.status}): ${response.statusText}`)
        }
      }
      
      return true
    }

    // Use enhanced validation with retry capability
    await validateSetting(
      testZoteroConnection,
      { provider: 'Zotero', field: 'connection' },
      {
        showToast: true,
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 2000,
        onSuccess: () => {
          setError(null)
        },
        onError: (error) => {
          setError(error.message)
        }
      }
    )
  }
  
  const handleSyncSettingsUpdate = async (autoSync: boolean, syncInterval?: number) => {
    if (!user) return
    
    try {
      await zoteroService.updateSyncSettings(user.id, {
        autoSync,
        ...(syncInterval !== undefined && { syncInterval })
      })
      
      // Reload settings
      await loadZoteroSettings()
      
      toast({
        title: 'Settings Updated',
        description: 'Sync settings have been updated'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update sync settings',
        variant: 'destructive'
      })
    }
  }
  
  const handleTriggerSync = async () => {
    if (!user) return
    
    try {
      await zoteroService.triggerSync(user.id)
      
      toast({
        title: 'Sync Started',
        description: 'Manual sync has been triggered'
      })
      
      // Reload settings to show updated status
      setTimeout(() => loadZoteroSettings(), 1000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to trigger sync',
        variant: 'destructive'
      })
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <div className="text-lg font-medium">Loading Zotero Settings...</div>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-medium">Please sign in</div>
        <div className="text-sm text-gray-600 mt-2">You need to be signed in to configure Zotero</div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Zotero Integration
          {settings ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </CardTitle>
        <CardDescription>
          Connect your Zotero library to sync papers and metadata automatically.
          <div className="mt-2 flex flex-wrap gap-2">
            <a 
              href="https://www.zotero.org/settings/keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              Get API Key <ExternalLink className="h-3 w-3" />
            </a>
            <a 
              href="https://www.zotero.org/settings/account" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              Find User ID <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Enhanced validation feedback */}
        {(validationState.error || validationState.isValidating || validationState.isValid !== null) && (
          <div className="mb-4">
            <SettingsValidationFeedback
              validationState={validationState}
              onRetry={retryValidation}
              showRetryButton={true}
              showLastValidated={true}
            />
          </div>
        )}

        {settings ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    ✓ Zotero is connected
                    <Badge variant={settings.syncStatus === 'completed' ? 'default' : settings.syncStatus === 'syncing' ? 'secondary' : 'destructive'}>
                      {settings.syncStatus}
                    </Badge>
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    User ID: {settings.userIdZotero} | Library: {settings.libraryType}
                    {settings.lastSyncAt && (
                      <span className="ml-2">| Last sync: {settings.lastSyncAt.toLocaleString()}</span>
                    )}
                  </p>
                </div>
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  size="sm"
                  disabled={validationState.isValidating}
                >
                  {validationState.isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Test Connection</>
                  )}
                </Button>
              </div>
            </div>
            
            {libraryInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">{libraryInfo.totalItems}</div>
                  <div className="text-sm text-blue-600">Total Items</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="text-2xl font-bold text-green-700">{libraryInfo.collections}</div>
                  <div className="text-sm text-green-600">Collections</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-purple-50 border-purple-200">
                  <div className="text-2xl font-bold text-purple-700">
                    {libraryInfo.lastModified ? '✓' : '—'}
                  </div>
                  <div className="text-sm text-purple-600">Connected</div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto Sync</Label>
                  <p className="text-sm text-gray-600">Automatically sync your Zotero library</p>
                </div>
                <Switch
                  checked={settings.autoSync}
                  onCheckedChange={(checked) => handleSyncSettingsUpdate(checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sync Interval (seconds)</Label>
                <Input
                  type="number"
                  value={settings.syncInterval}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (value >= 60) {
                      handleSyncSettingsUpdate(settings.autoSync, value)
                    }
                  }}
                  min="60"
                  step="60"
                />
                <p className="text-sm text-gray-500">Minimum 60 seconds</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleTriggerSync}
                variant="default"
                disabled={settings.syncStatus === 'syncing'}
              >
                {settings.syncStatus === 'syncing' ? (
                  <>
                    <Activity className="mr-2 h-4 w-4 animate-pulse" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDisconnect} 
                variant="outline"
                disabled={saveState.isSaving}
              >
                {saveState.isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userIdZotero">User ID</Label>
              <Input
                id="userIdZotero"
                type="text"
                placeholder="Your Zotero User ID (e.g., 123456)"
                value={config.userIdZotero}
                onChange={(e) => setConfig(prev => ({ ...prev, userIdZotero: e.target.value.trim() }))}
                required
                pattern="[0-9]+"
                title="User ID should contain only numbers"
              />
              <p className="text-sm text-gray-500">
                Find your User ID in your Zotero account settings. It's a numeric ID like 123456.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your Zotero API Key"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value.trim() }))}
                required
                minLength={32}
                title="API key should be at least 32 characters long"
              />
              <p className="text-sm text-gray-500">
                Create a new API key with library read permissions. The key should be at least 32 characters long.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="libraryType">Library Type</Label>
              <Select 
                value={config.libraryType} 
                onValueChange={(value: 'user' | 'group') => 
                  setConfig(prev => ({ ...prev, libraryType: value }))
                }
              >
                <SelectTrigger id="libraryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Personal Library</SelectItem>
                  <SelectItem value="group">Group Library</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.libraryType === 'group' && (
              <div className="space-y-2">
                <Label htmlFor="libraryId">Group Library ID</Label>
                <Input
                  id="libraryId"
                  type="text"
                  placeholder="Group Library ID (e.g., 123456)"
                  value={config.libraryId}
                  onChange={(e) => setConfig(prev => ({ ...prev, libraryId: e.target.value.trim() }))}
                  required={config.libraryType === 'group'}
                  pattern="[0-9]+"
                  title="Group Library ID should contain only numbers"
                />
                <p className="text-sm text-gray-500">
                  Find the Group Library ID in your Zotero group settings. It's a numeric ID.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto Sync</Label>
                  <p className="text-sm text-gray-600">Enable automatic syncing</p>
                </div>
                <Switch
                  checked={config.autoSync}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoSync: checked }))}
                />
              </div>
              
              {config.autoSync && (
                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (seconds)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    value={config.syncInterval}
                    onChange={(e) => setConfig(prev => ({ ...prev, syncInterval: parseInt(e.target.value) || 3600 }))}
                    min="60"
                    step="60"
                  />
                  <p className="text-sm text-gray-500">Minimum 60 seconds</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={validationState.isValidating || saveState.isSaving || !config.apiKey.trim() || !config.userIdZotero.trim()}
                className="flex-1"
              >
                {validationState.isValidating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>Test Connection</>
                )}
              </Button>
              
              <Button 
                type="submit" 
                disabled={validationState.isValidating || saveState.isSaving || !config.apiKey.trim() || !config.userIdZotero.trim()} 
                className="flex-1"
              >
                {saveState.isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Zotero
              </Button>
            </div>
            
            {/* Help Section */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Setup Instructions:</p>
                  <ol className="text-sm space-y-1 ml-4 list-decimal">
                    <li>Go to <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Zotero API Keys</a> and create a new key</li>
                    <li>Grant "Allow library access" permission (read access is sufficient)</li>
                    <li>Find your User ID in <a href="https://www.zotero.org/settings/account" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Account Settings</a></li>
                    <li>Test the connection before saving to ensure everything works</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          </form>
        )}
      </CardContent>
    </Card>
  )
})

ZoteroConfig.displayName = 'ZoteroConfig'

export { ZoteroConfig }