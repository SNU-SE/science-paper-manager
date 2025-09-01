'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSecurityManager, SecurityActivity, SecurityStats } from '@/hooks/useSecurityManager'
import { Shield, AlertTriangle, Lock, Key, Activity, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface APIKeyInfo {
  provider: string
  created_at: string
  updated_at: string
  last_used_at?: string
}

export function SecurityDashboard() {
  const {
    isLoading,
    sessionInfo,
    securityStats,
    getSecurityActivity,
    getSecurityStats,
    analyzeSecurityPatterns,
    storeAPIKey,
    deleteAPIKey
  } = useSecurityManager()

  const [activities, setActivities] = useState<SecurityActivity[]>([])
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([])
  const [newApiKey, setNewApiKey] = useState({ provider: '', key: '' })
  const [showAddKey, setShowAddKey] = useState(false)

  // Load data on component mount
  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    try {
      // Load security statistics
      await getSecurityStats()
      
      // Load recent activity
      const activityData = await getSecurityActivity(20, 0)
      if (activityData) {
        setActivities(activityData.activities)
      }

      // Load API keys list
      const response = await fetch('/api/security/api-keys/list', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys)
      }
    } catch (error) {
      console.error('Failed to load security data:', error)
      toast.error('Failed to load security data')
    }
  }

  const handleAddApiKey = async () => {
    if (!newApiKey.provider || !newApiKey.key) {
      toast.error('Provider and API key are required')
      return
    }

    const success = await storeAPIKey(newApiKey.provider, newApiKey.key)
    if (success) {
      setNewApiKey({ provider: '', key: '' })
      setShowAddKey(false)
      loadSecurityData() // Refresh the list
    }
  }

  const handleDeleteApiKey = async (provider: string) => {
    const success = await deleteAPIKey(provider)
    if (success) {
      loadSecurityData() // Refresh the list
    }
  }

  const handleAnalyzePatterns = async () => {
    const assessment = await analyzeSecurityPatterns('manual_security_check')
    if (assessment) {
      toast.info(`Security analysis complete. Risk level: ${assessment.riskLevel}`)
      if (assessment.recommendations.length > 0) {
        toast.warning(`Recommendations: ${assessment.recommendations.join(', ')}`)
      }
    }
  }

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!sessionInfo?.valid) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-muted-foreground">Please log in to access the security dashboard.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityStats?.accountStatus.isLocked ? 'Locked' : 'Active'}
            </div>
            <p className="text-xs text-muted-foreground">
              {securityStats?.accountStatus.failedLoginAttempts || 0} failed attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {securityStats?.summary.totalEvents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(securityStats?.summary.highRiskEvents || 0) + (securityStats?.summary.criticalEvents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Encrypted & stored
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Lock Alert */}
      {securityStats?.accountStatus.isLocked && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Account Locked</AlertTitle>
          <AlertDescription>
            Your account is temporarily locked due to: {securityStats.accountStatus.lockReason}
            {securityStats.accountStatus.lockExpiresAt && (
              <span className="block mt-1">
                Lock expires: {formatDate(securityStats.accountStatus.lockExpiresAt)}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Security Activity</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="analysis">Security Analysis</TabsTrigger>
        </TabsList>

        {/* Security Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Activity</CardTitle>
              <CardDescription>
                Your recent security events and access logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No security activity found
                  </p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{activity.action}</span>
                          <Badge variant={getRiskLevelColor(activity.risk_level)}>
                            {activity.risk_level}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(activity.created_at)}
                          {activity.ip_address && ` • IP: ${activity.ip_address}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Manage your encrypted API keys for AI providers
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddKey(true)}>
                  Add API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddKey && (
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">Add New API Key</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Provider</label>
                      <select
                        className="w-full mt-1 p-2 border rounded-md"
                        value={newApiKey.provider}
                        onChange={(e) => setNewApiKey({ ...newApiKey, provider: e.target.value })}
                      >
                        <option value="">Select provider</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google</option>
                        <option value="xai">xAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">API Key</label>
                      <input
                        type="password"
                        className="w-full mt-1 p-2 border rounded-md"
                        value={newApiKey.key}
                        onChange={(e) => setNewApiKey({ ...newApiKey, key: e.target.value })}
                        placeholder="Enter API key"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleAddApiKey} disabled={isLoading}>
                      {isLoading ? 'Adding...' : 'Add Key'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddKey(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {apiKeys.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No API keys stored
                  </p>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.provider} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium capitalize">{key.provider}</div>
                        <div className="text-sm text-muted-foreground">
                          Added: {formatDate(key.created_at)}
                          {key.last_used_at && (
                            <span className="ml-2">
                              Last used: {formatDate(key.last_used_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.provider)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Analysis</CardTitle>
                  <CardDescription>
                    Analyze your security patterns and get recommendations
                  </CardDescription>
                </div>
                <Button onClick={handleAnalyzePatterns} disabled={isLoading}>
                  {isLoading ? 'Analyzing...' : 'Run Analysis'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {securityStats && (
                <div className="space-y-6">
                  {/* Risk Level Distribution */}
                  <div>
                    <h4 className="font-medium mb-3">Risk Level Distribution (Last 30 days)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(securityStats.riskLevelDistribution).map(([level, count]) => (
                        <div key={level} className="text-center p-3 border rounded-lg">
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-sm capitalize">
                            <Badge variant={getRiskLevelColor(level)}>{level}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Actions */}
                  <div>
                    <h4 className="font-medium mb-3">Most Common Actions (Last 7 days)</h4>
                    <div className="space-y-2">
                      {securityStats.topActions.slice(0, 5).map(([action, count]) => (
                        <div key={action} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{action}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}