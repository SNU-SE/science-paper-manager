'use client'

import { useState, useCallback } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Download, Upload, Trash2, Settings, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RAGChat } from '@/components/search/RAGChat'
import { SemanticSearch } from '@/components/search/SemanticSearch'
import { useRAGChat } from '@/hooks/useRAGChat'
import type { SearchFilters } from '@/types'

export default function ChatPage() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [showStats, setShowStats] = useState(false)
  
  // Get OpenAI API key from localStorage (in a real app, this would be more secure)
  const openaiApiKey = typeof window !== 'undefined' 
    ? localStorage.getItem('openai-api-key') || ''
    : ''

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    exportHistory,
    importHistory,
    conversationStats
  } = useRAGChat({
    openaiApiKey,
    autoSave: true,
    storageKey: 'science-paper-rag-chat'
  })

  const handleSendMessage = useCallback(async (message: string) => {
    await sendMessage(message, searchFilters)
  }, [sendMessage, searchFilters])

  const handleApplyFilters = useCallback(async (query: string, filters?: SearchFilters) => {
    setSearchFilters(filters || {})
    if (query.trim()) {
      await sendMessage(query, filters)
    }
  }, [sendMessage])

  const handleImportHistory = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        
        if (data.messages && Array.isArray(data.messages)) {
          importHistory(data.messages)
        } else {
          alert('Invalid chat history file format')
        }
      } catch (error) {
        console.error('Failed to import history:', error)
        alert('Failed to import chat history')
      }
    }
    reader.readAsText(file)
  }, [importHistory])

  const handleClearHistory = useCallback(() => {
    if (confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
      clearHistory()
    }
  }, [clearHistory])

  if (!openaiApiKey) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8">
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Please configure your OpenAI API key in the settings to use the RAG chat feature.
          </AlertDescription>
        </Alert>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Research Chat</h1>
          <p className="text-muted-foreground">
            Ask questions about your paper collection and get AI-powered answers
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Statistics */}
          <Dialog open={showStats} onOpenChange={setShowStats}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Stats
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conversation Statistics</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{conversationStats.messageCount}</div>
                      <p className="text-xs text-muted-foreground">Total Messages</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{conversationStats.userMessages}</div>
                      <p className="text-xs text-muted-foreground">Questions Asked</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{conversationStats.assistantMessages}</div>
                      <p className="text-xs text-muted-foreground">AI Responses</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{conversationStats.sourcesReferenced}</div>
                      <p className="text-xs text-muted-foreground">Papers Referenced</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export History */}
          <Button variant="outline" size="sm" onClick={exportHistory}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {/* Import History */}
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImportHistory}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Clear History */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearHistory}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Filters Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Filters</CardTitle>
              <p className="text-sm text-muted-foreground">
                Apply filters to focus your questions on specific papers
              </p>
            </CardHeader>
            <CardContent>
              <SemanticSearch
                onSearch={handleApplyFilters}
                placeholder="Ask a question or apply filters..."
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Active Filters Display */}
          {Object.keys(searchFilters).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {searchFilters.readingStatus && (
                  <div>
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {searchFilters.readingStatus.map(status => (
                        <Badge key={status} variant="secondary" className="text-xs">
                          {status}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {searchFilters.publicationYear && (
                  <div>
                    <span className="text-xs text-muted-foreground">Year:</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {searchFilters.publicationYear.min || ''}-{searchFilters.publicationYear.max || ''}
                    </Badge>
                  </div>
                )}
                
                {searchFilters.rating && (
                  <div>
                    <span className="text-xs text-muted-foreground">Rating:</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {searchFilters.rating.min || 1}-{searchFilters.rating.max || 5}★
                    </Badge>
                  </div>
                )}
                
                {searchFilters.tags && searchFilters.tags.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {searchFilters.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <RAGChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            error={error}
            className="w-full"
          />
        </div>
      </div>
      </div>
    </ProtectedRoute>
  )
}