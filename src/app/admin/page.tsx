'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Users, 
  Server,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Shield,
  Zap,
  HardDrive,
  BarChart3,
  Settings,
  Eye,
  Play,
  Pause,
  XCircle
} from 'lucide-react'

interface SystemOverview {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  activeUsers: number
  backgroundJobs: {
    running: number
    pending: number
    failed: number
  }
  performance: {
    avgResponseTime: number
    errorRate: number
    requestsPerMinute: number
  }
  resources: {
    memoryUsage: number
    cpuUsage: number
    diskUsage: number
  }
  security: {
    activeThreats: number
    blockedRequests: number
    suspiciousActivity: number
  }
  backup: {
    lastBackup: string
    nextScheduled: string
    status: 'success' | 'failed' | 'running'
  }
  cache: {
    hitRate: number
    memoryUsage: number
    totalKeys: number
  }
}

interface BackgroundJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  userId?: string
  error?: string
}

interface UserActivity {
  userId: string
  email: string
  lastActivity: string
  sessionDuration: number
  actionsCount: number
  ipAddress: string
  userAgent: string
}

interface SecurityEvent {
  id: string
  type: 'suspicious_login' | 'rate_limit_exceeded' | 'invalid_token' | 'blocked_request'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  userId?: string
  ipAddress: string
  timestamp: string
  resolved: boolean
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([])
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, jobsRes, usersRes, securityRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/jobs?limit=10'),
        fetch('/api/admin/users/activity'),
        fetch('/api/security/events?limit=10')
      ])

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json()
        setOverview(overviewData.data)
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setBackgroundJobs(jobsData.data)
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUserActivity(usersData.data)
      }

      if (securityRes.ok) {
        const securityData = await securityRes.json()
        setSecurityEvents(securityData.data)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchDashboardData, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Activity className="h-5 w-5 text-gray-500" />
    }
  }

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'running':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Running</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      case 'high':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800">High</Badge>
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium</Badge>
      case 'low':
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await fetchDashboardData()
      }
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const resolveSecurityEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/security/events/${eventId}/resolve`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await fetchDashboardData()
      }
    } catch (error) {
      console.error('Failed to resolve security event:', error)
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading dashboard...</span>
      </div>
    )
  }

  if (error && !overview) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Administration</h1>
          <p className="text-muted-foreground">
            Monitor and manage your Science Paper Manager system
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Auto-refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                {getStatusIcon(overview.status)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{overview.status}</div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {formatUptime(overview.uptime)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.activeUsers}</div>
                <p className="text-xs text-muted-foreground">
                  Currently online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Background Jobs</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.backgroundJobs.running}</div>
                <p className="text-xs text-muted-foreground">
                  {overview.backgroundJobs.pending} pending, {overview.backgroundJobs.failed} failed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.performance.avgResponseTime}ms</div>
                <p className="text-xs text-muted-foreground">
                  {overview.performance.errorRate}% error rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Server className="h-4 w-4 mr-2" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={overview.resources.memoryUsage} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {overview.resources.memoryUsage}% used
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={overview.resources.cpuUsage} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {overview.resources.cpuUsage}% used
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <HardDrive className="h-4 w-4 mr-2" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={overview.resources.diskUsage} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {overview.resources.diskUsage}% used
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Service Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Threats</span>
                    <Badge variant={overview.security.activeThreats > 0 ? 'destructive' : 'default'}>
                      {overview.security.activeThreats}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Blocked Requests</span>
                    <span>{overview.security.blockedRequests}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Suspicious Activity</span>
                    <span>{overview.security.suspiciousActivity}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Backup Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Status</span>
                    <Badge variant={overview.backup.status === 'success' ? 'default' : 'destructive'}>
                      {overview.backup.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last: {new Date(overview.backup.lastBackup).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next: {new Date(overview.backup.nextScheduled).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Hit Rate</span>
                    <span>{overview.cache.hitRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>{overview.cache.memoryUsage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Keys</span>
                    <span>{overview.cache.totalKeys}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Background Jobs</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Background Jobs</CardTitle>
              <CardDescription>
                Monitor and manage background processing tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {backgroundJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No background jobs found
                  </div>
                ) : (
                  backgroundJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Settings className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{job.type}</span>
                            {getJobStatusBadge(job.status)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Created: {new Date(job.createdAt).toLocaleString()}
                          </div>
                          {job.status === 'running' && (
                            <div className="mt-2">
                              <Progress value={job.progress} className="w-48" />
                              <span className="text-xs text-muted-foreground">{job.progress}%</span>
                            </div>
                          )}
                          {job.error && (
                            <div className="text-sm text-red-600 mt-1">
                              Error: {job.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {job.status === 'running' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => cancelJob(job.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('/admin/jobs', '_blank')}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  View Full Job Management Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>
                Monitor current user sessions and activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No active users found
                  </div>
                ) : (
                  userActivity.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Last activity: {new Date(user.lastActivity).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Session: {Math.floor(user.sessionDuration / 60)}m • {user.actionsCount} actions
                          </div>
                          <div className="text-xs text-muted-foreground">
                            IP: {user.ipAddress}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('/admin/users', '_blank')}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View Full User Management Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Monitor security incidents and threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No security events</p>
                  </div>
                ) : (
                  securityEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{event.type.replace(/_/g, ' ')}</span>
                            {getSeverityBadge(event.severity)}
                            {event.resolved && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {event.message}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()} • IP: {event.ipAddress}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!event.resolved && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resolveSecurityEvent(event.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}