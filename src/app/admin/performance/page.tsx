'use client'

import React from 'react'
import PerformanceDashboard from '@/components/monitoring/PerformanceDashboard'
import { usePerformanceMonitoring, usePerformanceAlerts } from '@/hooks/usePerformanceMonitoring'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function PerformancePage() {
  const { alerts, acknowledgeAlert, dismissAlert } = usePerformanceAlerts()

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor system performance, track metrics, and manage alerts
          </p>
        </div>
      </div>

      {/* Active Alerts Summary */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Active Alerts ({alerts.length})
            </CardTitle>
            <CardDescription>
              Critical performance issues requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">
                        {alert.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Current: {alert.value} | Threshold: {alert.threshold}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeAlert(alert.type)}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dismissAlert(alert.type)}
                    >
                      <XCircle className="h-4 w-4" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard */}
      <PerformanceDashboard />

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance Tips</CardTitle>
            <CardDescription>Recommendations for optimal performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Monitor API response times regularly</li>
              <li>• Optimize database queries that exceed 500ms</li>
              <li>• Keep error rates below 5%</li>
              <li>• Monitor memory usage and implement caching</li>
              <li>• Set up automated alerts for critical thresholds</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring Coverage</CardTitle>
            <CardDescription>What we're currently tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>API Endpoints</span>
                <Badge variant="secondary">All Routes</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Database Queries</span>
                <Badge variant="secondary">Supabase</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>User Activities</span>
                <Badge variant="secondary">Authenticated</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>System Resources</span>
                <Badge variant="secondary">Node.js Process</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}