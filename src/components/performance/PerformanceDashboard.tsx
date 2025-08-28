'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePerformance } from './PerformanceProvider'
import { PerformanceMonitor } from '@/utils/performance'
import { monitoring } from '@/utils/monitoring'

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  status: 'good' | 'warning' | 'critical'
  threshold: number
}

export function PerformanceDashboard() {
  const { metrics, isMonitoring } = usePerformance()
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [monitoringStats, setMonitoringStats] = useState<any>({})

  useEffect(() => {
    const updateMetrics = () => {
      const monitor = PerformanceMonitor.getInstance()
      const allStats = monitor.getAllStats()
      
      const formattedMetrics: PerformanceMetric[] = Object.entries(allStats).map(([name, stats]) => {
        const avgValue = stats.avg
        let status: 'good' | 'warning' | 'critical' = 'good'
        let threshold = 1000 // Default 1 second threshold
        
        // Set thresholds based on metric type
        if (name.includes('render')) {
          threshold = 16 // 16ms for 60fps
          status = avgValue > 50 ? 'critical' : avgValue > 16 ? 'warning' : 'good'
        } else if (name.includes('api')) {
          threshold = 2000 // 2 seconds for API calls
          status = avgValue > 5000 ? 'critical' : avgValue > 2000 ? 'warning' : 'good'
        } else if (name.includes('memory')) {
          threshold = 50 * 1024 * 1024 // 50MB
          status = avgValue > 100 * 1024 * 1024 ? 'critical' : avgValue > threshold ? 'warning' : 'good'
        } else if (name.includes('lcp')) {
          threshold = 2500 // 2.5s for LCP
          status = avgValue > 4000 ? 'critical' : avgValue > 2500 ? 'warning' : 'good'
        }
        
        return {
          name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: avgValue,
          unit: name.includes('memory') ? 'MB' : 'ms',
          status,
          threshold
        }
      })
      
      setPerformanceMetrics(formattedMetrics)
      setMonitoringStats(monitoring.getStats())
    }
    
    updateMetrics()
    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds
    
    return () => clearInterval(interval)
  }, [metrics])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatValue = (value: number, unit: string) => {
    if (unit === 'MB') {
      return `${(value / (1024 * 1024)).toFixed(2)} ${unit}`
    }
    return `${value.toFixed(2)} ${unit}`
  }

  const clearMetrics = () => {
    const monitor = PerformanceMonitor.getInstance()
    monitor.clearMetrics()
    setPerformanceMetrics([])
  }

  const runHealthCheck = async () => {
    const isHealthy = await monitoring.healthCheck()
    alert(isHealthy ? 'System is healthy!' : 'System health check failed!')
  }

  if (!isMonitoring) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Monitoring</CardTitle>
          <CardDescription>Performance monitoring is currently disabled</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Enable performance monitoring in your environment variables to see metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-gray-600">Monitor application performance and health</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runHealthCheck} variant="outline">
            Health Check
          </Button>
          <Button onClick={clearMetrics} variant="outline">
            Clear Metrics
          </Button>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring Stats</TabsTrigger>
          <TabsTrigger value="web-vitals">Web Vitals</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performanceMetrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {metric.name}
                    </CardTitle>
                    <Badge className={getStatusColor(metric.status)}>
                      {metric.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatValue(metric.value, metric.unit)}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Threshold: {formatValue(metric.threshold, metric.unit)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {performanceMetrics.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-600">
                  No performance metrics available yet. Use the application to generate metrics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Error Queue Size:</span>
                    <Badge variant={monitoringStats.errorQueueSize > 0 ? 'destructive' : 'secondary'}>
                      {monitoringStats.errorQueueSize || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Monitoring Enabled:</span>
                    <Badge variant={monitoringStats.isEnabled ? 'default' : 'secondary'}>
                      {monitoringStats.isEnabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  {monitoringStats.userId && (
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="text-sm font-mono">{monitoringStats.userId}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Performance Queue Size:</span>
                    <Badge variant={monitoringStats.performanceQueueSize > 0 ? 'default' : 'secondary'}>
                      {monitoringStats.performanceQueueSize || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Monitoring:</span>
                    <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                      {isMonitoring ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="web-vitals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['lcp', 'fid', 'cls'].map((vital) => {
              const metric = performanceMetrics.find(m => 
                m.name.toLowerCase().includes(vital)
              )
              
              return (
                <Card key={vital}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {vital.toUpperCase()}
                    </CardTitle>
                    <CardDescription>
                      {vital === 'lcp' && 'Largest Contentful Paint'}
                      {vital === 'fid' && 'First Input Delay'}
                      {vital === 'cls' && 'Cumulative Layout Shift'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metric ? (
                      <div>
                        <div className="text-2xl font-bold">
                          {formatValue(metric.value, metric.unit)}
                        </div>
                        <Badge className={getStatusColor(metric.status)}>
                          {metric.status}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No data available</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Web Vitals Thresholds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>LCP (Largest Contentful Paint):</strong> Good ≤ 2.5s, Needs Improvement ≤ 4s, Poor &gt; 4s</div>
                <div><strong>FID (First Input Delay):</strong> Good ≤ 100ms, Needs Improvement ≤ 300ms, Poor &gt; 300ms</div>
                <div><strong>CLS (Cumulative Layout Shift):</strong> Good ≤ 0.1, Needs Improvement ≤ 0.25, Poor &gt; 0.25</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}