import { getSupabaseClient } from '@/lib/database'
import { TABLES } from '@/lib/database'
import type { Paper, SearchFilters } from '@/types'

export interface AdvancedSearchFilters extends SearchFilters {
  journals?: string[]
  authors?: string[]
  dateRange?: { start: Date; end: Date }
}

export interface SearchQuery {
  textQuery?: string
  filters: AdvancedSearchFilters
  sortBy: SortOption
  pagination: { page: number; limit: number }
}

export interface SearchResult {
  id: string
  paper: Paper
  similarity: number
  relevantExcerpts: string[]
  matchedFields: string[]
}

export interface SearchResponse {
  results: SearchResult[]
  totalResults: number
  totalPages: number
  currentPage: number
  query: SearchQuery
  suggestions?: string[]
}

export type SortOption = 
  | 'relevance'
  | 'date_added_desc'
  | 'date_added_asc'
  | 'publication_year_desc'
  | 'publication_year_asc'
  | 'rating_desc'
  | 'rating_asc'
  | 'title_asc'
  | 'title_desc'

/**
 * Advanced Search Service with comprehensive filtering and sorting capabilities
 */
export class AdvancedSearchService {
  private supabase = getSupabaseClient()

  /**
   * Perform advanced search with filters and sorting
   */
  async searchPapers(query: SearchQuery): Promise<SearchResponse> {
    try {
      const { textQuery, filters, sortBy, pagination } = query
      
      // Build base query with joins for user evaluations
      let searchQuery = this.supabase
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
          last_modified,
          user_evaluations (
            rating,
            tags,
            notes
          )
        `)

      // Apply text search if provided
      if (textQuery && textQuery.trim()) {
        searchQuery = this.applyTextSearch(searchQuery, textQuery.trim())
      }

      // Apply filters
      searchQuery = this.applyFilters(searchQuery, filters)

      // Get total count for pagination
      const countQuery = this.buildCountQuery(textQuery, filters)
      const { count: totalResults } = await countQuery

      // Apply sorting
      searchQuery = this.applySorting(searchQuery, sortBy)

      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit
      searchQuery = searchQuery
        .range(offset, offset + pagination.limit - 1)

      // Execute search
      const { data: papers, error } = await searchQuery

      if (error) {
        throw new Error(`Search query failed: ${error.message}`)
      }

      // Transform results
      const searchResults = this.transformResults(papers || [], textQuery)

      // Calculate pagination info
      const totalPages = Math.ceil((totalResults || 0) / pagination.limit)

      return {
        results: searchResults,
        totalResults: totalResults || 0,
        totalPages,
        currentPage: pagination.page,
        query,
        suggestions: await this.getSearchSuggestions(textQuery)
      }

    } catch (error) {
      console.error('Advanced search failed:', error)
      throw error
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery?: string): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return []
    }

    try {
      // Get suggestions from titles, journals, and authors
      const { data: titleSuggestions } = await this.supabase
        .from(TABLES.PAPERS)
        .select('title')
        .ilike('title', `%${partialQuery}%`)
        .limit(5)

      const { data: journalSuggestions } = await this.supabase
        .from(TABLES.PAPERS)
        .select('journal')
        .ilike('journal', `%${partialQuery}%`)
        .not('journal', 'is', null)
        .limit(3)

      const suggestions: string[] = []

      // Add title suggestions
      titleSuggestions?.forEach(item => {
        if (item.title) {
          suggestions.push(item.title)
        }
      })

      // Add journal suggestions
      journalSuggestions?.forEach(item => {
        if (item.journal && !suggestions.includes(item.journal)) {
          suggestions.push(item.journal)
        }
      })

      return suggestions.slice(0, 8)

    } catch (error) {
      console.error('Failed to get search suggestions:', error)
      return []
    }
  }

  /**
   * Get available filter options for UI
   */
  async getFilterOptions(): Promise<{
    journals: string[]
    authors: string[]
    tags: string[]
    yearRange: { min: number; max: number }
  }> {
    try {
      // Get unique journals
      const { data: journalData } = await this.supabase
        .from(TABLES.PAPERS)
        .select('journal')
        .not('journal', 'is', null)
        .order('journal')

      // Get unique authors (flatten arrays)
      const { data: authorData } = await this.supabase
        .from(TABLES.PAPERS)
        .select('authors')
        .not('authors', 'is', null)

      // Get unique tags from user evaluations
      const { data: tagData } = await this.supabase
        .from('user_evaluations')
        .select('tags')
        .not('tags', 'is', null)

      // Get year range
      const { data: yearData } = await this.supabase
        .from(TABLES.PAPERS)
        .select('publication_year')
        .not('publication_year', 'is', null)
        .order('publication_year')

      // Process results
      const journals = [...new Set(
        journalData?.map(item => item.journal).filter(Boolean) || []
      )].sort()

      const authors = [...new Set(
        authorData?.flatMap(item => item.authors || []) || []
      )].sort()

      const tags = [...new Set(
        tagData?.flatMap(item => item.tags || []) || []
      )].sort()

      const years = yearData?.map(item => item.publication_year).filter(Boolean) || []
      const yearRange = {
        min: Math.min(...years) || 1900,
        max: Math.max(...years) || new Date().getFullYear()
      }

      return { journals, authors, tags, yearRange }

    } catch (error) {
      console.error('Failed to get filter options:', error)
      return {
        journals: [],
        authors: [],
        tags: [],
        yearRange: { min: 1900, max: new Date().getFullYear() }
      }
    }
  }

  /**
   * Apply text search to query
   */
  private applyTextSearch(query: any, textQuery: string) {
    const searchTerms = textQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    
    if (searchTerms.length === 0) {
      return query
    }

    // Build OR conditions for text search across multiple fields
    const orConditions = searchTerms.flatMap(term => {
      const escapedTerm = `%${term}%`
      return [
        `title.ilike.${escapedTerm}`,
        `abstract.ilike.${escapedTerm}`,
        `journal.ilike.${escapedTerm}`,
        `authors.cs.{"${term}"}`
      ]
    })

    return query.or(orConditions.join(','))
  }

  /**
   * Apply filters to search query
   */
  private applyFilters(query: any, filters: AdvancedSearchFilters) {
    // Publication year filter
    if (filters.publicationYear) {
      if (filters.publicationYear.min) {
        query = query.gte('publication_year', filters.publicationYear.min)
      }
      if (filters.publicationYear.max) {
        query = query.lte('publication_year', filters.publicationYear.max)
      }
    }

    // Reading status filter
    if (filters.readingStatus?.length) {
      query = query.in('reading_status', filters.readingStatus)
    }

    // Journal filter
    if (filters.journals?.length) {
      query = query.in('journal', filters.journals)
    }

    // Authors filter
    if (filters.authors?.length) {
      const authorConditions = filters.authors.map(author => 
        `authors.cs.{"${author}"}`)
      query = query.or(authorConditions.join(','))
    }

    // Date range filter (date_added)
    if (filters.dateRange) {
      if (filters.dateRange.start) {
        query = query.gte('date_added', filters.dateRange.start.toISOString())
      }
      if (filters.dateRange.end) {
        query = query.lte('date_added', filters.dateRange.end.toISOString())
      }
    }

    return query
  }

  /**
   * Apply sorting to search query
   */
  private applySorting(query: any, sortBy: SortOption) {
    switch (sortBy) {
      case 'date_added_desc':
        return query.order('date_added', { ascending: false })
      case 'date_added_asc':
        return query.order('date_added', { ascending: true })
      case 'publication_year_desc':
        return query.order('publication_year', { ascending: false, nullsLast: true })
      case 'publication_year_asc':
        return query.order('publication_year', { ascending: true, nullsLast: true })
      case 'title_asc':
        return query.order('title', { ascending: true })
      case 'title_desc':
        return query.order('title', { ascending: false })
      case 'rating_desc':
        // Note: This would require a more complex query with user_evaluations join
        return query.order('last_modified', { ascending: false })
      case 'rating_asc':
        return query.order('last_modified', { ascending: true })
      case 'relevance':
      default:
        return query.order('last_modified', { ascending: false })
    }
  }

  /**
   * Build count query for pagination
   */
  private buildCountQuery(textQuery?: string, filters?: AdvancedSearchFilters) {
    let countQuery = this.supabase
      .from(TABLES.PAPERS)
      .select('*', { count: 'exact', head: true })

    if (textQuery && textQuery.trim()) {
      countQuery = this.applyTextSearch(countQuery, textQuery.trim())
    }

    if (filters) {
      countQuery = this.applyFilters(countQuery, filters)
    }

    return countQuery
  }

  /**
   * Transform database results to SearchResult format
   */
  private transformResults(papers: any[], textQuery?: string): SearchResult[] {
    const searchTerms = textQuery ? 
      textQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0) : []

    return papers.map(paper => {
      // Calculate similarity score
      const similarity = this.calculateSimilarity(paper, searchTerms)
      
      // Extract relevant excerpts
      const relevantExcerpts = this.extractRelevantExcerpts(paper, searchTerms)
      
      // Identify matched fields
      const matchedFields = this.identifyMatchedFields(paper, searchTerms)

      // Transform paper data
      const transformedPaper: Paper = {
        id: paper.id,
        title: paper.title,
        authors: paper.authors || [],
        journal: paper.journal,
        publicationYear: paper.publication_year,
        doi: paper.doi,
        abstract: paper.abstract,
        readingStatus: paper.reading_status,
        dateAdded: new Date(paper.date_added),
        dateRead: paper.date_read ? new Date(paper.date_read) : undefined,
        lastModified: new Date(paper.last_modified)
      }

      return {
        id: paper.id,
        paper: transformedPaper,
        similarity,
        relevantExcerpts,
        matchedFields
      }
    })
  }

  /**
   * Calculate similarity score based on term matches
   */
  private calculateSimilarity(paper: any, searchTerms: string[]): number {
    if (searchTerms.length === 0) return 0.5

    let score = 0
    const weights = {
      title: 3,
      abstract: 2,
      journal: 1,
      authors: 1
    }

    // Title matches
    const titleMatches = searchTerms.filter(term => 
      paper.title?.toLowerCase().includes(term)).length
    score += (titleMatches / searchTerms.length) * weights.title

    // Abstract matches
    const abstractMatches = searchTerms.filter(term => 
      paper.abstract?.toLowerCase().includes(term)).length
    score += (abstractMatches / searchTerms.length) * weights.abstract

    // Journal matches
    const journalMatches = searchTerms.filter(term => 
      paper.journal?.toLowerCase().includes(term)).length
    score += (journalMatches / searchTerms.length) * weights.journal

    // Author matches
    const authorMatches = searchTerms.filter(term => 
      paper.authors?.some((author: string) => 
        author.toLowerCase().includes(term))).length
    score += (authorMatches / searchTerms.length) * weights.authors

    const maxScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    return Math.min(score / maxScore, 1.0)
  }

  /**
   * Extract relevant text excerpts containing search terms
   */
  private extractRelevantExcerpts(paper: any, searchTerms: string[]): string[] {
    const excerpts: string[] = []
    
    if (searchTerms.length === 0) return excerpts

    // Extract from title
    if (paper.title) {
      const titleExcerpts = this.extractExcerpts(paper.title, searchTerms, 100)
      excerpts.push(...titleExcerpts)
    }

    // Extract from abstract
    if (paper.abstract) {
      const abstractExcerpts = this.extractExcerpts(paper.abstract, searchTerms, 150)
      excerpts.push(...abstractExcerpts)
    }

    // Extract from journal
    if (paper.journal && searchTerms.some(term => 
        paper.journal.toLowerCase().includes(term))) {
      excerpts.push(paper.journal)
    }

    return excerpts.slice(0, 3) // Limit to 3 excerpts
  }

  /**
   * Extract text excerpts around search terms
   */
  private extractExcerpts(text: string, searchTerms: string[], maxLength: number = 150): string[] {
    const excerpts: string[] = []
    const lowerText = text.toLowerCase()
    
    for (const term of searchTerms) {
      const index = lowerText.indexOf(term.toLowerCase())
      if (index !== -1) {
        const start = Math.max(0, index - Math.floor(maxLength / 2))
        const end = Math.min(text.length, start + maxLength)
        
        let excerpt = text.substring(start, end)
        
        if (start > 0) excerpt = '...' + excerpt
        if (end < text.length) excerpt = excerpt + '...'
        
        if (!excerpts.includes(excerpt)) {
          excerpts.push(excerpt)
        }
        
        if (excerpts.length >= 2) break
      }
    }
    
    return excerpts
  }

  /**
   * Identify which fields matched the search terms
   */
  private identifyMatchedFields(paper: any, searchTerms: string[]): string[] {
    const matchedFields: string[] = []
    
    if (searchTerms.length === 0) return matchedFields

    if (paper.title && searchTerms.some(term => 
        paper.title.toLowerCase().includes(term))) {
      matchedFields.push('title')
    }

    if (paper.abstract && searchTerms.some(term => 
        paper.abstract.toLowerCase().includes(term))) {
      matchedFields.push('abstract')
    }

    if (paper.journal && searchTerms.some(term => 
        paper.journal.toLowerCase().includes(term))) {
      matchedFields.push('journal')
    }

    if (paper.authors && searchTerms.some(term => 
        paper.authors.some((author: string) => 
          author.toLowerCase().includes(term)))) {
      matchedFields.push('authors')
    }

    return matchedFields
  }
}