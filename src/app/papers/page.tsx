'use client'

import { useState } from 'react'
import { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'
import { PaperList, PaperDetail } from '@/components/papers'
import { PaperUpload } from '@/components/papers/PaperUpload'
import { PaperUploadService } from '@/services/upload/PaperUploadService'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'

// Mock data for demonstration
const mockPapers: Paper[] = [
  {
    id: '1',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
    journal: 'Advances in Neural Information Processing Systems',
    publicationYear: 2017,
    doi: '10.48550/arXiv.1706.03762',
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    readingStatus: 'completed',
    dateAdded: new Date('2023-01-15'),
    lastModified: new Date('2023-01-15'),
    googleDriveUrl: 'https://drive.google.com/file/d/example1'
  },
  {
    id: '2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
    journal: 'NAACL-HLT',
    publicationYear: 2019,
    doi: '10.18653/v1/N19-1423',
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
    readingStatus: 'reading',
    dateAdded: new Date('2023-02-01'),
    lastModified: new Date('2023-02-01')
  },
  {
    id: '3',
    title: 'GPT-4 Technical Report',
    authors: ['OpenAI'],
    journal: 'arXiv preprint',
    publicationYear: 2023,
    doi: '10.48550/arXiv.2303.08774',
    abstract: 'We report the development of GPT-4, a large-scale, multimodal model which can accept image and text inputs and produce text outputs. While less capable than humans in many real-world scenarios, GPT-4 exhibits human-level performance on various professional and academic benchmarks.',
    readingStatus: 'unread',
    dateAdded: new Date('2023-03-15'),
    lastModified: new Date('2023-03-15')
  }
]

const mockEvaluations = new Map<string, UserEvaluation>([
  ['1', {
    id: 'eval1',
    paperId: '1',
    rating: 5,
    notes: 'Groundbreaking paper that introduced the Transformer architecture. Essential reading for anyone working with modern NLP models.',
    tags: ['transformer', 'attention', 'nlp', 'foundational'],
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2023-01-15')
  }],
  ['2', {
    id: 'eval2',
    paperId: '2',
    rating: 4,
    notes: 'Important contribution to pre-trained language models. BERT was revolutionary for its time.',
    tags: ['bert', 'pre-training', 'bidirectional', 'nlp'],
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2023-02-01')
  }]
])

const mockAnalyses = new Map<string, MultiModelAnalysis>([
  ['1', {
    openai: {
      id: 'analysis1',
      paperId: '1',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      summary: 'This paper introduces the Transformer architecture, which relies entirely on self-attention mechanisms and eliminates the need for recurrent or convolutional layers. The model achieves state-of-the-art results on machine translation tasks while being more parallelizable and requiring less training time.',
      keywords: ['transformer', 'attention', 'neural machine translation', 'sequence modeling'],
      confidenceScore: 0.95,
      tokensUsed: 1200,
      processingTimeMs: 3000,
      createdAt: new Date('2023-01-15')
    },
    anthropic: {
      id: 'analysis2',
      paperId: '1',
      modelProvider: 'anthropic',
      modelName: 'claude-3-sonnet',
      summary: 'The paper presents the Transformer model, a novel architecture that uses only attention mechanisms for sequence transduction. It demonstrates superior performance on translation tasks while being more efficient to train due to its parallelizable nature.',
      keywords: ['self-attention', 'encoder-decoder', 'parallelization', 'sequence-to-sequence'],
      confidenceScore: 0.92,
      tokensUsed: 1100,
      processingTimeMs: 2800,
      createdAt: new Date('2023-01-15')
    }
  }]
])

export default function PapersPage() {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [papers, setPapers] = useState(mockPapers)
  const [evaluations, setEvaluations] = useState(mockEvaluations)
  const [activeTab, setActiveTab] = useState('list')
  
  const uploadService = new PaperUploadService()

  const handleStatusChange = (paperId: string, status: 'unread' | 'reading' | 'completed') => {
    setPapers(prev => prev.map(paper => 
      paper.id === paperId 
        ? { ...paper, readingStatus: status, lastModified: new Date() }
        : paper
    ))
  }

  const handleRatingChange = (paperId: string, rating: number) => {
    setEvaluations(prev => {
      const newEvaluations = new Map(prev)
      const existing = newEvaluations.get(paperId)
      
      if (existing) {
        newEvaluations.set(paperId, {
          ...existing,
          rating,
          updatedAt: new Date()
        })
      } else {
        newEvaluations.set(paperId, {
          id: `eval_${paperId}`,
          paperId,
          rating,
          notes: '',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      return newEvaluations
    })
  }

  const handleNotesChange = (notes: string) => {
    if (!selectedPaper) return
    
    setEvaluations(prev => {
      const newEvaluations = new Map(prev)
      const existing = newEvaluations.get(selectedPaper.id)
      
      if (existing) {
        newEvaluations.set(selectedPaper.id, {
          ...existing,
          notes,
          updatedAt: new Date()
        })
      } else {
        newEvaluations.set(selectedPaper.id, {
          id: `eval_${selectedPaper.id}`,
          paperId: selectedPaper.id,
          notes,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      return newEvaluations
    })
  }

  const handleTagsChange = (tags: string[]) => {
    if (!selectedPaper) return
    
    setEvaluations(prev => {
      const newEvaluations = new Map(prev)
      const existing = newEvaluations.get(selectedPaper.id)
      
      if (existing) {
        newEvaluations.set(selectedPaper.id, {
          ...existing,
          tags,
          updatedAt: new Date()
        })
      } else {
        newEvaluations.set(selectedPaper.id, {
          id: `eval_${selectedPaper.id}`,
          paperId: selectedPaper.id,
          notes: '',
          tags,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      return newEvaluations
    })
  }

  const handleUploadComplete = (uploadedPapers: Partial<Paper>[]) => {
    // Add uploaded papers to the list (convert to full Paper objects)
    const newPapers = uploadedPapers.map(paper => ({
      ...paper,
      id: paper.id || `paper_${Date.now()}_${Math.random()}`,
      title: paper.title || 'Untitled Paper',
      authors: paper.authors || [],
      readingStatus: paper.readingStatus || 'unread',
      dateAdded: paper.dateAdded || new Date(),
      lastModified: paper.lastModified || new Date()
    } as Paper))
    
    setPapers(prev => [...newPapers, ...prev])
    toast.success(`Successfully uploaded ${uploadedPapers.length} paper(s)!`)
    setActiveTab('list') // Switch back to list view
  }

  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
  }

  if (selectedPaper) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedPaper(null)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Papers
          </Button>
        </div>
        
        <PaperDetail
          paper={selectedPaper}
          analyses={mockAnalyses.get(selectedPaper.id)}
          evaluation={evaluations.get(selectedPaper.id)}
          onStatusChange={(status) => handleStatusChange(selectedPaper.id, status)}
          onRatingChange={(rating) => handleRatingChange(selectedPaper.id, rating)}
          onNotesChange={handleNotesChange}
          onTagsChange={handleTagsChange}
          onClose={() => setSelectedPaper(null)}
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Research Papers</h1>
        <p className="text-gray-600">
          Manage and analyze your research paper collection with AI-powered insights
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Papers ({papers.length})
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <PaperList
            papers={papers}
            evaluations={evaluations}
            analyses={mockAnalyses}
            onPaperClick={setSelectedPaper}
            onStatusChange={handleStatusChange}
            onRatingChange={handleRatingChange}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <PaperUpload
            uploadService={uploadService}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            className="max-w-4xl"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}