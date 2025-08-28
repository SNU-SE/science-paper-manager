// Export all Zustand stores
export { useAuthStore } from './authStore'
export { usePaperStore } from './paperStore'
export { useAIStore } from './aiStore'
export { useSearchStore } from './searchStore'

// Re-export types for convenience
export type { 
  Paper, 
  UserEvaluation, 
  MultiModelAnalysis,
  SearchResult,
  RAGResponse,
  ChatMessage,
  SearchFilters,
  UsageStats,
  AIModel
} from '../types'

// Enhanced components are available as separate imports:
// import { PaperCardEnhanced } from '@/components/papers/PaperCardEnhanced'
// import { PaperListEnhanced } from '@/components/papers/PaperListEnhanced'
// import { AIModelSelectorEnhanced } from '@/components/ai/AIModelSelectorEnhanced'
// import { SemanticSearchEnhanced } from '@/components/search/SemanticSearchEnhanced'
// import { RAGChatEnhanced } from '@/components/search/RAGChatEnhanced'