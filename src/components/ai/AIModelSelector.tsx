'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useAuth } from '@/components/auth/AuthProvider'
import { UserAiModelService, ModelPreference, ModelOption } from '@/services/settings/UserAiModelService'
import { AIProvider } from '@/services/settings/UserApiKeyService'
import { CheckCircle, XCircle, Loader2, Key, Settings, Sliders } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface AIModelSelectorProps {
  onPreferencesUpdate?: (preferences: ModelPreference[]) => void
}

export function AIModelSelector({ onPreferencesUpdate }: AIModelSelectorProps) {
  const [modelPreferences, setModelPreferences] = useState<ModelPreference[]>([])
  const [availableModels, setAvailableModels] = useState<Record<AIProvider, ModelOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const { user } = useAuth()
  const modelService = new UserAiModelService()

  // Load model preferences and available models
  useEffect(() => {
    if (!user) return
    
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load user preferences
        const preferences = await modelService.getUserModelPreferences(user.id)
        setModelPreferences(preferences)
        
        // Load available models for all providers
        const providers: AIProvider[] = ['openai', 'anthropic', 'xai', 'gemini']
        const modelsMap: Record<AIProvider, ModelOption[]> = {} as Record<AIProvider, ModelOption[]>
        
        providers.forEach(provider => {
          modelsMap[provider] = modelService.getAvailableModels(provider)
        })
        
        setAvailableModels(modelsMap)
        
      } catch (error) {
        console.error('Error loading model data:', error)
        toast({
          title: 'Error Loading Models',
          description: 'Failed to load model preferences',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [user])

  const handleModelChange = async (provider: AIProvider, modelName: string) => {
    if (!user) return
    
    setSaving(prev => ({ ...prev, [`${provider}-${modelName}`]: true }))
    
    try {
      await modelService.saveModelPreference(user.id, provider, modelName, {
        isEnabled: true
      })
      
      // Reload preferences
      const updatedPreferences = await modelService.getUserModelPreferences(user.id)
      setModelPreferences(updatedPreferences)
      onPreferencesUpdate?.(updatedPreferences)
      
      toast({
        title: 'Model Updated',
        description: `${modelName} has been set for ${provider}`
      })
    } catch (error) {
      console.error('Error saving model preference:', error)
      toast({
        title: 'Error',
        description: 'Failed to save model preference',
        variant: 'destructive'
      })
    } finally {
      setSaving(prev => ({ ...prev, [`${provider}-${modelName}`]: false }))
    }
  }

  const handleSetDefaultModel = async (provider: AIProvider, modelName: string) => {
    if (!user) return
    
    setSaving(prev => ({ ...prev, [`${provider}-default`]: true }))
    
    try {
      await modelService.setDefaultModel(user.id, provider, modelName)
      
      // Reload preferences
      const updatedPreferences = await modelService.getUserModelPreferences(user.id)
      setModelPreferences(updatedPreferences)
      onPreferencesUpdate?.(updatedPreferences)
      
      toast({
        title: 'Default Model Set',
        description: `${modelName} is now the default for ${provider}`
      })
    } catch (error) {
      console.error('Error setting default model:', error)
      toast({
        title: 'Error',
        description: 'Failed to set default model',
        variant: 'destructive'
      })
    } finally {
      setSaving(prev => ({ ...prev, [`${provider}-default`]: false }))
    }
  }
  
  const handleParameterUpdate = async (provider: AIProvider, modelName: string, parameters: Record<string, any>) => {
    if (!user) return
    
    try {
      await modelService.updateModelParameters(user.id, provider, modelName, parameters)
      
      // Reload preferences
      const updatedPreferences = await modelService.getUserModelPreferences(user.id)
      setModelPreferences(updatedPreferences)
      onPreferencesUpdate?.(updatedPreferences)
      
    } catch (error) {
      console.error('Error updating parameters:', error)
      toast({
        title: 'Error',
        description: 'Failed to update model parameters',
        variant: 'destructive'
      })
    }
  }

  const getProviderDisplayName = (provider: AIProvider): string => {
    const names: Record<AIProvider, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      xai: 'xAI',
      gemini: 'Google Gemini'
    }
    return names[provider]
  }

  const getProviderPreferences = (provider: AIProvider) => {
    return modelPreferences.filter(p => p.provider === provider)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <div className="text-lg font-medium">Loading AI Models...</div>
          <div className="text-sm text-gray-600 mt-2">Please wait while we fetch your model preferences</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-medium">Please sign in</div>
        <div className="text-sm text-gray-600 mt-2">You need to be signed in to manage AI model preferences</div>
      </div>
    )
  }

  const enabledModelsCount = modelPreferences.filter(p => p.isEnabled).length
  const totalModelsCount = Object.keys(availableModels).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Model Configuration</h2>
          <p className="text-gray-600">
            Configure AI models and their parameters for each provider
          </p>
        </div>
        {enabledModelsCount > 0 && (
          <Badge variant="secondary">
            {enabledModelsCount} models configured
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        {(Object.keys(availableModels) as AIProvider[]).map(provider => {
          const models = availableModels[provider] || []
          const preferences = getProviderPreferences(provider)
          const defaultPreference = preferences.find(p => p.isDefault)
          
          if (models.length === 0) return null

          return (
            <Card key={provider}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{getProviderDisplayName(provider)}</span>
                  <div className="flex items-center gap-2">
                    {preferences.length > 0 && (
                      <Badge variant="outline">{preferences.length} models configured</Badge>
                    )}
                    {defaultPreference && (
                      <Badge variant="default">Default: {defaultPreference.displayName}</Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="models" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="models">Model Selection</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="models" className="space-y-4">
                    <div className="grid gap-3">
                      {models.map(model => {
                        const preference = preferences.find(p => p.modelName === model.name)
                        const isConfiguring = saving[`${provider}-${model.name}`]
                        
                        return (
                          <div key={model.name} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{model.displayName}</h4>
                                {preference?.isDefault && (
                                  <Badge variant="default" size="sm">Default</Badge>
                                )}
                                {preference && !preference.isDefault && (
                                  <Badge variant="outline" size="sm">Configured</Badge>
                                )}
                              </div>
                              {model.description && (
                                <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                Max tokens: {model.maxTokens.toLocaleString()} | 
                                Features: {model.supportedFeatures.join(', ')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleModelChange(provider, model.name)}
                                disabled={isConfiguring}
                              >
                                {isConfiguring ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  preference ? 'Update' : 'Add'
                                )}
                              </Button>
                              {preference && !preference.isDefault && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleSetDefaultModel(provider, model.name)}
                                  disabled={saving[`${provider}-default`]}
                                >
                                  {saving[`${provider}-default`] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Set Default'
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="parameters" className="space-y-4">
                    {preferences.map(preference => (
                      <Card key={preference.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>{preference.displayName}</span>
                            {preference.isDefault && (
                              <Badge variant="default">Default</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <ModelParameterEditor
                            provider={provider}
                            modelName={preference.modelName}
                            parameters={preference.parameters}
                            onParametersChange={(params) => handleParameterUpdate(provider, preference.modelName, params)}
                          />
                        </CardContent>
                      </Card>
                    ))}
                    
                    {preferences.length === 0 && (
                      <Alert>
                        <Sliders className="h-4 w-4" />
                        <AlertDescription>
                          Add models first to configure their parameters.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// Component for editing model parameters
interface ModelParameterEditorProps {
  provider: AIProvider
  modelName: string
  parameters: Record<string, any>
  onParametersChange: (parameters: Record<string, any>) => void
}

function ModelParameterEditor({ provider, parameters, onParametersChange }: ModelParameterEditorProps) {
  const handleParameterChange = (key: string, value: any) => {
    const newParams = { ...parameters, [key]: value }
    onParametersChange(newParams)
  }

  // Common parameters for all providers
  const commonParams = [
    { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1, description: 'Controls randomness in responses' }
  ]

  // Provider-specific parameters
  const getProviderParams = () => {
    switch (provider) {
      case 'openai':
        return [
          { key: 'max_tokens', label: 'Max Tokens', min: 1, max: 4096, step: 1, description: 'Maximum tokens to generate' },
          { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, description: 'Nucleus sampling parameter' },
          { key: 'frequency_penalty', label: 'Frequency Penalty', min: -2, max: 2, step: 0.1, description: 'Penalize repeated tokens' },
          { key: 'presence_penalty', label: 'Presence Penalty', min: -2, max: 2, step: 0.1, description: 'Penalize new topics' }
        ]
      case 'anthropic':
        return [
          { key: 'max_tokens', label: 'Max Tokens', min: 1, max: 4096, step: 1, description: 'Maximum tokens to generate' },
          { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, description: 'Nucleus sampling parameter' }
        ]
      case 'xai':
        return [
          { key: 'max_tokens', label: 'Max Tokens', min: 1, max: 4096, step: 1, description: 'Maximum tokens to generate' },
          { key: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, description: 'Nucleus sampling parameter' }
        ]
      case 'gemini':
        return [
          { key: 'maxOutputTokens', label: 'Max Output Tokens', min: 1, max: 4096, step: 1, description: 'Maximum tokens to generate' },
          { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.01, description: 'Nucleus sampling parameter' },
          { key: 'topK', label: 'Top K', min: 1, max: 100, step: 1, description: 'Top-k sampling parameter' }
        ]
      default:
        return []
    }
  }

  const allParams = [...commonParams, ...getProviderParams()]

  return (
    <div className="space-y-4">
      {allParams.map(param => (
        <div key={param.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{param.label}</Label>
            <span className="text-sm text-gray-600">{parameters[param.key]}</span>
          </div>
          <Slider
            value={[parameters[param.key] || param.min]}
            onValueChange={([value]) => handleParameterChange(param.key, value)}
            max={param.max}
            min={param.min}
            step={param.step}
            className="w-full"
          />
          <p className="text-xs text-gray-500">{param.description}</p>
        </div>
      ))}
    </div>
  )
}