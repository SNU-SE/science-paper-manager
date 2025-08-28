import { createClient } from '@supabase/supabase-js'
import { UserEvaluation } from '@/types'

export class UserEvaluationService {
  private supabase

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async getEvaluation(paperId: string): Promise<UserEvaluation | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_evaluations')
        .select('*')
        .eq('paper_id', paperId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        throw error
      }

      return this.mapDatabaseToType(data)
    } catch (error) {
      console.error('Error fetching user evaluation:', error)
      throw new Error('Failed to fetch user evaluation')
    }
  }

  async saveEvaluation(evaluation: Partial<UserEvaluation>): Promise<UserEvaluation> {
    try {
      const evaluationData = this.mapTypeToDatabase(evaluation)

      const { data, error } = await this.supabase
        .from('user_evaluations')
        .upsert(evaluationData, {
          onConflict: 'paper_id'
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return this.mapDatabaseToType(data)
    } catch (error) {
      console.error('Error saving user evaluation:', error)
      throw new Error('Failed to save user evaluation')
    }
  }

  async deleteEvaluation(paperId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_evaluations')
        .delete()
        .eq('paper_id', paperId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting user evaluation:', error)
      throw new Error('Failed to delete user evaluation')
    }
  }

  async getEvaluationsByPaperIds(paperIds: string[]): Promise<Map<string, UserEvaluation>> {
    try {
      const { data, error } = await this.supabase
        .from('user_evaluations')
        .select('*')
        .in('paper_id', paperIds)

      if (error) {
        throw error
      }

      const evaluationsMap = new Map<string, UserEvaluation>()
      data?.forEach(item => {
        const evaluation = this.mapDatabaseToType(item)
        evaluationsMap.set(evaluation.paperId, evaluation)
      })

      return evaluationsMap
    } catch (error) {
      console.error('Error fetching user evaluations:', error)
      throw new Error('Failed to fetch user evaluations')
    }
  }

  async getAllTags(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_evaluations')
        .select('tags')
        .not('tags', 'is', null)

      if (error) {
        throw error
      }

      // Flatten and deduplicate tags
      const allTags = new Set<string>()
      data?.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => {
            if (tag.trim()) {
              allTags.add(tag.trim())
            }
          })
        }
      })

      return Array.from(allTags).sort()
    } catch (error) {
      console.error('Error fetching tags:', error)
      throw new Error('Failed to fetch tags')
    }
  }

  async getEvaluationStats(): Promise<{
    totalEvaluations: number
    averageRating: number
    ratingDistribution: Record<number, number>
    topTags: Array<{ tag: string; count: number }>
  }> {
    try {
      const { data, error } = await this.supabase
        .from('user_evaluations')
        .select('rating, tags')

      if (error) {
        throw error
      }

      const stats = {
        totalEvaluations: data?.length || 0,
        averageRating: 0,
        ratingDistribution: {} as Record<number, number>,
        topTags: [] as Array<{ tag: string; count: number }>
      }

      if (!data || data.length === 0) {
        return stats
      }

      // Calculate rating statistics
      const ratings = data
        .map(item => item.rating)
        .filter(rating => rating !== null && rating !== undefined)

      if (ratings.length > 0) {
        stats.averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

        // Rating distribution
        ratings.forEach(rating => {
          stats.ratingDistribution[rating] = (stats.ratingDistribution[rating] || 0) + 1
        })
      }

      // Tag frequency
      const tagCounts = new Map<string, number>()
      data.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => {
            if (tag.trim()) {
              const trimmedTag = tag.trim()
              tagCounts.set(trimmedTag, (tagCounts.get(trimmedTag) || 0) + 1)
            }
          })
        }
      })

      stats.topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Top 20 tags

      return stats
    } catch (error) {
      console.error('Error fetching evaluation stats:', error)
      throw new Error('Failed to fetch evaluation statistics')
    }
  }

  private mapDatabaseToType(data: any): UserEvaluation {
    return {
      id: data.id,
      paperId: data.paper_id,
      rating: data.rating,
      notes: data.notes,
      tags: data.tags || [],
      highlights: data.highlights,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private mapTypeToDatabase(evaluation: Partial<UserEvaluation>): any {
    return {
      id: evaluation.id,
      paper_id: evaluation.paperId,
      rating: evaluation.rating,
      notes: evaluation.notes,
      tags: evaluation.tags || [],
      highlights: evaluation.highlights,
      created_at: evaluation.createdAt?.toISOString(),
      updated_at: evaluation.updatedAt?.toISOString() || new Date().toISOString()
    }
  }
}