'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { 
  Activity, 
  Database, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Trash2,
  TrendingUp,
  Clock,
  HardDrive
} from 'lucide-react'

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  localHits: number
  redisHits: number
  totalKeys: number
  memoryUsage: number
}

interface CacheMetrics {
  hitRate: number
  missRate: number
  localHitRate: number
  redisHitRate: number
  averageResponseTime: number
  memoryEfficiency: number
  keyDistribution: Record<string, number>
  hotKeys: Array<{ key: string; accessCount: number }>
  recommendations: string[]
}

interface CacheAlert {
  type: 'performance' | 'memory' | 'error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
}

interface CacheOverview {
  stats: CacheStats
  metrics: CacheMetrics
  health: {
    status: 'healthy' | 'unhealthy'
    metrics: any
    recommendations: string[]
  }
  score: number
}

export default function CacheDashboard() {
  const [overview, setOverview] = useState<CacheOverview | null>(null)
  const [alerts, setAlerts] = useState<CacheAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchCacheData = async () => {
    try {
      setRefreshing(true)
      
      const [overviewResponse, alertsResponse] = await Promise.all([
        fetch('/api/cache'),
        fetch('/api/cache?action=alerts&limit=20')
      ])

      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json()
        setOverview(overviewData.data)
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlerts(alertsData.data.map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp)
        })))
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch cache data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const clearCache = async () => {
    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchCacheData()
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  const optimizeCache = async () => {
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optimize' })
      })

      if (response.ok) {
        await fetchCacheData()
      }
    } catch (error) {
      console.error('Failed to optimize cache:', error)
    }
  }

  useEffect(() => {
    fetchCacheData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCacheData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading cache data...</span>
      </div>
    )
  }

  if (!overview) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load cache data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  const getHealthBadge = (status: string, score: number) => {
    if (status === 'unhealthy' || score < 50) {
      return <Badge variant="destructive">Unhealthy</Badge>
    } else if (score < 80) {
      return <Badge variant="secondary">Fair</Badge>
    } else {
      return <Badge variant="default">Healthy</Badge>
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-yellow-600'
      default: return 'text-blue-600'
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cache Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage system cache performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCacheData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={optimizeCache}
          >
            <Zap className="h-4 w-4 mr-2" />
            Optimize
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearCache}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Status</CardTitle>
            {overview.health.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getHealthBadge(overview.health.status, overview.score)}
              <span className="text-2xl font-bold">{overview.score}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.metrics.hitRate.toFixed(1)}%
            </div>
            <Progress value={overview.metrics.hitRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.metrics.averageResponseTime.toFixed(1)}ms
            </div>
            <p className="text-xs text-muted-foreground">Average response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(overview.stats.memoryUsage)}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview.stats.totalKeys} keys
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="keys">Hot Keys</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Hits:</span>
                  <span className="font-mono">{overview.stats.hits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Misses:</span>
                  <span className="font-mono">{overview.stats.misses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Local Hits:</span>
                  <span className="font-mono">{overview.stats.localHits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Redis Hits:</span>
                  <span className="font-mono">{overview.stats.redisHits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sets:</span>
                  <span className="font-mono">{overview.stats.sets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deletes:</span>
                  <span className="font-mono">{overview.stats.deletes.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Hit Rate:</span>
                  <span className="font-mono">{overview.metrics.hitRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Miss Rate:</span>
                  <span className="font-mono">{overview.metrics.missRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Local Hit Rate:</span>
                  <span className="font-mono">{overview.metrics.localHitRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Redis Hit Rate:</span>
                  <span className="font-mono">{overview.metrics.redisHitRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Efficiency:</span>
                  <span className="font-mono">{overview.metrics.memoryEfficiency.toFixed(2)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Key Distribution</CardTitle>
              <CardDescription>Distribution of cache keys by prefix</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(overview.metrics.keyDistribution).map(([prefix, count]) => (
                  <div key={prefix} className="flex items-center justify-between">
                    <span className="text-sm">{prefix}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(overview.metrics.keyDistribution))) * 100}%`
                          }}
                        />
                      </div>
                      <span className="text-sm font-mono w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Cache performance and health alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-muted-foreground">No recent alerts</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${getSeverityColor(alert.severity)}`} />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{alert.type}</Badge>
                          <Badge variant="outline">{alert.severity}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hot Keys</CardTitle>
              <CardDescription>Most frequently accessed cache keys</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.metrics.hotKeys.length === 0 ? (
                <p className="text-muted-foreground">No hot keys detected</p>
              ) : (
                <div className="space-y-2">
                  {overview.metrics.hotKeys.map((hotKey, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-mono truncate flex-1 mr-4">
                        {hotKey.key}
                      </span>
                      <Badge variant="secondary">
                        {hotKey.accessCount.toLocaleString()} hits
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>Suggestions to improve cache performance</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.metrics.recommendations.length === 0 ? (
                <p className="text-muted-foreground">No recommendations at this time</p>
              ) : (
                <div className="space-y-2">
                  {overview.metrics.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Activity className="h-4 w-4 text-blue-600 mt-0.5" />
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}