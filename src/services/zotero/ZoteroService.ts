import { Paper } from '@/types'

export interface ZoteroItem {
  key: string
  version: number
  itemType: string
  title?: string
  creators?: Array<{
    creatorType: string
    firstName?: string
    lastName?: string
    name?: string
  }>
  abstractNote?: string
  publicationTitle?: string
  date?: string
  DOI?: string
  url?: string
  dateAdded: string
  dateModified: string
  tags?: Array<{
    tag: string
    type?: number
  }>
}

export interface ZoteroSyncResult {
  totalItems: number
  newItems: number
  updatedItems: number
  errors: string[]
  lastSyncTime: Date
}

export interface ZoteroConfig {
  userId: string
  apiKey: string
  libraryType: 'user' | 'group'
  libraryId?: string
}

export class ZoteroService {
  private baseUrl = 'https://api.zotero.org'
  private config: ZoteroConfig | null = null

  constructor() {
    this.loadConfig()
  }

  /**
   * Configure Zotero API credentials
   */
  configure(config: ZoteroConfig): void {
    this.config = config
    this.saveConfig()
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Zotero not configured')
    }

    try {
      const response = await this.makeRequest('/keys/current')
      return response.ok
    } catch (error) {
      console.error('Zotero credential validation failed:', error)
      return false
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<any> {
    if (!this.config) {
      throw new Error('Zotero not configured')
    }

    const response = await this.makeRequest('/keys/current')
    if (!response.ok) {
      throw new Error('Failed to get user info')
    }

    return response.json()
  }

  /**
   * Fetch all items from Zotero library
   */
  async fetchAllItems(since?: number): Promise<ZoteroItem[]> {
    if (!this.config) {
      throw new Error('Zotero not configured')
    }

    const items: ZoteroItem[] = []
    let start = 0
    const limit = 100

    while (true) {
      const params = new URLSearchParams({
        start: start.toString(),
        limit: limit.toString(),
        format: 'json',
        include: 'data'
      })

      if (since) {
        params.append('since', since.toString())
      }

      const endpoint = `/${this.config.libraryType}s/${this.config.userId}/items`
      const response = await this.makeRequest(`${endpoint}?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.statusText}`)
      }

      const batch = await response.json()
      
      if (batch.length === 0) {
        break
      }

      items.push(...batch.map((item: any) => item.data))
      start += limit

      // Check if we got fewer items than requested (last page)
      if (batch.length < limit) {
        break
      }
    }

    return items
  }

  /**
   * Get library version for incremental sync
   */
  async getLibraryVersion(): Promise<number> {
    if (!this.config) {
      throw new Error('Zotero not configured')
    }

    const endpoint = `/${this.config.libraryType}s/${this.config.userId}/items`
    const response = await this.makeRequest(`${endpoint}?limit=1&format=versions`)

    if (!response.ok) {
      throw new Error('Failed to get library version')
    }

    const lastModifiedVersion = response.headers.get('Last-Modified-Version')
    return lastModifiedVersion ? parseInt(lastModifiedVersion) : 0
  }

  /**
   * Convert Zotero item to Paper format
   */
  convertToPaper(item: ZoteroItem): Partial<Paper> {
    const authors = item.creators
      ?.filter(creator => creator.creatorType === 'author')
      .map(creator => {
        if (creator.name) {
          return creator.name
        }
        return `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
      })
      .filter(name => name.length > 0) || []

    // Extract year from date
    let publicationYear: number | undefined
    if (item.date) {
      const yearMatch = item.date.match(/\d{4}/)
      if (yearMatch) {
        publicationYear = parseInt(yearMatch[0])
      }
    }

    return {
      title: item.title || 'Untitled',
      authors,
      journal: item.publicationTitle,
      publicationYear,
      doi: item.DOI,
      abstract: item.abstractNote,
      zoteroKey: item.key,
      dateAdded: new Date(item.dateAdded),
      lastModified: new Date(item.dateModified)
    }
  }

  /**
   * Make authenticated request to Zotero API
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.config) {
      throw new Error('Zotero not configured')
    }

    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'Science Paper Manager/1.0',
      'Content-Type': 'application/json',
      ...options.headers
    }

    return fetch(url, {
      ...options,
      headers
    })
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zotero-config')
      if (stored) {
        try {
          this.config = JSON.parse(stored)
        } catch (error) {
          console.error('Failed to parse Zotero config:', error)
        }
      }
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    if (typeof window !== 'undefined' && this.config) {
      localStorage.setItem('zotero-config', JSON.stringify(this.config))
    }
  }

  /**
   * Check if Zotero is configured
   */
  isConfigured(): boolean {
    return this.config !== null && 
           this.config.userId.length > 0 && 
           this.config.apiKey.length > 0
  }

  /**
   * Get current configuration
   */
  getConfig(): ZoteroConfig | null {
    return this.config
  }
}

let zoteroServiceInstance: ZoteroService | null = null

export function getZoteroService(): ZoteroService {
  if (!zoteroServiceInstance) {
    zoteroServiceInstance = new ZoteroService()
  }
  return zoteroServiceInstance
}

export const zoteroService = getZoteroService