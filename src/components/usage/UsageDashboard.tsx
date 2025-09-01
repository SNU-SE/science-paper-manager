'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAPIUsage } from '@/hooks/useAPIUsage'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Zap,
  Shield,
  RefreshCw
} from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function UsageDashboard() {
  const {
    statistics,
    rateLimits,
    suspiciousActivity,
    loading,
    error,
    getRemainingRequests,
    getRemainingCostUnits,
    refresh
  } = useAPIUsage()

  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  const dailyLimit = getRemainingRequests('daily')
  const hourlyLimit = getRemainingRequests('hourly')
  const dailyCostLimit = getRemainingCostUnits('daily')

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

  if (loading && !statistics) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2">Loading usage data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load usage data: {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Usage Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor your API usage and rate limits
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Rate Limit Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dailyLimit ? (
              <>
                <div className="text-2xl font-bold">
                  {dailyLimit.remaining.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {dailyLimit.total.toLocaleString()} remaining
                </p>
                <Progress 
                  value={dailyLimit.percentage} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Resets at {formatDate(dailyLimit.resetTime)}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No daily limit set</div>
            )}
          </CardContent>
        </Card>

        {/* Hourly Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hourly Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {hourlyLimit ? (
              <>
                <div className="text-2xl font-bold">
                  {hourlyLimit.remaining.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {hourlyLimit.total.toLocaleString()} remaining
                </p>
                <Progress 
                  value={hourlyLimit.percentage} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Resets at {formatDate(hourlyLimit.resetTime)}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No hourly limit set</div>
            )}
          </CardContent>
        </Card>

        {/* Daily Cost Units */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Cost Units</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dailyCostLimit ? (
              <>
                <div className="text-2xl font-bold">
                  {dailyCostLimit.remaining.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {dailyCostLimit.total.toLocaleString()} remaining
                </p>
                <Progress 
                  value={dailyCostLimit.percentage} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Resets at {formatDate(dailyCostLimit.resetTime)}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No cost limit set</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(statistics?.totalRequests || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics?.averageRequestsPerDay.toFixed(1)} per day avg
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Analysis</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(statistics?.aiAnalysisRequests || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics?.totalRequests ? 
                    ((statistics.aiAnalysisRequests / statistics.totalRequests) * 100).toFixed(1) : 0}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Search Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(statistics?.searchRequests || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics?.totalRequests ? 
                    ((statistics.searchRequests / statistics.totalRequests) * 100).toFixed(1) : 0}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Units</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(statistics?.totalCostUnits || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total consumed
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints</CardTitle>
              <CardDescription>
                Most frequently used API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statistics?.topEndpoints && statistics.topEndpoints.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statistics.topEndpoints.slice(0, 10)}>
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
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="space-y-2">
                    {statistics.topEndpoints.slice(0, 5).map((endpoint, index) => (
                      <div key={endpoint.endpoint} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-sm font-medium">{endpoint.endpoint}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{endpoint.count}</div>
                          <div className="text-xs text-muted-foreground">{endpoint.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No endpoint data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate Limits Tab */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>
                Your current rate limits and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimits.length > 0 ? (
                <div className="space-y-4">
                  {rateLimits.map((limit) => (
                    <div key={limit.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium capitalize">{limit.limitType} Limit</h4>
                          {limit.endpointPattern && (
                            <p className="text-sm text-muted-foreground">
                              Pattern: {limit.endpointPattern}
                            </p>
                          )}
                        </div>
                        <Badge variant={limit.isActive ? 'default' : 'secondary'}>
                          {limit.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Requests</p>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {limit.currentRequests} / {limit.maxRequests}
                            </span>
                            <Progress 
                              value={(limit.currentRequests / limit.maxRequests) * 100} 
                              className="flex-1"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm text-muted-foreground">Cost Units</p>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {limit.currentCostUnits} / {limit.maxCostUnits}
                            </span>
                            <Progress 
                              value={(limit.currentCostUnits / limit.maxCostUnits) * 100} 
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Window started: {formatDate(limit.windowStart)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No rate limits configured
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
                Recent security alerts and unusual usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suspiciousActivity.length > 0 ? (
                <div className="space-y-3">
                  {suspiciousActivity.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getSeverityColor(activity.severity) as any}>
                            {activity.severity}
                          </Badge>
                          <span className="font-medium">{activity.activityType}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(activity.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {activity.description}
                      </p>
                      
                      {Object.keys(activity.metadata).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <details>
                            <summary className="cursor-pointer">View details</summary>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                      
                      {activity.isResolved && (
                        <Badge variant="secondary" className="mt-2">
                          Resolved {activity.resolvedAt && formatDate(activity.resolvedAt)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No suspicious activity detected</p>
                  <p className="text-sm">Your account usage appears normal</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default UsageDashboard