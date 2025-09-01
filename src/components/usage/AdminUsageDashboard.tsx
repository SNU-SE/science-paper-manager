'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/components/auth/AuthProvider'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import { 
  Users, 
  Activity, 
  AlertTriangle, 
  Settings, 
  Shield,
  RefreshCw,
  Search,
  TrendingUp
} from 'lucide-react'

interface SystemUsageStats {
  totalUsers: number
  totalRequests: number
  totalCostUnits: number
  averageRequestsPerUser: number
  topUsers: Array<{
    userId: string
    requests: number
    costUnits: number
  }>
  topEndpoints: Array<{
    endpoint: string
    requests: number
    percentage: number
  }>
}

interface SuspiciousActivity {
  id: string
  userId: string
  activityType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  metadata: Record<string, any>
  isResolved: boolean
  createdAt: Date
}

export function AdminUsageDashboard() {
  const { user, getAccessToken } = useAuth()
  const [systemStats, setSystemStats] = useState<SystemUsageStats | null>(null)
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userDetails, setUserDetails] = useState<any>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [rateLimitForm, setRateLimitForm] = useState({
    targetUserId: '',
    limitType: 'daily' as 'daily' | 'hourly' | 'monthly',
    endpointPattern: '',
    maxRequests: 1000,
    maxCostUnits: 500
  })

  const loadSystemStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/admin', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load system statistics')
      }

      const data = await response.json()
      setSystemStats(data.statistics)
      setSuspiciousActivity(data.suspiciousActivity.map((activity: any) => ({
        ...activity,
        createdAt: new Date(activity.createdAt)
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadUserDetails = async (userId: string) => {
    if (!userId) return

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/admin/user-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId: userId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load user details')
      }

      const data = await response.json()
      setUserDetails(data)
      setShowUserDialog(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const updateRateLimit = async () => {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/limits', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rateLimitForm)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update rate limit')
      }

      // Reset form and reload data
      setRateLimitForm({
        targetUserId: '',
        limitType: 'daily',
        endpointPattern: '',
        maxRequests: 1000,
        maxCostUnits: 500
      })
      await loadSystemStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const resolveSuspiciousActivity = async (activityId: string) => {
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('No access token available')

      const response = await fetch('/api/usage/suspicious', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activityId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to resolve activity')
      }

      // Reload data
      await loadSystemStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  useEffect(() => {
    loadSystemStats()
  }, [])

  if (loading && !systemStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2">Loading system statistics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load system statistics: {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Usage Dashboard</h2>
          <p className="text-muted-foreground">
            System-wide API usage monitoring and management
          </p>
        </div>
        <Button onClick={loadSystemStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(systemStats?.totalUsers || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(systemStats?.totalRequests || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStats?.averageRequestsPerUser.toFixed(1)} per user avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Units</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(systemStats?.totalCostUnits || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total consumed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suspiciousActivity.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Unresolved issues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Endpoints Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Endpoints</CardTitle>
                <CardDescription>Most frequently used API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                {systemStats?.topEndpoints && systemStats.topEndpoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={systemStats.topEndpoints.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="endpoint" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No endpoint data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Users Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Requests</CardTitle>
                <CardDescription>Users with highest API usage</CardDescription>
              </CardHeader>
              <CardContent>
                {systemStats?.topUsers && systemStats.topUsers.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={systemStats.topUsers.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="userId" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No user data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>
                Click on a user to view detailed statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemStats?.topUsers && systemStats.topUsers.length > 0 ? (
                <div className="space-y-2">
                  {systemStats.topUsers.map((user, index) => (
                    <div 
                      key={user.userId} 
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => loadUserDetails(user.userId)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{user.userId.substring(0, 8)}...</p>
                          <p className="text-sm text-muted-foreground">User ID</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{user.requests.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{user.costUnits} units</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No user data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Suspicious Activity</span>
              </CardTitle>
              <CardDescription>
                Recent security alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suspiciousActivity.length > 0 ? (
                <div className="space-y-3">
                  {suspiciousActivity.map((activity) => (
                    <div key={activity.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getSeverityColor(activity.severity) as any}>
                            {activity.severity}
                          </Badge>
                          <span className="font-medium">{activity.activityType}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(activity.createdAt)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveSuspiciousActivity(activity.id)}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        User: {activity.userId.substring(0, 8)}...
                      </p>
                      
                      <p className="text-sm mb-2">
                        {activity.description}
                      </p>
                      
                      {Object.keys(activity.metadata).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            View metadata
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No suspicious activity detected</p>
                  <p className="text-sm">All user activity appears normal</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Management</CardTitle>
              <CardDescription>
                Update rate limits for specific users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetUserId">Target User ID</Label>
                  <Input
                    id="targetUserId"
                    value={rateLimitForm.targetUserId}
                    onChange={(e) => setRateLimitForm(prev => ({ ...prev, targetUserId: e.target.value }))}
                    placeholder="Enter user ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limitType">Limit Type</Label>
                  <Select
                    value={rateLimitForm.limitType}
                    onValueChange={(value: 'daily' | 'hourly' | 'monthly') => 
                      setRateLimitForm(prev => ({ ...prev, limitType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpointPattern">Endpoint Pattern (optional)</Label>
                  <Input
                    id="endpointPattern"
                    value={rateLimitForm.endpointPattern}
                    onChange={(e) => setRateLimitForm(prev => ({ ...prev, endpointPattern: e.target.value }))}
                    placeholder="e.g., %ai-analysis%"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRequests">Max Requests</Label>
                  <Input
                    id="maxRequests"
                    type="number"
                    value={rateLimitForm.maxRequests}
                    onChange={(e) => setRateLimitForm(prev => ({ ...prev, maxRequests: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCostUnits">Max Cost Units</Label>
                  <Input
                    id="maxCostUnits"
                    type="number"
                    value={rateLimitForm.maxCostUnits}
                    onChange={(e) => setRateLimitForm(prev => ({ ...prev, maxCostUnits: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <Button onClick={updateRateLimit} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Update Rate Limit
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed usage statistics and activity
            </DialogDescription>
          </DialogHeader>
          
          {userDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User ID</Label>
                  <p className="text-sm font-mono">{userDetails.user?.user_id}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{userDetails.user?.email || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{userDetails.statistics?.totalRequests || 0}</div>
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{userDetails.statistics?.totalCostUnits || 0}</div>
                    <p className="text-xs text-muted-foreground">Cost Units</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{userDetails.suspiciousActivity?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Security Alerts</p>
                  </CardContent>
                </Card>
              </div>

              {userDetails.rateLimits && userDetails.rateLimits.length > 0 && (
                <div>
                  <Label>Rate Limits</Label>
                  <div className="space-y-2 mt-2">
                    {userDetails.rateLimits.map((limit: any) => (
                      <div key={limit.id} className="border rounded p-2 text-sm">
                        <div className="flex justify-between">
                          <span>{limit.limitType} - {limit.endpointPattern || 'Global'}</span>
                          <span>{limit.currentRequests}/{limit.maxRequests} requests</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminUsageDashboard