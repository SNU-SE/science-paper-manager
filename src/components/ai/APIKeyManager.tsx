'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, DollarSign, RefreshCw, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/auth/AuthProvider'
import { UserApiKeyService, AIProvider, APIKeyInfo } from '@/services/settings/UserApiKeyService'
import { useApiKeyValidation, useSettingsSave } from '@/hooks/useSettingsValidation'
import { SettingsError } from '@/lib/settings-error-handler'

export interface APIKeyManagerProps {
  onKeysUpdate?: (keys: APIKeyInfo[]) => void
}

const AI_SERVICES = [
  {
    id: 'openai' as AIProvider,
    name: 'OpenAI',
    description: 'GPT-4 and other OpenAI models',
    placeholder: 'sk-...',
    website: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic' as AIProvider,
    name: 'Anthropic',
    description: 'Claude models',
    placeholder: 'sk-ant-...',
    website: 'https://console.anthropic.com/'
  },
  {
    id: 'xai' as AIProvider,
    name: 'xAI',
    description: 'Grok models',
    placeholder: 'xai-...',
    website: 'https://console.x.ai/'
  },
  {
    id: 'gemini' as AIProvider,
    name: 'Google Gemini',
    description: 'Gemini Pro models',
    placeholder: 'AI...',
    website: 'https://makersuite.google.com/app/apikey'
  }
]

