import { NextRequest, NextResponse } from 'next/server'
import { AdvancedSearchService, type AdvancedSearchFilters, type SortOption } from '@/services/search/AdvancedSearchService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      query, 
      filters = {}, 
      sortBy = 'relevance', 
      page = 1, 
      limit = 10 
    } = body

    // Validate query
    if (query && typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query must be a string' },
        { status: 400 }
      )
    }

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10))

    // Create search service
    const searchService = new AdvancedSearchService()

    // Build search query
    const searchQuery = {
      textQuery: query?.trim() || undefined,
      filters: filters as AdvancedSearchFilters,
      sortBy: sortBy as SortOption,
      pagination: { page: pageNum, limit: limitNum }
    }

    // Perform search
    const searchResponse = await searchService.searchPapers(searchQuery)

    return NextResponse.json({
      success: true,
      data: searchResponse
    })

  } catch (error) {
    console.error('Advanced search API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to perform search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const searchService = new AdvancedSearchService()

    switch (action) {
      case 'suggestions': {
        const query = searchParams.get('q')
        if (!query || query.length < 2) {
          return NextResponse.json({ success: true, data: [] })
        }
        
        const suggestions = await searchService.getSearchSuggestions(query)
        return NextResponse.json({ success: true, data: suggestions })
      }

      case 'filter-options': {
        const filterOptions = await searchService.getFilterOptions()
        return NextResponse.json({ success: true, data: filterOptions })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Search API GET error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



