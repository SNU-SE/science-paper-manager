'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaperListEnhanced } from '@/components/papers/PaperListEnhanced'
import { AIModelSelectorEnhanced } from '@/components/ai/AIModelSelectorEnhanced'
import { SemanticSearchEnhanced } from '@/components/search/SemanticSearchEnhanced'
import { RAGChatEnhanced } from '@/components/search/RAGChatEnhanced'

export default function DemoPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">
          Science Paper Manager - Enhanced Components Demo
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          This page demonstrates the enhanced components that use Zustand stores for state management.
          All components are now connected to centralized state and provide a seamless user experience.
        </p>
      </div>

      <Tabs defaultValue="papers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="papers">Papers</TabsTrigger>
          <TabsTrigger value="ai-models">AI Models</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="chat">RAG Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="papers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Paper List</CardTitle>
              <p className="text-sm text-gray-600">
                Paper management with integrated state management. Changes to papers, evaluations, 
                and analyses are automatically synchronized across all components.
              </p>
            </CardHeader>
            <CardContent>
              <PaperListEnhanced />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced AI Model Selector</CardTitle>
              <p className="text-sm text-gray-600">
                Configure AI models with persistent API key storage, usage tracking, 
                and real-time validation. All settings are automatically saved and synchronized.
              </p>
            </CardHeader>
            <CardContent>
              <AIModelSelectorEnhanced />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Semantic Search</CardTitle>
              <p className="text-sm text-gray-600">
                Perform semantic searches across your paper collection with advanced filtering 
                and result ranking. Search state is managed centrally for consistency.
              </p>
            </CardHeader>
            <CardContent>
              <SemanticSearchEnhanced />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced RAG Chat</CardTitle>
              <p className="text-sm text-gray-600">
                Interactive chat interface for asking questions about your research papers. 
                Chat history is persisted and sources are automatically cited.
              </p>
            </CardHeader>
            <CardContent>
              <RAGChatEnhanced />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>State Management Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Centralized State</h3>
              <p className="text-sm text-gray-600">
                All application state is managed in Zustand stores, providing a single source of truth.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Persistent Storage</h3>
              <p className="text-sm text-gray-600">
                Important data like API keys, user preferences, and chat history are automatically persisted.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Real-time Updates</h3>
              <p className="text-sm text-gray-600">
                Changes in one component are immediately reflected across all other components.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Error Handling</h3>
              <p className="text-sm text-gray-600">
                Centralized error handling with user-friendly error messages and recovery options.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Loading States</h3>
              <p className="text-sm text-gray-600">
                Consistent loading indicators and disabled states during async operations.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Type Safety</h3>
              <p className="text-sm text-gray-600">
                Full TypeScript support with strongly typed stores and actions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}