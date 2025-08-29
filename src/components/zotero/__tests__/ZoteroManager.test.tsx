import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ZoteroManager } from '../ZoteroManager'

// Mock the child components
jest.mock('../ZoteroConfig', () => ({
  ZoteroConfig: ({ onConfigured }: { onConfigured: (settings: any) => void }) => (
    <div data-testid="zotero-config">
      <button 
        onClick={() => onConfigured({ 
          userId: 'test-user', 
          libraryType: 'user',
          hasApiKey: true 
        })}
      >
        Configure Zotero
      </button>
    </div>
  )
}))

jest.mock('../ZoteroSyncStatus', () => ({
  ZoteroSyncStatus: ({ settings }: { settings: any }) => (
    <div data-testid="zotero-sync-status">
      Sync Status for {settings.userId}
    </div>
  )
}))

describe('ZoteroManager', () => {
  it('renders ZoteroConfig component initially', () => {
    render(<ZoteroManager />)
    
    expect(screen.getByTestId('zotero-config')).toBeInTheDocument()
    expect(screen.queryByTestId('zotero-sync-status')).not.toBeInTheDocument()
  })

  it('shows ZoteroSyncStatus after configuration', async () => {
    render(<ZoteroManager />)
    
    // Click configure button to trigger onConfigured
    fireEvent.click(screen.getByText('Configure Zotero'))
    
    await waitFor(() => {
      expect(screen.getByTestId('zotero-sync-status')).toBeInTheDocument()
      expect(screen.getByText('Sync Status for test-user')).toBeInTheDocument()
    })
  })

  it('maintains both components after configuration', async () => {
    render(<ZoteroManager />)
    
    // Configure Zotero
    fireEvent.click(screen.getByText('Configure Zotero'))
    
    await waitFor(() => {
      expect(screen.getByTestId('zotero-config')).toBeInTheDocument()
      expect(screen.getByTestId('zotero-sync-status')).toBeInTheDocument()
    })
  })

  it('passes correct settings to ZoteroSyncStatus', async () => {
    render(<ZoteroManager />)
    
    // Configure with specific settings
    fireEvent.click(screen.getByText('Configure Zotero'))
    
    await waitFor(() => {
      expect(screen.getByText('Sync Status for test-user')).toBeInTheDocument()
    })
  })

  it('handles settings state correctly', async () => {
    render(<ZoteroManager />)
    
    // Initially no sync status
    expect(screen.queryByTestId('zotero-sync-status')).not.toBeInTheDocument()
    
    // After configuration, sync status appears
    fireEvent.click(screen.getByText('Configure Zotero'))
    
    await waitFor(() => {
      expect(screen.getByTestId('zotero-sync-status')).toBeInTheDocument()
    })
  })
})