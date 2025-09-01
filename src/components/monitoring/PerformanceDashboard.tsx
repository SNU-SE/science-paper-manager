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
  Clock, 
  Database, 
  Users, 
  Server,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react'

interface PerformanceMetrics {
  apiMetrics: {
    averageResponseTime: number
    requestsPerMinute: number
    errorRate: number
    slowestEndpoints: Array<{
      endpoint: string
      averageResponseTime: number
      requestCount: number
      errorRate: number
    }>
  }
  databaseMetrics: {
    averageQueryTime: number
    slowestQueries: Array<{
      queryHash: string
      queryType: string
      averageExecutionTime: number
      executionCount: number
      tableName?: string
    }>
    connectionPoolStatus: {
      totalConnections: number
      activeConnections: number
      idleConnections: number
      waitingConnections: number
    }
  }
  userMetrics: {
    activeUsers: number
    mostUsedFeatures: Array<{
      feature: string
      usageCount: number
      uniqueUsers: number
    }>
    userSessions: Array<{
      sessionId: string
      userId: string
      duration: number
      activityCount: number
    }>
  }
  systemMetrics: {
    memoryUsage: number
    cpuUsage: number
    diskUsage: number
    uptime: number
  }
}

interface Alert {
  type: string
  message: string
  value: number
  threshold: number
}

interface DashboardData {
  recent: PerformanceMetrics
  daily: PerformanceMetrics
  slowQueries: Array<{
    queryHash: string
    queryType: string
    averageExecutionTime: number
    executionCount: number
    tableName?: string
  }>
  errorRates: Array<{
    endpoint: string
    errorCount: number
    errors: Record<string, number>
  }>
  activeUsers: number
  alerts: Alert[]
  timestamp: string
}

export default function PerformanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/monitoring/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchDashboardData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold
    return isGood ? 'text-green-600' : 'text-red-600'
  }

  const getProgressColor = (value: number, max: number) => {
    const percentage = (value / max) * 100
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Active Alerts</h2>
          {data.alerts.map((alert, index) => (
            <Alert key={index} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.type.replace('_', ' ').toUpperCase()}</AlertTitle>
              <AlertDescription>
                {alert.message} (Current: {alert.value}, Threshold: {alert.threshold})
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.recent.apiMetrics.averageResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              {data.recent.apiMetrics.requestsPerMinute} req/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.recent.apiMetrics.errorRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(data.recent.systemMetrics.uptime)}
            </div>
            <p className="text-xs text-muted-foreground">
              Running smoothly
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api">API Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="system">System Resources</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>Average response times in the last hour</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recent.apiMetrics.slowestEndpoints.slice(0, 5).map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{endpoint.endpoint}</p>
                        <p className="text-xs text-muted-foreground">
                          {endpoint.requestCount} requests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{endpoint.averageResponseTime}ms</p>
                        <p className="text-xs text-muted-foreground">
                          {endpoint.errorRate}% errors
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rates by Endpoint</CardTitle>
                <CardDescription>Endpoints with highest error rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.errorRates.slice(0, 5).map((error, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{error.endpoint}</p>
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(error.errors).map(([code, count]) => 
                            `${code}: ${count}`
                          ).join(', ')}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {error.errorCount} errors
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Slowest Queries</CardTitle>
                <CardDescription>Database queries with highest execution times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.slowQueries.slice(0, 5).map((query, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{query.queryType}</p>
                        <p className="text-xs text-muted-foreground">
                          {query.tableName && `Table: ${query.tableName} • `}
                          {query.executionCount} executions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{query.averageExecutionTime}ms</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Pool Status</CardTitle>
                <CardDescription>Database connection pool utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Active Connections</span>
                      <span>{data.recent.databaseMetrics.connectionPoolStatus.activeConnections}/{data.recent.databaseMetrics.connectionPoolStatus.totalConnections}</span>
                    </div>
                    <Progress 
                      value={(data.recent.databaseMetrics.connectionPoolStatus.activeConnections / data.recent.databaseMetrics.connectionPoolStatus.totalConnections) * 100}
                      className="mt-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Idle</p>
                      <p className="font-medium">{data.recent.databaseMetrics.connectionPoolStatus.idleConnections}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Waiting</p>
                      <p className="font-medium">{data.recent.databaseMetrics.connectionPoolStatus.waitingConnections}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>Current memory consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Heap Used</span>
                      <span>{data.recent.systemMetrics.memoryUsage} MB</span>
                    </div>
                    <Progress 
                      value={(data.recent.systemMetrics.memoryUsage / 512) * 100} // Assuming 512MB max
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CPU Usage</CardTitle>
                <CardDescription>Processor utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>CPU Time</span>
                      <span>{data.recent.systemMetrics.cpuUsage} ms</span>
                    </div>
                    <Progress 
                      value={Math.min((data.recent.systemMetrics.cpuUsage / 10000) * 100, 100)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Used Features</CardTitle>
                <CardDescription>Feature usage in the last hour</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recent.userMetrics.mostUsedFeatures.slice(0, 5).map((feature, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{feature.feature}</p>
                        <p className="text-xs text-muted-foreground">
                          {feature.uniqueUsers} unique users
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {feature.usageCount} uses
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>Current user engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Users (1h)</span>
                    <span className="font-medium">{data.activeUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Sessions</span>
                    <span className="font-medium">{data.recent.userMetrics.userSessions.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}