import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserEvaluation } from '../UserEvaluation'
import { Paper, UserEvaluation as UserEvaluationType } from '@/types'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the hooks
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))

const mockPaper: Paper = {
  id: '1',
  title: 'Test Paper',
  authors: ['Author 1'],
  readingStatus: 'unread',
  dateAdded: new Date(),
  lastModified: new Date()
}

const mockEvaluation: UserEvaluationType = {
  id: '1',
  paperId: '1',
  rating: 4,
  notes: 'Great paper!',
  tags: ['machine-learning', 'ai'],
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('UserEvaluation', () => {
  const mockOnSave = jest.fn()

  beforeEach(() => {
    mockOnSave.mockClear()
  })

  it('renders existing evaluation', () => {
    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={mockEvaluation}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText('Great paper!')).toBeInTheDocument()
    expect(screen.getByText('machine-learning')).toBeInTheDocument()
    expect(screen.getByText('ai')).toBeInTheDocument()
  })

  it('starts in edit mode when no evaluation exists', () => {
    render(
      <UserEvaluation
        paper={mockPaper}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={mockEvaluation}
        onSave={mockOnSave}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit/i }))
    
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('saves evaluation when save button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <UserEvaluation
        paper={mockPaper}
        onSave={mockOnSave}
      />
    )

    // Set rating
    const stars = screen.getAllByRole('button')
    const starButtons = stars.filter(button => 
      button.querySelector('svg')?.classList.contains('h-6') // Large stars in the rating component
    )
    await user.click(starButtons[3]) // 4 stars

    // Add notes - get the textarea specifically
    const notesTextarea = screen.getByPlaceholderText(/add your thoughts/i)
    await user.type(notesTextarea, 'Test notes')

    // Save
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          paperId: '1',
          rating: 4,
          notes: 'Test notes'
        })
      )
    })
  })

  it('cancels editing when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={mockEvaluation}
        onSave={mockOnSave}
      />
    )

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows tag suggestions', async () => {
    const user = userEvent.setup()
    const tagSuggestions = ['neural-networks', 'deep-learning']
    
    render(
      <UserEvaluation
        paper={mockPaper}
        onSave={mockOnSave}
        tagSuggestions={tagSuggestions}
      />
    )

    // Find the tag input
    const tagInput = screen.getByPlaceholderText(/add tags/i)
    await user.type(tagInput, 'neural')

    await waitFor(() => {
      expect(screen.getByText('neural-networks')).toBeInTheDocument()
    })
  })

  it('disables save button when no changes are made', () => {
    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={mockEvaluation}
        onSave={mockOnSave}
      />
    )

    // Click edit to enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    // Save button should be disabled when no changes
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('shows reading status component', () => {
    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={mockEvaluation}
        onSave={mockOnSave}
      />
    )

    // Reading status component should be present
    expect(screen.getByText('My Evaluation')).toBeInTheDocument()
  })

  it('displays creation and update dates', () => {
    const evaluation = {
      ...mockEvaluation,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02')
    }

    render(
      <UserEvaluation
        paper={mockPaper}
        evaluation={evaluation}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText(/created: 1\/1\/2023/i)).toBeInTheDocument()
    expect(screen.getByText(/updated: 1\/2\/2023/i)).toBeInTheDocument()
  })
})