export function APIKeyManager({ onKeysUpdate }: APIKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([])
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  
  const { toast } = useToast()
  const { user } = useAuth()
  const apiKeyService = new UserApiKeyService()
  const { validateApiKey, validationState, retryValidation, clearValidation, isRetryable } = useApiKeyValidation()
  const { saveSettings, saveState } = useSettingsSave()

  // Load API keys from Supabase on mount
  useEffect(() => {
    if (!user) return
    
    const loadApiKeys = async () => {
      try {
        setLoading(true)
        const keys = await apiKeyService.getUserApiKeys(user.id)
        setApiKeys(keys)
      } catch (error) {
        // Error loading API keys
        toast({
          title: 'Error Loading API Keys',
          description: 'Failed to load your API keys from the database',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadApiKeys()
  }, [user])

  // Notify parent component when keys update
  useEffect(() => {
    onKeysUpdate?.(apiKeys)
  }, [apiKeys, onKeysUpdate])

  const validateApiKeyForProvider = async (serviceId: AIProvider, key: string) => {
    if (!user) return false

    // Create a test function for this specific provider
    const testFunction = async (apiKey: string): Promise<boolean> => {
      // Save the API key first
      await apiKeyService.saveApiKey(user.id, { provider: serviceId, apiKey })
      
      // Then validate it
      const isValid = await apiKeyService.validateApiKey(user.id, serviceId)
      
      // Reload the keys to get updated status
      const updatedKeys = await apiKeyService.getUserApiKeys(user.id)
      setApiKeys(updatedKeys)
      
      return isValid
    }

    const serviceName = AI_SERVICES.find(s => s.id === serviceId)?.name || serviceId

    return validateApiKey(
      serviceName,
      key,
      testFunction,
      {
        showToast: true,
        onSuccess: () => {
          // Clear the temp key on successful validation
          setTempKeys(prev => ({ ...prev, [serviceId]: '' }))
        },
        onError: (error: SettingsError) => {
          // Error validating API key
        }
      }
    )
  }

  const handleKeyChange = (serviceId: AIProvider, value: string) => {
    setTempKeys(prev => ({ ...prev, [serviceId]: value }))
  }

  const handleKeySave = async (serviceId: AIProvider) => {
    const key = tempKeys[serviceId]?.trim() || ''
    if (!key) {
      toast({
        title: 'API Key Required',
        description: 'Please enter an API key before saving',
        variant: 'destructive'
      })
      return
    }

    await validateApiKeyForProvider(serviceId, key)
  }

  const handleKeyDelete = async (serviceId: AIProvider) => {
    if (!user) return
    
    const serviceName = AI_SERVICES.find(s => s.id === serviceId)?.name || serviceId
    
    const result = await saveSettings(
      () => apiKeyService.deleteApiKey(user.id, serviceId),
      { provider: serviceName, operation: 'delete' },
      {
        showToast: true,
        onSuccess: async () => {
          // Reload keys
          const updatedKeys = await apiKeyService.getUserApiKeys(user.id)
          setApiKeys(updatedKeys)
          setTempKeys(prev => ({ ...prev, [serviceId]: '' }))
          clearValidation()
        }
      }
    )
  }

  const handleServiceToggle = async (serviceId: AIProvider, enabled: boolean) => {
    const keyInfo = apiKeys.find(k => k.provider === serviceId)
    
    if (enabled && (!keyInfo || !keyInfo.isValid)) {
      toast({
        title: 'Invalid API Key',
        description: 'Please add a valid API key before enabling this service',
        variant: 'destructive'
      })
      return
    }

    // For now, we don't have an enabled/disabled state in the database
    // This could be added as a future enhancement
    toast({
      title: enabled ? 'Service Enabled' : 'Service Disabled',
      description: `${AI_SERVICES.find(s => s.id === serviceId)?.name} has been ${enabled ? 'enabled' : 'disabled'}`
    })
  }

  const toggleKeyVisibility = (serviceId: AIProvider) => {
    setShowKeys(prev => ({ ...prev, [serviceId]: !prev[serviceId] }))
  }

  const getStatusIcon = (keyInfo?: APIKeyInfo, serviceId?: AIProvider) => {
    // Check if currently validating this specific service
    if (validationState.isValidating && validationState.error?.provider === serviceId) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }
    
    if (!keyInfo || !keyInfo.hasKey) return <AlertTriangle className="h-4 w-4 text-gray-400" />
    if (keyInfo.isValid) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getStatusBadge = (keyInfo?: APIKeyInfo, serviceId?: AIProvider) => {
    // Check if currently validating this specific service
    if (validationState.isValidating && validationState.error?.provider === serviceId) {
      return <Badge variant="secondary">Validating...</Badge>
    }
    
    if (!keyInfo || !keyInfo.hasKey) return <Badge variant="secondary">Not Set</Badge>
    if (keyInfo.isValid) return <Badge variant="default">Valid</Badge>
    
    // Show more specific error states
    if (validationState.error?.provider === serviceId) {
      switch (validationState.error.settingsType) {
        case 'API_KEY_EXPIRED':
          return <Badge variant="destructive">Expired</Badge>
        case 'API_KEY_INSUFFICIENT_PERMISSIONS':
          return <Badge variant="destructive">No Permissions</Badge>
        case 'API_KEY_RATE_LIMITED':
          return <Badge variant="destructive">Rate Limited</Badge>
        case 'API_KEY_MALFORMED':
          return <Badge variant="destructive">Invalid Format</Badge>
        default:
          return <Badge variant="destructive">Invalid</Badge>
      }
    }
    
    return <Badge variant="destructive">Invalid</Badge>
  }

  const getTotalUsage = () => {
    return apiKeys.reduce((total, keyInfo) => ({
      tokensUsed: total.tokensUsed,
      cost: total.cost,
      requestCount: total.requestCount + keyInfo.usageCount
    }), { tokensUsed: 0, cost: 0, requestCount: 0 })
  }

  const totalUsage = getTotalUsage()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-lg font-medium">Loading API keys...</div>
          <div className="text-sm text-gray-600 mt-2">Please wait while we fetch your settings</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-medium">Please sign in</div>
        <div className="text-sm text-gray-600 mt-2">You need to be signed in to manage API keys</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Key Management</h2>
          <p className="text-gray-600">
            Configure and manage your AI service API keys
          </p>
        </div>
      </div>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Usage Overview
          </CardTitle>
          <CardDescription>
            Total usage across all AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalUsage.tokensUsed.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">${totalUsage.cost.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Estimated Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{totalUsage.requestCount}</div>
              <div className="text-sm text-gray-600">API Requests</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage Details</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          {AI_SERVICES.map(service => {
            const keyInfo = apiKeys.find(k => k.provider === service.id)
            const tempKey = tempKeys[service.id] || ''
            const showKey = showKeys[service.id]
            const isCurrentlyValidating = validationState.isValidating && validationState.error?.provider === service.name
            const isCurrentlySaving = saveState.isSaving
            const hasValidationError = validationState.error?.provider === service.name
            const canRetry = hasValidationError && isRetryable

            return (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(keyInfo, service.id)}
                      <div>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(keyInfo, service.id)}
                      <Switch
                        checked={keyInfo?.isValid || false}
                        onCheckedChange={(enabled) => handleServiceToggle(service.id, enabled)}
                        disabled={!keyInfo?.isValid}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`key-${service.id}`}>API Key</Label>
                      <div className="relative">
                        <Input
                          id={`key-${service.id}`}
                          type={showKey ? 'text' : 'password'}
                          placeholder={service.placeholder}
                          value={tempKey}
                          onChange={(e) => handleKeyChange(service.id, e.target.value)}
                          className="pr-10"
                          disabled={isCurrentlyValidating || isCurrentlySaving}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleKeyVisibility(service.id)}
                          disabled={isCurrentlyValidating || isCurrentlySaving}
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-6">
                      <Button
                        onClick={() => handleKeySave(service.id)}
                        disabled={isCurrentlyValidating || isCurrentlySaving || !tempKey.trim()}
                        size="sm"
                      >
                        {isCurrentlyValidating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Validating...
                          </>
                        ) : isCurrentlySaving ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save & Validate'
                        )}
                      </Button>
                      
                      {canRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={retryValidation}
                          disabled={isCurrentlyValidating}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      
                      {keyInfo?.hasKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKeyDelete(service.id)}
                          disabled={isCurrentlyValidating || isCurrentlySaving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Enhanced error display */}
                  {hasValidationError && validationState.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium">{validationState.error.message}</div>
                          {validationState.error.suggestedAction && (
                            <div className="text-sm opacity-90">
                              {validationState.error.suggestedAction}
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {keyInfo?.lastValidatedAt && (
                    <div className="text-sm text-gray-600">
                      Last validated: {keyInfo.lastValidatedAt.toLocaleString()}
                      {validationState.retryCount > 0 && (
                        <span className="ml-2 text-orange-600">
                          (Retry #{validationState.retryCount})
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <a
                      href={service.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Get API Key →
                    </a>
                    
                    {keyInfo?.isValid && (
                      <div className="text-green-600 text-xs">
                        ✓ Ready to use
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {AI_SERVICES.map(service => {
            const keyInfo = apiKeys.find(k => k.provider === service.id)

            return (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{service.name}</span>
                    {getStatusBadge(keyInfo)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-semibold">0</div>
                      <div className="text-sm text-gray-600">Tokens Used</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">$0.0000</div>
                      <div className="text-sm text-gray-600">Estimated Cost</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{keyInfo?.usageCount || 0}</div>
                      <div className="text-sm text-gray-600">API Requests</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          API keys are securely encrypted and stored in your database. They are never logged or exposed.
          Make sure to keep your API keys secure and never share them publicly.
        </AlertDescription>
      </Alert>
    </div>
  )
}