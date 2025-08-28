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
import { Progress } from '@/components/ui/progress'
import { Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AIServiceFactory } from '@/services/ai/AIServiceFactory'

interface APIKeyData {
  key: string
  isValid: boolean
  isEnabled: boolean
  lastValidated?: Date
  usage?: {
    tokensUsed: number
    cost: number
    requestCount: number
  }
}

export interface APIKeyManagerProps {
  onKeysUpdate?: (keys: Record<string, APIKeyData>) => void
}

const AI_SERVICES = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and other OpenAI models',
    placeholder: 'sk-...',
    website: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models',
    placeholder: 'sk-ant-...',
    website: 'https://console.anthropic.com/'
  },
  {
    id: 'xai',
    name: 'xAI',
    description: 'Grok models',
    placeholder: 'xai-...',
    website: 'https://console.x.ai/'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro models',
    placeholder: 'AI...',
    website: 'https://makersuite.google.com/app/apikey'
  }
]

export function APIKeyManager({ onKeysUpdate }: APIKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, APIKeyData>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [validatingKeys, setValidatingKeys] = useState<Record<string, boolean>>({})
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({})
  const { toast } = useToast()

  // Load API keys from localStorage on mount
  useEffect(() => {
    const loadedKeys: Record<string, APIKeyData> = {}
    
    AI_SERVICES.forEach(service => {
      const storedKey = localStorage.getItem(`apiKey_${service.id}`)
      const storedEnabled = localStorage.getItem(`apiEnabled_${service.id}`)
      const storedUsage = localStorage.getItem(`apiUsage_${service.id}`)
      
      if (storedKey) {
        loadedKeys[service.id] = {
          key: storedKey,
          isValid: false, // Will be validated
          isEnabled: storedEnabled === 'true',
          usage: storedUsage ? JSON.parse(storedUsage) : {
            tokensUsed: 0,
            cost: 0,
            requestCount: 0
          }
        }
        setTempKeys(prev => ({ ...prev, [service.id]: storedKey }))
      } else {
        loadedKeys[service.id] = {
          key: '',
          isValid: false,
          isEnabled: false,
          usage: {
            tokensUsed: 0,
            cost: 0,
            requestCount: 0
          }
        }
      }
    })
    
    setApiKeys(loadedKeys)
    
    // Validate existing keys
    Object.entries(loadedKeys).forEach(([serviceId, keyData]) => {
      if (keyData.key) {
        validateApiKey(serviceId, keyData.key, false)
      }
    })
  }, [])

  // Notify parent component when keys update
  useEffect(() => {
    onKeysUpdate?.(apiKeys)
  }, [apiKeys, onKeysUpdate])

  const validateApiKey = async (serviceId: string, key: string, showToast = true) => {
    if (!key.trim()) return

    setValidatingKeys(prev => ({ ...prev, [serviceId]: true }))

    try {
      const service = AIServiceFactory.createService(serviceId as any, key)
      const isValid = await service.validateApiKey(key)
      
      const updatedKeyData = {
        ...apiKeys[serviceId],
        key,
        isValid,
        lastValidated: new Date()
      }

      setApiKeys(prev => ({
        ...prev,
        [serviceId]: updatedKeyData
      }))

      // Store in localStorage
      localStorage.setItem(`apiKey_${serviceId}`, key)

      if (showToast) {
        toast({
          title: isValid ? 'API Key Valid' : 'API Key Invalid',
          description: isValid 
            ? `${AI_SERVICES.find(s => s.id === serviceId)?.name} API key is working correctly`
            : `${AI_SERVICES.find(s => s.id === serviceId)?.name} API key is invalid or expired`,
          variant: isValid ? 'default' : 'destructive'
        })
      }
    } catch (error) {
      console.error(`Error validating ${serviceId} API key:`, error)
      
      setApiKeys(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId],
          key,
          isValid: false,
          lastValidated: new Date()
        }
      }))

      if (showToast) {
        toast({
          title: 'Validation Error',
          description: `Failed to validate ${AI_SERVICES.find(s => s.id === serviceId)?.name} API key`,
          variant: 'destructive'
        })
      }
    } finally {
      setValidatingKeys(prev => ({ ...prev, [serviceId]: false }))
    }
  }

  const handleKeyChange = (serviceId: string, value: string) => {
    setTempKeys(prev => ({ ...prev, [serviceId]: value }))
  }

  const handleKeySave = (serviceId: string) => {
    const key = tempKeys[serviceId]?.trim() || ''
    validateApiKey(serviceId, key)
  }

  const handleKeyDelete = (serviceId: string) => {
    setApiKeys(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        key: '',
        isValid: false,
        isEnabled: false
      }
    }))
    setTempKeys(prev => ({ ...prev, [serviceId]: '' }))
    localStorage.removeItem(`apiKey_${serviceId}`)
    localStorage.setItem(`apiEnabled_${serviceId}`, 'false')
    
    toast({
      title: 'API Key Removed',
      description: `${AI_SERVICES.find(s => s.id === serviceId)?.name} API key has been removed`
    })
  }

  const handleServiceToggle = (serviceId: string, enabled: boolean) => {
    if (enabled && !apiKeys[serviceId]?.isValid) {
      toast({
        title: 'Invalid API Key',
        description: 'Please add a valid API key before enabling this service',
        variant: 'destructive'
      })
      return
    }

    setApiKeys(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        isEnabled: enabled
      }
    }))
    
    localStorage.setItem(`apiEnabled_${serviceId}`, enabled.toString())
    
    toast({
      title: enabled ? 'Service Enabled' : 'Service Disabled',
      description: `${AI_SERVICES.find(s => s.id === serviceId)?.name} has been ${enabled ? 'enabled' : 'disabled'}`
    })
  }

  const toggleKeyVisibility = (serviceId: string) => {
    setShowKeys(prev => ({ ...prev, [serviceId]: !prev[serviceId] }))
  }

  const getStatusIcon = (keyData?: APIKeyData) => {
    if (!keyData || !keyData.key) return <AlertTriangle className="h-4 w-4 text-gray-400" />
    if (keyData.isValid) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getStatusBadge = (keyData?: APIKeyData) => {
    if (!keyData || !keyData.key) return <Badge variant="secondary">Not Set</Badge>
    if (keyData.isValid && keyData.isEnabled) return <Badge variant="default">Active</Badge>
    if (keyData.isValid && !keyData.isEnabled) return <Badge variant="outline">Valid</Badge>
    return <Badge variant="destructive">Invalid</Badge>
  }

  const getTotalUsage = () => {
    return Object.values(apiKeys).reduce((total, keyData) => ({
      tokensUsed: total.tokensUsed + (keyData.usage?.tokensUsed || 0),
      cost: total.cost + (keyData.usage?.cost || 0),
      requestCount: total.requestCount + (keyData.usage?.requestCount || 0)
    }), { tokensUsed: 0, cost: 0, requestCount: 0 })
  }

  const totalUsage = getTotalUsage()

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
            const keyData = apiKeys[service.id] || { key: '', isValid: false, isEnabled: false }
            const isValidating = validatingKeys[service.id]
            const tempKey = tempKeys[service.id] || ''
            const showKey = showKeys[service.id]

            return (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(keyData)}
                      <div>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(keyData)}
                      <Switch
                        checked={keyData.isEnabled}
                        onCheckedChange={(enabled) => handleServiceToggle(service.id, enabled)}
                        disabled={!keyData.isValid}
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
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleKeyVisibility(service.id)}
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-6">
                      <Button
                        onClick={() => handleKeySave(service.id)}
                        disabled={isValidating || !tempKey.trim()}
                        size="sm"
                      >
                        {isValidating ? 'Validating...' : 'Save & Validate'}
                      </Button>
                      {keyData.key && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKeyDelete(service.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {keyData.lastValidated && (
                    <div className="text-sm text-gray-600">
                      Last validated: {keyData.lastValidated.toLocaleString()}
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
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {AI_SERVICES.map(service => {
            const keyData = apiKeys[service.id] || { key: '', isValid: false, isEnabled: false, usage: { tokensUsed: 0, cost: 0, requestCount: 0 } }
            const usage = keyData.usage || { tokensUsed: 0, cost: 0, requestCount: 0 }

            return (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{service.name}</span>
                    {getStatusBadge(keyData)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-semibold">{usage.tokensUsed.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Tokens Used</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">${usage.cost.toFixed(4)}</div>
                      <div className="text-sm text-gray-600">Estimated Cost</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{usage.requestCount}</div>
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
          API keys are stored locally in your browser. They are not sent to our servers.
          Make sure to keep your API keys secure and never share them publicly.
        </AlertDescription>
      </Alert>
    </div>
  )
}