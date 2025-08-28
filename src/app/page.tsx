'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/components/auth/AuthProvider'

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  const handleGetStarted = () => {
    router.push('/login')
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Science Paper Manager
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            AI-powered research paper management system with multi-model analysis and semantic search
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Multi-Model AI Analysis
              </CardTitle>
              <CardDescription>
                Analyze papers with OpenAI, Anthropic, xAI, and Gemini for diverse perspectives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">OpenAI</Badge>
                <Badge variant="secondary">Anthropic</Badge>
                <Badge variant="secondary">xAI</Badge>
                <Badge variant="secondary">Gemini</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 Semantic Search
              </CardTitle>
              <CardDescription>
                Find relevant papers using vector similarity search with pgvector
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Vector Search</Badge>
                <Badge variant="outline">RAG Chat</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📚 Paper Management
              </CardTitle>
              <CardDescription>
                Organize papers with ratings, notes, tags, and reading status tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Google Drive</Badge>
                <Badge variant="outline">Zotero Sync</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Button 
            onClick={handleGetStarted}
            size="lg"
            className="mb-4"
          >
            Get Started
          </Button>
          <p className="text-slate-500 dark:text-slate-400">
            Sign in to access your research paper management system
          </p>
        </div>
      </div>
    </div>
  );
}