'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/AuthProvider'
import { UserZoteroService, ZoteroConfig as ZoteroConfigType, ZoteroSettingsInfo } from '@/services/settings/UserZoteroService'

interface ZoteroConfigProps {
  onConfigured?: (settings: ZoteroSettingsInfo) => void
}

export function ZoteroConfig({ onConfigured }: ZoteroConfigProps) {
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
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [libraryInfo, setLibraryInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const zoteroService = new UserZoteroService()

  useEffect(() => {
    if (user) {
      loadZoteroSettings()
    }
  }, [user])

  const loadZoteroSettings = async () => {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !config.apiKey.trim()) return
    
    setIsSaving(true)
    setError(null)

    try {
      const savedSettings = await zoteroService.saveZoteroSettings(user.id, config)
      setSettings(savedSettings)
      
      // Load library info
      const info = await zoteroService.getZoteroLibraryInfo(user.id)
      setLibraryInfo(info)
      
      toast({
        title: 'Success',
        description: 'Zotero configured successfully'
      })
      onConfigured?.(savedSettings)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to configure Zotero'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!user) return
    
    setIsSaving(true)
    
    try {
      await zoteroService.deleteZoteroSettings(user.id)
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
      
      toast({
        title: 'Success',
        description: 'Zotero disconnected successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Zotero',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleTestConnection = async () => {
    if (!user) return
    
    setIsTestingConnection(true)
    
    try {
      const isConnected = await zoteroService.testZoteroConnection(user.id)
      
      toast({
        title: isConnected ? 'Connection Successful' : 'Connection Failed',
        description: isConnected 
          ? 'Your Zotero API connection is working correctly' 
          : 'Unable to connect to your Zotero library. Please check your settings.',
        variant: isConnected ? 'default' : 'destructive'
      })
    } catch (error) {
      toast({
        title: 'Connection Test Failed',
        description: 'Failed to test Zotero connection',
        variant: 'destructive'
      })
    } finally {
      setIsTestingConnection(false)
    }
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
          <a 
            href="https://www.zotero.org/settings/keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:text-blue-800"
          >
            Get API Key <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Test Connection</>
                  )}
                </Button>
              </div>
            </div>
            
            {libraryInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{libraryInfo.totalItems}</div>
                  <div className="text-sm text-gray-600">Total Items</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{libraryInfo.collections}</div>
                  <div className="text-sm text-gray-600">Collections</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">
                    {libraryInfo.lastModified ? '✓' : '—'}
                  </div>
                  <div className="text-sm text-gray-600">Last Modified</div>
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
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                placeholder="Your Zotero User ID"
                value={config.userIdZotero}
                onChange={(e) => setConfig(prev => ({ ...prev, userIdZotero: e.target.value }))}
                required
              />
              <p className="text-sm text-gray-500">
                Find your User ID in your Zotero account settings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your Zotero API Key"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                required
              />
              <p className="text-sm text-gray-500">
                Create a new API key with library read permissions
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
                  placeholder="Group Library ID"
                  value={config.libraryId}
                  onChange={(e) => setConfig(prev => ({ ...prev, libraryId: e.target.value }))}
                />
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
            
            <Button type="submit" disabled={isSaving || !config.apiKey.trim()} className="w-full">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect Zotero
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}