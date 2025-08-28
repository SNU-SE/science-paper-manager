'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ZoteroConfigData {
  userId: string
  apiKey: string
  libraryType: 'user' | 'group'
  libraryId?: string
}

interface ZoteroConfigProps {
  onConfigured?: () => void
}

export function ZoteroConfig({ onConfigured }: ZoteroConfigProps) {
  const [config, setConfig] = useState<ZoteroConfigData>({
    userId: '',
    apiKey: '',
    libraryType: 'user',
    libraryId: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/zotero/config')
      const result = await response.json()
      
      if (result.success && result.data.isConfigured) {
        setIsConfigured(true)
        if (result.data.config) {
          setConfig(prev => ({
            ...prev,
            userId: result.data.config.userId || '',
            libraryType: result.data.config.libraryType || 'user',
            libraryId: result.data.config.libraryId || ''
          }))
        }
      }
    } catch (error) {
      console.error('Error checking Zotero configuration:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/zotero/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      const result = await response.json()

      if (result.success) {
        setIsConfigured(true)
        toast({
          title: 'Success',
          description: 'Zotero configured successfully'
        })
        onConfigured?.()
      } else {
        setError(result.error)
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to configure Zotero'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/zotero/config', {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setIsConfigured(false)
        setConfig({
          userId: '',
          apiKey: '',
          libraryType: 'user',
          libraryId: ''
        })
        toast({
          title: 'Success',
          description: 'Zotero disconnected successfully'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Zotero',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Zotero Integration
          {isConfigured ? (
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

        {isConfigured ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">✓ Zotero is connected</p>
              <p className="text-green-600 text-sm mt-1">
                User ID: {config.userId} | Library: {config.libraryType}
              </p>
            </div>
            <Button 
              onClick={handleDisconnect} 
              variant="outline"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect Zotero
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="Your Zotero User ID"
                value={config.userId}
                onChange={(e) => setConfig(prev => ({ ...prev, userId: e.target.value }))}
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

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect Zotero
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}