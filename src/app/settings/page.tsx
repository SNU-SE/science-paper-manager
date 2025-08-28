'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ZoteroManager } from '@/components/zotero'
import { APIKeyManager } from '@/components/ai/APIKeyManager'
import { AIModelSelector } from '@/components/ai/AIModelSelector'
import { GoogleDriveSettings } from '@/components/settings/GoogleDriveSettings'
import { Bot, Key, Cloud, BookOpen } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai-config')

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your integrations, AI models, and preferences
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
          </TabsList>

          <div className="mt-6">
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
          </div>
        </Tabs>
      </div>
    </div>
  )
}