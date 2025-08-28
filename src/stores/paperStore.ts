import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Paper, UserEvaluation, MultiModelAnalysis } from '../types'

interface PaperStore {
  // State
  papers: Map<string, Paper>
  evaluations: Map<string, UserEvaluation>
  aiAnalyses: Map<string, MultiModelAnalysis>
  selectedPaper: Paper | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchPapers: () => Promise<void>
  addPaper: (paper: Paper) => Promise<void>
  updatePaper: (id: string, updates: Partial<Paper>) => Promise<void>
  deletePaper: (id: string) => Promise<void>
  selectPaper: (paper: Paper | null) => void
  
  // Evaluation actions
  updateEvaluation: (paperId: string, evaluation: Partial<UserEvaluation>) => Promise<void>
  getEvaluation: (paperId: string) => UserEvaluation | undefined
  
  // AI Analysis actions
  updateAnalysis: (paperId: string, analysis: MultiModelAnalysis) => Promise<void>
  getAnalysis: (paperId: string) => MultiModelAnalysis | undefined
  
  // Utility actions
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const usePaperStore = create<PaperStore>()(
  persist(
    (set, get) => ({
      // Initial state
      papers: new Map(),
      evaluations: new Map(),
      aiAnalyses: new Map(),
      selectedPaper: null,
      isLoading: false,
      error: null,

      // Paper actions
      fetchPapers: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/papers')
          if (!response.ok) {
            throw new Error('Failed to fetch papers')
          }
          const papers: Paper[] = await response.json()
          const papersMap = new Map(papers.map(paper => [paper.id, paper]))
          set({ papers: papersMap, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      addPaper: async (paper: Paper) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/papers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paper)
          })
          
          if (!response.ok) {
            throw new Error('Failed to add paper')
          }
          
          const savedPaper: Paper = await response.json()
          const { papers } = get()
          const newPapers = new Map(papers)
          newPapers.set(savedPaper.id, savedPaper)
          
          set({ papers: newPapers, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      updatePaper: async (id: string, updates: Partial<Paper>) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`/api/papers/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          })
          
          if (!response.ok) {
            throw new Error('Failed to update paper')
          }
          
          const updatedPaper: Paper = await response.json()
          const { papers, selectedPaper } = get()
          const newPapers = new Map(papers)
          newPapers.set(id, updatedPaper)
          
          set({ 
            papers: newPapers,
            selectedPaper: selectedPaper?.id === id ? updatedPaper : selectedPaper,
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      deletePaper: async (id: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`/api/papers/${id}`, {
            method: 'DELETE'
          })
          
          if (!response.ok) {
            throw new Error('Failed to delete paper')
          }
          
          const { papers, evaluations, aiAnalyses, selectedPaper } = get()
          const newPapers = new Map(papers)
          const newEvaluations = new Map(evaluations)
          const newAnalyses = new Map(aiAnalyses)
          
          newPapers.delete(id)
          newEvaluations.delete(id)
          newAnalyses.delete(id)
          
          set({ 
            papers: newPapers,
            evaluations: newEvaluations,
            aiAnalyses: newAnalyses,
            selectedPaper: selectedPaper?.id === id ? null : selectedPaper,
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      selectPaper: (paper: Paper | null) => {
        set({ selectedPaper: paper })
      },

      // Evaluation actions
      updateEvaluation: async (paperId: string, evaluation: Partial<UserEvaluation>) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`/api/evaluations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paperId, ...evaluation })
          })
          
          if (!response.ok) {
            throw new Error('Failed to update evaluation')
          }
          
          const savedEvaluation: UserEvaluation = await response.json()
          const { evaluations } = get()
          const newEvaluations = new Map(evaluations)
          newEvaluations.set(paperId, savedEvaluation)
          
          set({ evaluations: newEvaluations, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      getEvaluation: (paperId: string) => {
        return get().evaluations.get(paperId)
      },

      // AI Analysis actions
      updateAnalysis: async (paperId: string, analysis: MultiModelAnalysis) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(`/api/ai-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paperId, analysis })
          })
          
          if (!response.ok) {
            throw new Error('Failed to update analysis')
          }
          
          const { aiAnalyses } = get()
          const newAnalyses = new Map(aiAnalyses)
          newAnalyses.set(paperId, analysis)
          
          set({ aiAnalyses: newAnalyses, isLoading: false })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          })
        }
      },

      getAnalysis: (paperId: string) => {
        return get().aiAnalyses.get(paperId)
      },

      // Utility actions
      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      }
    }),
    {
      name: 'paper-storage',
      partialize: (state) => ({
        papers: Array.from(state.papers.entries()),
        evaluations: Array.from(state.evaluations.entries()),
        aiAnalyses: Array.from(state.aiAnalyses.entries()),
        selectedPaper: state.selectedPaper
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Maps after rehydration
          state.papers = new Map(state.papers as any)
          state.evaluations = new Map(state.evaluations as any)
          state.aiAnalyses = new Map(state.aiAnalyses as any)
        }
      }
    }
  )
)