import { NextRequest, NextResponse } from 'next/server'
import { Paper } from '@/types'

// Mock data for demonstration - in real app this would come from database
const mockPapers: Paper[] = [
  {
    id: '1',
    title: 'Deep Learning for Natural Language Processing: A Comprehensive Survey',
    authors: ['John Smith', 'Jane Doe'],
    journal: 'Nature Machine Intelligence',
    publicationYear: 2024,
    doi: '10.1038/s42256-024-00001-1',
    abstract: 'This paper provides a comprehensive survey of deep learning techniques for natural language processing...',
    readingStatus: 'completed',
    dateAdded: new Date('2024-01-15'),
    dateRead: new Date('2024-01-20'),
    lastModified: new Date('2024-01-20')
  },
  {
    id: '2',
    title: 'Transformer Architecture Improvements for Large Language Models',
    authors: ['Alice Johnson', 'Bob Wilson'],
    journal: 'Journal of Machine Learning Research',
    publicationYear: 2024,
    abstract: 'We propose several improvements to the transformer architecture that enhance performance...',
    readingStatus: 'reading',
    dateAdded: new Date('2024-02-01'),
    lastModified: new Date('2024-02-05')
  },
  {
    id: '3',
    title: 'Ethical Considerations in AI Development',
    authors: ['Carol Brown', 'David Lee'],
    journal: 'AI Ethics',
    publicationYear: 2023,
    abstract: 'This paper discusses the ethical implications of artificial intelligence development...',
    readingStatus: 'unread',
    dateAdded: new Date('2024-02-10'),
    lastModified: new Date('2024-02-10')
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Get single paper
      const paper = mockPapers.find(p => p.id === id)
      if (!paper) {
        return NextResponse.json(
          { error: 'Paper not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(paper)
    } else {
      // Get all papers
      return NextResponse.json(mockPapers)
    }
  } catch (error) {
    console.error('Error in GET /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch papers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const paper: Partial<Paper> = body

    // Validate required fields
    if (!paper.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // In real app, this would save to database
    const newPaper: Paper = {
      id: Date.now().toString(),
      title: paper.title,
      authors: paper.authors || [],
      journal: paper.journal,
      publicationYear: paper.publicationYear,
      doi: paper.doi,
      abstract: paper.abstract,
      zoteroKey: paper.zoteroKey,
      googleDriveId: paper.googleDriveId,
      googleDriveUrl: paper.googleDriveUrl,
      pdfPath: paper.pdfPath,
      readingStatus: paper.readingStatus || 'unread',
      dateAdded: new Date(),
      dateRead: paper.dateRead,
      lastModified: new Date()
    }

    mockPapers.push(newPaper)
    return NextResponse.json(newPaper)
  } catch (error) {
    console.error('Error in POST /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to create paper' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates }: Partial<Paper> & { id: string } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    // Find paper index
    const paperIndex = mockPapers.findIndex(p => p.id === id)
    if (paperIndex === -1) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      )
    }

    // Update paper
    const updatedPaper: Paper = {
      ...mockPapers[paperIndex],
      ...updates,
      id, // Ensure ID doesn't change
      lastModified: new Date()
    }

    mockPapers[paperIndex] = updatedPaper
    return NextResponse.json(updatedPaper)
  } catch (error) {
    console.error('Error in PUT /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to update paper' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      )
    }

    // Find paper index
    const paperIndex = mockPapers.findIndex(p => p.id === id)
    if (paperIndex === -1) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      )
    }

    // Remove paper
    const deletedPaper = mockPapers.splice(paperIndex, 1)[0]
    return NextResponse.json({
      success: true,
      message: `Paper "${deletedPaper.title}" deleted successfully`
    })
  } catch (error) {
    console.error('Error in DELETE /api/papers:', error)
    return NextResponse.json(
      { error: 'Failed to delete paper' },
      { status: 500 }
    )
  }
}