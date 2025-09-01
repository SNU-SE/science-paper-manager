'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Activity, Server, Cpu, MemoryStick } from 'lucide-react'

interface HealthStatus {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  lastCheck: string
  error?: string
  metadata?: Record<string, any>
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthStatus[]
  timestamp: string
  uptime: number
}

interface ResourceMetrics {
  timestamp: string
  memory: {
    used: number
    total: number
    percentage: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  cpu: {
    user: number
    system: number
    percentage: number
    loadAverage: number[]
  }
  process: {
    uptime: number
    pid: number
    version: string
    activeHandles: number
    activeRequests: number
  }
  eventLoop: {
    delay: number
    utilization: number
  }
}

interface ResourceAlert {
  id: string
  type: 'memory' | 'cpu' | 'eventloop' | 'process'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: string
}

interface DetailedHealth {
  system: SystemHealth
  resources: {
    current: ResourceMetrics | null
    alerts: ResourceAlert[]
    summary: {
      average: Partial<ResourceMetrics>
      peak: Partial<ResourceMetrics>
      alertCount: number
    }
  }
  recovery: {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    actionStats: Record<string, { attempts: number; successes: number }>
  }
  timestamp: string
}

export function HealthDashboard() {
  const [healthData, setHealthData] = useState<DetailedHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealthData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/health/detailed')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setHealthData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
      console.error('Health data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchHealthData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'unhealthy':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000)
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading health data...</span>
      </div>
    )
  }

  if (error && !healthData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!healthData) {
    return <div>No health data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system health, resources, and recovery status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealthData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getStatusIcon(healthData.system.overall)}
            <span>System Status</span>
            <Badge variant={healthData.system.overall === 'healthy' ? 'default' : 'destructive'}>
              {healthData.system.overall.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            Uptime: {formatUptime(healthData.system.uptime)} | 
            Last Check: {new Date(healthData.system.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {healthData.system.services.map((service) => (
              <Card key={service.service}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="capitalize">{service.service.replace(/_/g, ' ')}</span>
                    {getStatusIcon(service.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Status:</span>
                      <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'}>
                        {service.status}
                      </Badge>
                    </div>
                    {service.responseTime && (
                      <div className="flex justify-between text-sm">
                        <span>Response Time:</span>
                        <span>{service.responseTime}ms</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Last Check:</span>
                      <span>{new Date(service.lastCheck).toLocaleTimeString()}</span>
                    </div>
                    {service.error && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertDescription className="text-xs">
                          {service.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          {healthData.resources.current && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Memory Usage */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center">
                    <MemoryStick className="h-4 w-4 mr-2" />
                    Memory Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Progress 
                      value={healthData.resources.current.memory.percentage} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-sm">
                      <span>{healthData.resources.current.memory.percentage.toFixed(1)}%</span>
                      <span>
                        {formatBytes(healthData.resources.current.memory.used)} / 
                        {formatBytes(healthData.resources.current.memory.total)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Heap: {formatBytes(healthData.resources.current.memory.heapUsed)} / 
                      {formatBytes(healthData.resources.current.memory.heapTotal)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CPU Usage */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center">
                    <Cpu className="h-4 w-4 mr-2" />
                    CPU Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Progress 
                      value={healthData.resources.current.cpu.percentage} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-sm">
                      <span>{healthData.resources.current.cpu.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Load: {healthData.resources.current.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Event Loop */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Event Loop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Delay:</span>
                      <span>{healthData.resources.current.eventLoop.delay.toFixed(2)}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Utilization:</span>
                      <span>{healthData.resources.current.eventLoop.utilization.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Process Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center">
                    <Server className="h-4 w-4 mr-2" />
                    Process Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>PID:</span>
                      <span>{healthData.resources.current.process.pid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime:</span>
                      <span>{formatUptime(healthData.resources.current.process.uptime * 1000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Handles:</span>
                      <span>{healthData.resources.current.process.activeHandles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Requests:</span>
                      <span>{healthData.resources.current.process.activeRequests}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {healthData.resources.alerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No active alerts</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {healthData.resources.alerts.map((alert) => (
                <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="capitalize">
                    {alert.severity} {alert.type} Alert
                  </AlertTitle>
                  <AlertDescription>
                    {alert.message}
                    <div className="mt-2 text-sm">
                      Value: {alert.value.toFixed(2)} | Threshold: {alert.threshold} | 
                      Time: {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recovery Tab */}
        <TabsContent value="recovery" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.recovery.totalAttempts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Successful</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {healthData.recovery.successfulAttempts}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {healthData.recovery.failedAttempts}
                </div>
              </CardContent>
            </Card>
          </div>

          {Object.keys(healthData.recovery.actionStats).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recovery Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(healthData.recovery.actionStats).map(([actionId, stats]) => (
                    <div key={actionId} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium">{actionId.replace(/_/g, ' ')}</span>
                      <div className="text-sm">
                        <span className="text-green-600">{stats.successes}</span> / 
                        <span className="text-gray-600">{stats.attempts}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}