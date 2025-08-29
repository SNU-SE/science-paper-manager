'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Info, ExternalLink, RefreshCw } from 'lucide-react'
import { getClientSafeEnvConfig } from '@/lib/env-check'

interface EnvironmentConfig {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  hasGoogleDrive: boolean
}

export function EnvironmentStatus() {
  const [config, setConfig] = useState<EnvironmentConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkEnvironmentConfig()
  }, [])

  const checkEnvironmentConfig = async () => {
    try {
      setIsLoading(true)
      const envConfig = getClientSafeEnvConfig()
      setConfig(envConfig)
    } catch (error) {
      console.error('Error checking environment config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSupabaseStatus = () => {
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      return {
        status: 'error',
        message: 'Supabase is not configured',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />
      }
    }
    return {
      status: 'success',
      message: 'Supabase is configured',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getGoogleDriveStatus = () => {
    if (!config?.hasGoogleDrive) {
      return {
        status: 'warning',
        message: 'Google Drive is not configured (optional)',
        icon: <Info className="h-4 w-4 text-yellow-500" />
      }
    }
    return {
      status: 'success',
      message: 'Google Drive is configured',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Checking environment configuration...
          </div>
        </CardContent>
      </Card>
    )
  }

  const supabaseStatus = getSupabaseStatus()
  const googleDriveStatus = getGoogleDriveStatus()
  const hasErrors = supabaseStatus.status === 'error'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              System Configuration Status
              {hasErrors && <AlertCircle className="h-5 w-5 text-red-500" />}
              {!hasErrors && <CheckCircle className="h-5 w-5 text-green-500" />}
            </CardTitle>
            <CardDescription>
              Environment variables and service connectivity status
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkEnvironmentConfig}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Supabase Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {supabaseStatus.icon}
            <div>
              <div className="font-medium">Supabase Database</div>
              <div className="text-sm text-gray-600">{supabaseStatus.message}</div>
            </div>
          </div>
          <Badge variant={supabaseStatus.status === 'success' ? 'default' : 'destructive'}>
            {supabaseStatus.status === 'success' ? 'Connected' : 'Not Configured'}
          </Badge>
        </div>

        {/* Google Drive Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {googleDriveStatus.icon}
            <div>
              <div className="font-medium">Google Drive Integration</div>
              <div className="text-sm text-gray-600">{googleDriveStatus.message}</div>
            </div>
          </div>
          <Badge variant={
            googleDriveStatus.status === 'success' ? 'default' : 
            googleDriveStatus.status === 'warning' ? 'secondary' : 'destructive'
          }>
            {googleDriveStatus.status === 'success' ? 'Available' : 'Optional'}
          </Badge>
        </div>

        {/* Error Messages and Solutions */}
        {hasErrors && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-3">
              <div>
                <strong>Configuration Issues Detected</strong>
              </div>
              
              {supabaseStatus.status === 'error' && (
                <div className="space-y-2">
                  <p>Supabase is not configured properly:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                    <li>Ensure <code>NEXT_PUBLIC_SUPABASE_URL</code> is set</li>
                    <li>Ensure <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> is set</li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://app.supabase.com', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Supabase Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://console.cloud.google.com', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Google Cloud Console
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Information for developers */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <strong>For Developers:</strong>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Check <code>.env.local</code> file for local development</li>
                <li>Verify environment variables in Vercel dashboard for production</li>
                <li>See <code>docs/ENVIRONMENT_SETUP.md</code> for detailed setup guide</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}