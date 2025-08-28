'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIModelSelector } from './AIModelSelector'
import { AnalysisComparison } from './AnalysisComparison'
import { useAIAnalysis } from '@/hooks/useAIAnalysis'
import { Paper } from '@/types'
import { AIProvider } from '@/services/ai/AIServiceFactory'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Brain, FileText, Settings } from 'lucide-react'

// Mock paper data for demonstration
const mockPaper: Paper = {
  id: 'demo-paper-1',
  title: 'Deep Learning Approaches for Natural Language Processing: A Comprehensive Survey',
  authors: ['John Smith', 'Jane Doe', 'Bob Johnson'],
  journal: 'Journal of AI Research',
  publicationYear: 2024,
  doi: '10.1000/demo.2024.001',
  abstract: 'This paper presents a comprehensive survey of deep learning approaches in natural language processing. We examine various architectures including transformers, recurrent neural networks, and convolutional neural networks, analyzing their effectiveness across different NLP tasks such as sentiment analysis, machine translation, and question answering. Our analysis covers recent developments in large language models and their impact on the field.',
  readingStatus: 'unread',
  dateAdded: new Date('2024-01-15'),
  lastModified: new Date('2024-01-15')
}

export function AIAnalysisDemo() {
  const [activeTab, setActiveTab] = useState<'setup' | 'analysis'>('setup')
  const [demoStarted, setDemoStarted] = useState(false)
  
  const {
    analyses,
    isAnalyzing,
    selectedModels,
    apiKeys,

    error,
    setSelectedModels,
    updateApiKey,
    validateApiKey,
    startAnalysis,
    reanalyzeWithProvider
  } = useAIAnalysis({ paperId: mockPaper.id, autoLoad: false })

  const handleStartDemo = async () => {
    if (selectedModels.length === 0) {
      return
    }
    
    setDemoStarted(true)
    setActiveTab('analysis')
    await startAnalysis(mockPaper)
  }

  const handleReanalyze = async (provider: AIProvider) => {
    await reanalyzeWithProvider(mockPaper, provider)
  }

  const hasValidModels = selectedModels.some(model => apiKeys[model])
  const completedAnalyses = Object.keys(analyses).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Analysis Demo
          </CardTitle>
          <CardDescription>
            Demonstrate the AI model selector and analysis comparison components with a sample research paper.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'setup' | 'analysis')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="setup" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Setup Models
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                View Analysis
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="setup" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Sample Paper</h3>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h4 className="font-medium">{mockPaper.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {mockPaper.authors.join(', ')} • {mockPaper.journal} • {mockPaper.publicationYear}
                        </p>
                        <p className="text-sm">{mockPaper.abstract}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Configure AI Models</h3>
                  <AIModelSelector
                    selectedModels={selectedModels}
                    onSelectionChange={setSelectedModels}
                    apiKeys={apiKeys}
                    onApiKeyUpdate={updateApiKey}
                    onApiKeyValidate={validateApiKey}
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <div>
                    {hasValidModels ? (
                      <p className="text-sm text-muted-foreground">
                        Ready to analyze with {selectedModels.length} model(s)
                      </p>
                    ) : (
                      <Alert>
                        <AlertDescription>
                          Configure at least one AI model with a valid API key to start analysis.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <Button
                    onClick={handleStartDemo}
                    disabled={!hasValidModels || isAnalyzing}
                    size="lg"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Start Analysis Demo'}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="analysis" className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {!demoStarted && completedAnalyses === 0 ? (
                <Alert>
                  <AlertDescription>
                    Configure AI models in the Setup tab and start the analysis demo to see results here.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    {completedAnalyses > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {completedAnalyses} of {selectedModels.length} analyses completed
                      </div>
                    )}
                  </div>
                  
                  <AnalysisComparison
                    analyses={analyses}
                    paperId={mockPaper.id}
                    isLoading={isAnalyzing}
                    onReanalyze={handleReanalyze}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}