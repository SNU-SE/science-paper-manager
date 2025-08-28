import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from '../tag-input'
import { it } from 'node:test'
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

describe('TagInput', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders existing tags', () => {
    render(
      <TagInput
        tags={['react', 'typescript']}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  it('adds tag when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<TagInput tags={[]} onChange={mockOnChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'new-tag')
    await user.keyboard('{Enter}')

    expect(mockOnChange).toHaveBeenCalledWith(['new-tag'])
  })

  it('adds tag when comma is typed', async () => {
    const user = userEvent.setup()
    render(<TagInput tags={[]} onChange={mockOnChange} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'new-tag,')

    expect(mockOnChange).toHaveBeenCalledWith(['new-tag'])
  })

  it('removes tag when X button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <TagInput
        tags={['react', 'typescript']}
        onChange={mockOnChange}
      />
    )

    const removeButtons = screen.getAllByRole('button')
    await user.click(removeButtons[0]) // Click first remove button

    expect(mockOnChange).toHaveBeenCalledWith(['typescript'])
  })

  it('shows suggestions when typing', async () => {
    const user = userEvent.setup()
    render(
      <TagInput
        tags={[]}
        onChange={mockOnChange}
        suggestions={['javascript', 'java', 'python']}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'ja')

    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument()
      expect(screen.getByText('java')).toBeInTheDocument()
    })
  })

  it('adds suggestion when clicked', async () => {
    const user = userEvent.setup()
    render(
      <TagInput
        tags={[]}
        onChange={mockOnChange}
        suggestions={['javascript']}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'ja')

    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument()
    })

    await user.click(screen.getByText('javascript'))
    expect(mockOnChange).toHaveBeenCalledWith(['javascript'])
  })

  it('prevents duplicate tags', async () => {
    const user = userEvent.setup()
    render(
      <TagInput
        tags={['react']}
        onChange={mockOnChange}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'react')
    await user.keyboard('{Enter}')

    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('respects maxTags limit', async () => {
    const user = userEvent.setup()
    
    // Start with tags at the limit
    const { rerender } = render(
      <TagInput
        tags={['tag1', 'tag2']}
        onChange={mockOnChange}
        maxTags={2}
      />
    )

    // Try to add another tag - should not work
    const input = screen.queryByRole('textbox')
    if (input) {
      await user.type(input, 'tag3')
      await user.keyboard('{Enter}')
      expect(mockOnChange).not.toHaveBeenCalled()
    } else {
      // If input is not rendered when at limit, that's also valid behavior
      expect(input).toBeNull()
    }
  })

  it('shows tag count when maxTags is set', () => {
    render(
      <TagInput
        tags={['tag1']}
        onChange={mockOnChange}
        maxTags={5}
      />
    )

    expect(screen.getByText('1/5 tags')).toBeInTheDocument()
  })

  it('handles keyboard navigation in suggestions', async () => {
    const user = userEvent.setup()
    render(
      <TagInput
        tags={[]}
        onChange={mockOnChange}
        suggestions={['javascript', 'java']}
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'ja')

    await waitFor(() => {
      expect(screen.getByText('javascript')).toBeInTheDocument()
    })

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(mockOnChange).toHaveBeenCalledWith(['javascript'])
  })
})