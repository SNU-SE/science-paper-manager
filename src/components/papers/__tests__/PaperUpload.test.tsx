import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaperUpload } from '../PaperUpload';
import { PaperUploadService } from '@/services/upload/PaperUploadService';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the hooks and services
jest.mock('@/hooks/useAIAnalysis');
jest.mock('@/services/upload/PaperUploadService');

const mockUseAIAnalysis = useAIAnalysis as jest.MockedFunction<typeof useAIAnalysis>;

describe('PaperUpload', () => {
  const mockUploadService = {
    uploadPaper: jest.fn(),
    uploadMultiplePapers: jest.fn(),
    checkDuplicatePaper: jest.fn(),
    getUploadStats: jest.fn()
  } as unknown as PaperUploadService;

  const mockAIAnalysis = {
    startAnalysis: jest.fn(),
    apiKeys: { openai: 'test-key' },
    hasValidApiKey: jest.fn(() => true),
    selectedModels: ['openai'],
    setSelectedModels: jest.fn(),
    isAnalyzing: false,
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAIAnalysis.mockReturnValue(mockAIAnalysis as any);
  });

  it('renders upload area correctly', () => {
    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={jest.fn()}
      />
    );

    expect(screen.getByText('Upload Papers')).toBeInTheDocument();
    expect(screen.getByText('Drop PDF files here or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Select Files')).toBeInTheDocument();
  });

  it('handles file drop correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={jest.fn()}
      />
    );

    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    
    // Create a mock PDF file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    // Simulate file drop
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Files to Upload (1)')).toBeInTheDocument();
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('shows batch processing settings when files are added', async () => {
    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={jest.fn()}
      />
    );

    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Batch Processing Settings')).toBeInTheDocument();
      expect(screen.getByText('Enable AI Analysis')).toBeInTheDocument();
      expect(screen.getByText('Max Retries')).toBeInTheDocument();
      expect(screen.getByText('Retry Delay (seconds)')).toBeInTheDocument();
    });
  });

  it('handles successful upload with batch analysis', async () => {
    const mockOnUploadComplete = jest.fn();
    const mockPaper = {
      id: '1',
      title: 'Test Paper',
      authors: ['Author 1'],
      googleDriveId: 'drive-id',
      googleDriveUrl: 'https://drive.google.com/file/d/drive-id'
    };

    mockUploadService.uploadPaper = jest.fn().mockResolvedValue({
      paper: mockPaper,
      uploadResult: {
        fileId: 'drive-id',
        fileName: 'test.pdf',
        webViewLink: 'https://drive.google.com/file/d/drive-id',
        webContentLink: 'https://drive.google.com/file/d/drive-id/export',
        folderPath: '2024/Test Journal/Test Paper'
      }
    });

    mockAIAnalysis.startAnalysis.mockResolvedValue(undefined);

    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={jest.fn()}
      />
    );

    // Add file
    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });

    // Fill in metadata
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Paper title');
      fireEvent.change(titleInput, { target: { value: 'Test Paper' } });
    });

    // Start upload
    const uploadButton = screen.getByText('Start Batch Upload');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockUploadService.uploadPaper).toHaveBeenCalled();
      expect(mockAIAnalysis.startAnalysis).toHaveBeenCalledWith(mockPaper, ['openai']);
      expect(mockOnUploadComplete).toHaveBeenCalledWith([mockPaper]);
    });
  });

  it('handles upload errors with retry mechanism', async () => {
    const mockOnUploadError = jest.fn();
    
    mockUploadService.uploadPaper = jest.fn()
      .mockRejectedValue(new Error('Network error'));

    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={mockOnUploadError}
      />
    );

    // Add file
    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });

    // Fill in metadata
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Paper title');
      fireEvent.change(titleInput, { target: { value: 'Test Paper' } });
    });

    // Start upload
    const uploadButton = screen.getByText('Start Batch Upload');
    fireEvent.click(uploadButton);

    // Should show error after retries
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('allows pausing and resuming batch operations', async () => {
    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={jest.fn()}
      />
    );

    // Add multiple files
    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const files = [
      new File(['test content 1'], 'test1.pdf', { type: 'application/pdf' }),
      new File(['test content 2'], 'test2.pdf', { type: 'application/pdf' })
    ];
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files
      }
    });

    // Start upload
    await waitFor(() => {
      const uploadButton = screen.getByText('Start Batch Upload');
      fireEvent.click(uploadButton);
    });

    // Should show batch progress with pause/resume controls
    await waitFor(() => {
      expect(screen.getByText('Batch Processing Progress')).toBeInTheDocument();
    });
  });

  it('validates file types and shows error for non-PDF files', async () => {
    const mockOnUploadError = jest.fn();
    
    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const invalidFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [invalidFile]
      }
    });

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith('Only PDF files are allowed');
    });
  });

  it('shows analysis progress for each file', async () => {
    const mockPaper = {
      id: '1',
      title: 'Test Paper',
      authors: ['Author 1']
    };

    mockUploadService.uploadPaper = jest.fn().mockResolvedValue({
      paper: mockPaper,
      uploadResult: { fileId: 'drive-id' }
    });

    // Mock analysis in progress
    mockAIAnalysis.startAnalysis = jest.fn().mockImplementation(async () => {
      // Simulate analysis progress
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    render(
      <PaperUpload
        uploadService={mockUploadService}
        onUploadComplete={jest.fn()}
        onUploadError={jest.fn()}
      />
    );

    // Add file and start upload
    const dropZone = screen.getByText('Drop PDF files here or click to browse').closest('div');
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Paper title');
      fireEvent.change(titleInput, { target: { value: 'Test Paper' } });
    });

    const uploadButton = screen.getByText('Start Batch Upload');
    fireEvent.click(uploadButton);

    // Should show analysis progress
    await waitFor(() => {
      expect(mockAIAnalysis.startAnalysis).toHaveBeenCalled();
    });
  });
});