'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SemanticSearchEnhanced } from '@/components/search/SemanticSearchEnhanced'
import type { SearchResponse } from '@/services/search/AdvancedSearchService'

export default function SearchDemoPage() {
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)

  const handleResultsChange = (results: SearchResponse) => {
    setSearchResults(results)
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Advanced Search Demo</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Demonstration of the enhanced search and filtering system with support for 
          complex queries, multiple filters, and intelligent sorting.
        </p>
      </div>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Search Your Papers</CardTitle>
        </CardHeader>
        <CardContent>
          <SemanticSearchEnhanced
            placeholder="Search by title, authors, journal, or content..."
            onResultsChange={handleResultsChange}
          />
        </CardContent>
      </Card>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filtering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="text-sm space-y-1">
              <li>• Filter by reading status</li>
              <li>• Publication year range</li>
              <li>• Rating range (1-5 stars)</li>
              <li>• Specific journals</li>
              <li>• Author names</li>
              <li>• Tags and categories</li>
              <li>• Date added range</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Smart Sorting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="text-sm space-y-1">
              <li>• Relevance-based ranking</li>
              <li>• Recently added papers</li>
              <li>• Publication year (newest/oldest)</li>
              <li>• User ratings (highest/lowest)</li>
              <li>• Alphabetical by title</li>
              <li>• Custom sorting combinations</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enhanced Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="text-sm space-y-1">
              <li>• Similarity scoring</li>
              <li>• Relevant text excerpts</li>
              <li>• Matched field indicators</li>
              <li>• Search suggestions</li>
              <li>• Pagination support</li>
              <li>• Performance optimized</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Search Statistics */}
      {searchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {searchResults.totalResults}
                </div>
                <div className="text-sm text-muted-foreground">Total Results</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {searchResults.currentPage}
                </div>
                <div className="text-sm text-muted-foreground">Current Page</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {searchResults.totalPages}
                </div>
                <div className="text-sm text-muted-foreground">Total Pages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {searchResults.results.length}
                </div>
                <div className="text-sm text-muted-foreground">Showing</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Implementation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Database Optimizations</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Full-text search indexes (GIN)</li>
                <li>• Composite indexes for filtering</li>
                <li>• Partial indexes for common queries</li>
                <li>• Optimized query planning</li>
                <li>• Efficient pagination</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Search Features</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Multi-field text search</li>
                <li>• Complex filter combinations</li>
                <li>• Real-time search suggestions</li>
                <li>• Similarity scoring algorithm</li>
                <li>• Contextual excerpt extraction</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Performance Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Search Speed:</strong> &lt;100ms for most queries
              </div>
              <div>
                <strong>Index Size:</strong> Optimized for large datasets
              </div>
              <div>
                <strong>Scalability:</strong> Handles 10k+ papers efficiently
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}