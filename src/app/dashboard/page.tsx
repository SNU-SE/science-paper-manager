'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { 
  DashboardStats, 
  RecentActivity, 
  AIModelStatus, 
  SyncStatus 
} from '@/components/dashboard'
import { useDashboard } from '@/hooks/useDashboard'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const {
    papers,
    evaluations,
    aiAnalyses,
    apiKeys,
    activeModels,
    usageStats,
    syncServices,
    isLoading,
    error,
    handleSyncService,
    refreshData
  } = useDashboard()

  const handleConfigureAI = () => {
    router.push('/settings')
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={refreshData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Dashboard
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Welcome to your research paper management system
              </p>
            </div>
            <Button variant="outline" onClick={refreshData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Statistics Cards */}
          <DashboardStats
            papers={papers}
            evaluations={evaluations}
            aiAnalyses={aiAnalyses}
            isLoading={isLoading}
          />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Activity */}
            <RecentActivity
              papers={papers}
              evaluations={evaluations}
              aiAnalyses={aiAnalyses}
              isLoading={isLoading}
            />

            {/* AI Model Status */}
            <AIModelStatus
              apiKeys={apiKeys}
              activeModels={activeModels}
              usageStats={usageStats}
              onConfigureClick={handleConfigureAI}
              isLoading={isLoading}
            />
          </div>

          {/* Sync Status */}
          <SyncStatus
            services={syncServices}
            onSyncClick={handleSyncService}
            isLoading={isLoading}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}