import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AIModel, UsageStats } from '../types'

interface AIStore {
  // State
  apiKeys: Record<string, string>
  activeModels: Set<AIModel>
  usage: Record<string, UsageStats>
  isValidating: boolean
  validationErrors: Record<string, string>

  // Actions
  updateApiKey: (service: AIModel, key: string) => void
  removeApiKey: (service: AIModel) => void
  validateApiKey: (service: AIModel, key: string) => Promise<boolean>
  toggleModel: (model: AIModel) => void
  setActiveModels: (models: AIModel[]) => void
  
  // Usage tracking
  updateUsage: (service: AIModel, stats: Partial<UsageStats>) => void
  getUsage: (service: AIModel) => UsageStats | undefined
  resetUsage: (service?: AIModel) => void
  
  // Utility actions
  clearValidationErrors: () => void
  isModelActive: (model: AIModel) => boolean
  hasValidKey: (model: AIModel) => boolean
  getActiveModelsWithKeys: () => AIModel[]
}

const defaultUsageStats: UsageStats = {
  tokensUsed: 0,
  requestCount: 0,
  estimatedCost: 0,
  lastUsed: new Date()
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      apiKeys: {},
      activeModels: new Set<AIModel>(),
      usage: {},
      isValidating: false,
      validationErrors: {},

      // API Key actions
      updateApiKey: (service: AIModel, key: string) => {
        const { apiKeys, validationErrors } = get()
        const newApiKeys = { ...apiKeys, [service]: key }
        const newValidationErrors = { ...validationErrors }
        delete newValidationErrors[service] // Clear any previous validation error
        
        set({ 
          apiKeys: newApiKeys,
          validationErrors: newValidationErrors
        })
      },

      removeApiKey: (service: AIModel) => {
        const { apiKeys, activeModels, validationErrors } = get()
        const newApiKeys = { ...apiKeys }
        const newActiveModels = new Set(activeModels)
        const newValidationErrors = { ...validationErrors }
        
        delete newApiKeys[service]
        newActiveModels.delete(service)
        delete newValidationErrors[service]
        
        set({ 
          apiKeys: newApiKeys,
          activeModels: newActiveModels,
          validationErrors: newValidationErrors
        })
      },

      validateApiKey: async (service: AIModel, key: string) => {
        set({ isValidating: true })
        
        try {
          const response = await fetch('/api/ai-keys/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, key })
          })
          
          const result = await response.json()
          
          if (result.valid) {
            const { validationErrors } = get()
            const newValidationErrors = { ...validationErrors }
            delete newValidationErrors[service]
            
            set({ 
              validationErrors: newValidationErrors,
              isValidating: false 
            })
            return true
          } else {
            const { validationErrors } = get()
            set({ 
              validationErrors: { 
                ...validationErrors, 
                [service]: result.error || 'Invalid API key' 
              },
              isValidating: false 
            })
            return false
          }
        } catch (error) {
          const { validationErrors } = get()
          set({ 
            validationErrors: { 
              ...validationErrors, 
              [service]: 'Failed to validate API key' 
            },
            isValidating: false 
          })
          return false
        }
      },

      // Model management
      toggleModel: (model: AIModel) => {
        const { activeModels } = get()
        const newActiveModels = new Set(activeModels)
        
        if (newActiveModels.has(model)) {
          newActiveModels.delete(model)
        } else {
          newActiveModels.add(model)
        }
        
        set({ activeModels: newActiveModels })
      },

      setActiveModels: (models: AIModel[]) => {
        set({ activeModels: new Set(models) })
      },

      // Usage tracking
      updateUsage: (service: AIModel, stats: Partial<UsageStats>) => {
        const { usage } = get()
        const currentStats = usage[service] || { ...defaultUsageStats }
        
        const updatedStats: UsageStats = {
          tokensUsed: currentStats.tokensUsed + (stats.tokensUsed || 0),
          requestCount: currentStats.requestCount + (stats.requestCount || 0),
          estimatedCost: currentStats.estimatedCost + (stats.estimatedCost || 0),
          lastUsed: stats.lastUsed || new Date()
        }
        
        set({ 
          usage: { 
            ...usage, 
            [service]: updatedStats 
          } 
        })
      },

      getUsage: (service: AIModel) => {
        return get().usage[service]
      },

      resetUsage: (service?: AIModel) => {
        const { usage } = get()
        
        if (service) {
          const newUsage = { ...usage }
          delete newUsage[service]
          set({ usage: newUsage })
        } else {
          set({ usage: {} })
        }
      },

      // Utility actions
      clearValidationErrors: () => {
        set({ validationErrors: {} })
      },

      isModelActive: (model: AIModel) => {
        return get().activeModels.has(model)
      },

      hasValidKey: (model: AIModel) => {
        const { apiKeys, validationErrors } = get()
        return !!apiKeys[model] && !validationErrors[model]
      },

      getActiveModelsWithKeys: () => {
        const { activeModels, apiKeys, validationErrors } = get()
        return Array.from(activeModels).filter(model => 
          apiKeys[model] && !validationErrors[model]
        )
      }
    }),
    {
      name: 'ai-storage',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        activeModels: Array.from(state.activeModels),
        usage: state.usage
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert array back to Set after rehydration
          state.activeModels = new Set(state.activeModels as any)
        }
      }
    }
  )
)