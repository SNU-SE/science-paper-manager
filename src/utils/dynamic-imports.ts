import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Loading component for dynamic imports
const LoadingComponent = () => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner size="lg" />
  </div>
)

// Lazy load heavy components with loading states
export const DynamicPaperList = dynamic(
  () => import('@/components/papers/PaperList'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicPaperDetail = dynamic(
  () => import('@/components/papers/PaperDetail'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicAIAnalysisDemo = dynamic(
  () => import('@/components/ai/AIAnalysisDemo'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicAnalysisComparison = dynamic(
  () => import('@/components/ai/AnalysisComparison'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicSemanticSearch = dynamic(
  () => import('@/components/search/SemanticSearch'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicRAGChat = dynamic(
  () => import('@/components/search/RAGChat'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicAPIKeyManager = dynamic(
  () => import('@/components/ai/APIKeyManager'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicZoteroManager = dynamic(
  () => import('@/components/zotero/ZoteroManager'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicPaperUpload = dynamic(
  () => import('@/components/papers/PaperUpload'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicGoogleDriveViewer = dynamic(
  () => import('@/components/papers/GoogleDriveViewer'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

// Route-level dynamic imports
export const DynamicDashboardPage = dynamic(
  () => import('@/app/dashboard/page'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicPapersPage = dynamic(
  () => import('@/app/papers/page'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicSearchPage = dynamic(
  () => import('@/app/search/page'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicChatPage = dynamic(
  () => import('@/app/chat/page'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

export const DynamicSettingsPage = dynamic(
  () => import('@/app/settings/page'),
  {
    loading: LoadingComponent,
    ssr: false
  }
)

// Preload functions for better UX
export const preloadComponents = {
  paperList: () => import('@/components/papers/PaperList'),
  paperDetail: () => import('@/components/papers/PaperDetail'),
  aiAnalysis: () => import('@/components/ai/AIAnalysisDemo'),
  semanticSearch: () => import('@/components/search/SemanticSearch'),
  ragChat: () => import('@/components/search/RAGChat'),
  apiKeyManager: () => import('@/components/ai/APIKeyManager'),
  zoteroManager: () => import('@/components/zotero/ZoteroManager'),
  paperUpload: () => import('@/components/papers/PaperUpload')
}

// Preload critical components on user interaction
export const preloadOnHover = (componentName: keyof typeof preloadComponents) => {
  return () => {
    preloadComponents[componentName]()
  }
}