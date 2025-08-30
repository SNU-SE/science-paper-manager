'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthenticationVerifier } from '@/components/auth/AuthenticationVerifier'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ZoteroManager } from '@/components/zotero'
import { APIKeyManager } from '@/components/ai/APIKeyManager'
import { AIModelSelector } from '@/components/ai/AIModelSelector'
import { GoogleDriveSettings } from '@/components/settings/GoogleDriveSettings'
import { SettingsBackup } from '@/components/settings/SettingsBackup'
import { EnvironmentStatus } from '@/components/settings/EnvironmentStatus'
import { useAuthenticationSecurity } from '@/hooks/useAuthenticationSecurity'
import { useAuth } from '@/components/auth/AuthProvider'
import { Bot, Key, Cloud, BookOpen, Shield, AlertTriangle, Download, Settings } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('system-status')
  const { isAuthenticated, isSessionValid, error, verifyUserSession } = useAuthenticationSecurity()
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      <AuthenticationVerifier requireAuth={true}>
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold">Settings</h1>
                  <p className="text-gray-600 mt-2">
                    Configure your integrations, AI models, and preferences
                  </p>
                </div>
              </div>
              
              {/* Security Status Indicator */}
              {isAuthenticated && isSessionValid && (
                <Alert className="mb-6 border-green-200 bg-green-50">
                  <Shield className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your session is secure and authenticated. All settings are encrypted and protected by Row Level Security.
                  </AlertDescription>
                </Alert>
              )}
              
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Security Warning: {error}
                  </AlertDescription>
                </Alert>
              )}
            </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="system-status" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Status
            </TabsTrigger>
            <TabsTrigger value="ai-config" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Configuration
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="cloud-storage" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Cloud Storage
            </TabsTrigger>
            <TabsTrigger value="reference-manager" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Reference Manager
            </TabsTrigger>
            <TabsTrigger value="backup-restore" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Backup & Restore
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="system-status" className="space-y-6">
              <EnvironmentStatus />
            </TabsContent>

            <TabsContent value="ai-config" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    AI Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure and select AI models for paper analysis. Set up model preferences, parameters, and defaults for each provider.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AIModelSelector />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Key Management
                  </CardTitle>
                  <CardDescription>
                    Securely store and manage your AI provider API keys. All keys are encrypted and stored safely in your database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <APIKeyManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cloud-storage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Cloud Storage
                  </CardTitle>
                  <CardDescription>
                    Connect your Google Drive to automatically sync and backup your research papers and documents.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GoogleDriveSettings />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reference-manager" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Reference Manager
                  </CardTitle>
                  <CardDescription>
                    Connect your Zotero library to sync papers, references, and metadata automatically. Configure sync settings and manage your integration.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ZoteroManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup-restore" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Backup & Restore
                  </CardTitle>
                  <CardDescription>
                    Export your settings to a secure backup file or restore settings from a previous backup. Keep your configurations safe and portable.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user?.id ? (
                    <SettingsBackup 
                      userId={user.id} 
                      onSuccess={() => {/* Backup success */}}
                      onError={() => {/* Backup error */}}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Please sign in to access backup and restore features.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
          </div>
        </div>
      </AuthenticationVerifier>
    </ProtectedRoute>
  )
}