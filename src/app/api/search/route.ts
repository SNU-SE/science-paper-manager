import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/database'
import { TABLES } from '@/lib/database'

interface SearchFilters {
  readingStatus?: string[]
  publicationYear?: { min?: number; max?: number }
  tags?: string[]
  rating?: { min?: number; max?: number }
}

interface SearchResult {
  id: string
  paper: {
    id: string
    title: string
    authors: string[]
    abstract?: string
    journal?: string
    publicationYear?: number
  }
  similarity: number
  relevantExcerpts: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, filters, openaiApiKey, limit = 10 } = body

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required and must be a string' },
        { status: 400 }
      )
    }

    if (!openaiApiKey || typeof openaiApiKey !== 'string') {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Implement basic text search in database
    const supabase = getSupabaseClient()
    
    // Prepare search query - basic text search across title, authors, abstract, and journal
    const searchQuery = query.trim().toLowerCase()
    const searchTerms = searchQuery.split(/\s+/).filter(term => term.length > 0)
    
    if (searchTerms.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          query: query.trim(),
          results: [],
          totalResults: 0,
          filters: filters || {}
        }
      })
    }
    
    // Build search conditions for PostgreSQL full text search
    // Note: This is a basic implementation. For production, you'd want to use pg_trgm or vector search
    let searchCondition = supabase
      .from(TABLES.PAPERS)
      .select(`
        id,
        title,
        authors,
        journal,
        publication_year,
        abstract,
        doi,
        reading_status,
        date_added,
        date_read,
        last_modified
      `)
    
    // Apply text search using ilike for basic text matching
    // This searches across title, abstract, journal, and authors
    const orConditions = searchTerms.map(term => {
      const escapedTerm = `%${term}%`
      return `title.ilike.${escapedTerm},abstract.ilike.${escapedTerm},journal.ilike.${escapedTerm},authors.cs.{"${term}"}`
    })
    
    // Use OR condition to match any of the search terms in any field
    searchCondition = searchCondition.or(orConditions.join(','))
    
    // Apply filters
    if (filters) {
      if (filters.publicationYear) {
        if (filters.publicationYear.min) {
          searchCondition = searchCondition.gte('publication_year', filters.publicationYear.min)
        }
        if (filters.publicationYear.max) {
          searchCondition = searchCondition.lte('publication_year', filters.publicationYear.max)
        }
      }
      
      if (filters.readingStatus && filters.readingStatus.length > 0) {
        searchCondition = searchCondition.in('reading_status', filters.readingStatus)
      }
    }
    
    // Execute search with pagination
    const { data: papers, error: searchError } = await searchCondition
      .order('last_modified', { ascending: false })
      .limit(Math.min(limit, 50))
    
    if (searchError) {
      console.error('Database search error:', searchError)
      return NextResponse.json(
        { 
          error: 'Failed to perform search',
          details: searchError.message
        },
        { status: 500 }
      )
    }
    
    // Transform results and calculate basic similarity scores
    const searchResults: SearchResult[] = (papers || []).map(paper => {
      // Calculate basic similarity score based on term matches
      const titleMatches = searchTerms.filter(term => 
        paper.title?.toLowerCase().includes(term)).length
      const abstractMatches = searchTerms.filter(term => 
        paper.abstract?.toLowerCase().includes(term)).length
      const journalMatches = searchTerms.filter(term => 
        paper.journal?.toLowerCase().includes(term)).length
      const authorMatches = searchTerms.filter(term => 
        paper.authors?.some(author => author.toLowerCase().includes(term))).length
      
      const totalMatches = titleMatches * 3 + abstractMatches * 2 + journalMatches + authorMatches
      const maxPossibleMatches = searchTerms.length * 7 // max weight sum
      const similarity = Math.min(totalMatches / maxPossibleMatches, 1.0)
      
      // Extract relevant excerpts
      const relevantExcerpts: string[] = []
      
      // Add title excerpts
      if (titleMatches > 0) {
        relevantExcerpts.push(...extractExcerpts(paper.title || '', searchTerms))
      }
      
      // Add abstract excerpts
      if (abstractMatches > 0 && paper.abstract) {
        relevantExcerpts.push(...extractExcerpts(paper.abstract, searchTerms, 100))
      }
      
      // Add journal excerpts
      if (journalMatches > 0 && paper.journal) {
        relevantExcerpts.push(paper.journal)
      }
      
      return {
        id: paper.id,
        paper: {
          id: paper.id,
          title: paper.title,
          authors: paper.authors || [],
          abstract: paper.abstract || undefined,
          journal: paper.journal || undefined,
          publicationYear: paper.publication_year || undefined
        },
        similarity: similarity + 0.1, // Add small base score
        relevantExcerpts
      }
    })
    
    // Sort by similarity score (highest first)
    const sortedResults = searchResults.sort((a, b) => b.similarity - a.similarity)
    const limitedResults = sortedResults.slice(0, Math.min(limit, 50))

    return NextResponse.json({
      success: true,
      data: {
        query: query.trim(),
        results: limitedResults,
        totalResults: limitedResults.length,
        filters: filters || {}
      }
    })

  } catch (error) {
    console.error('Semantic search API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to perform semantic search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function applyFilters(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
  if (!filters) return results

  return results.filter(result => {
    // Apply publication year filter
    if (filters.publicationYear) {
      const year = result.paper.publicationYear
      if (year) {
        if (filters.publicationYear.min && year < filters.publicationYear.min) return false
        if (filters.publicationYear.max && year > filters.publicationYear.max) return false
      }
    }

    // Apply rating filter (would need to join with user_evaluations table)
    // TODO: Implement rating filter when user evaluation data is available
    
    // Apply tags filter (would need to join with user_evaluations table)
    // TODO: Implement tags filter when user evaluation data is available
    
    return true
  })
}

/**
 * Extract relevant text excerpts containing search terms
 */
function extractExcerpts(text: string, searchTerms: string[], maxLength: number = 150): string[] {
  const excerpts: string[] = []
  const lowerText = text.toLowerCase()
  
  for (const term of searchTerms) {
    const index = lowerText.indexOf(term.toLowerCase())
    if (index !== -1) {
      // Extract context around the found term
      const start = Math.max(0, index - Math.floor(maxLength / 2))
      const end = Math.min(text.length, start + maxLength)
      
      let excerpt = text.substring(start, end)
      
      // Add ellipsis if truncated
      if (start > 0) excerpt = '...' + excerpt
      if (end < text.length) excerpt = excerpt + '...'
      
      // Avoid duplicate excerpts
      if (!excerpts.includes(excerpt)) {
        excerpts.push(excerpt)
      }
      
      // Limit number of excerpts per text
      if (excerpts.length >= 2) break
    }
  }
  
  return excerpts
}

