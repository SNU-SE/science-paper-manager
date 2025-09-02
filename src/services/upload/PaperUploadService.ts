import { Paper } from '@/types';

// Re-export types for client use
export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  webContentLink: string;
  folderPath: string;
}

export interface UploadConfig {
  googleDrive: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
    rootFolderId?: string;
  };
}

export interface PaperUploadData {
  file: File;
  title: string;
  authors: string[];
  journal?: string;
  publicationYear?: number;
  doi?: string;
  abstract?: string;
}

export interface UploadProgress {
  stage: 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export class PaperUploadService {
  private config: UploadConfig;

  constructor(config: UploadConfig) {
    this.config = config;
  }

  /**
   * Validate PDF file before upload
   */
  private validatePDFFile(file: File): void {
    // Check file type
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed');
    }

    // Check file size (allow large files; resumable upload handles this)
    const maxSize = 1 * 1024 * 1024 * 1024; // 1GB soft limit
    if (file.size > maxSize) {
      // Soft warning: continue, resumable upload can still work
      console.warn('Large file detected; proceeding with resumable upload');
    }

    // Check file name
    if (!file.name || file.name.trim() === '') {
      throw new Error('File must have a valid name');
    }
  }

  /**
   * Generate folder structure path
   */
  private generateFolderPath(paperData: PaperUploadData): {
    year: string;
    journal: string;
    paperTitle: string;
  } {
    const year = paperData.publicationYear?.toString() || new Date().getFullYear().toString();
    const journal = paperData.journal || 'Unknown Journal';
    
    // Clean paper title for folder name
    const paperTitle = paperData.title
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .substring(0, 100); // Limit length

    return { year, journal, paperTitle };
  }

  /**
   * Upload paper with progress tracking
   */
  async uploadPaper(
    paperData: PaperUploadData,
    onProgress?: (progress: UploadProgress) => void,
    opts?: { userId?: string; accessToken?: string }
  ): Promise<{ paper: Partial<Paper>; uploadResult: UploadResult }> {
    try {
      // Stage 1: Validation
      onProgress?.({
        stage: 'validating',
        progress: 10,
        message: 'Validating file...'
      });

      this.validatePDFFile(paperData.file);

      // Stage 2: Prepare upload
      onProgress?.({
        stage: 'uploading',
        progress: 20,
        message: 'Preparing upload...'
      });

      const { year, journal, paperTitle } = this.generateFolderPath(paperData);

      // Stage 3: Start resumable upload session
      onProgress?.({ stage: 'uploading', progress: 30, message: 'Starting upload session...' });

      const startForm = new FormData();
      startForm.append('action', 'start');
      startForm.append('fileName', paperData.file.name);
      startForm.append('totalSize', String(paperData.file.size));
      startForm.append('year', year);
      startForm.append('journal', journal);
      startForm.append('paperTitle', paperTitle);
      if (opts?.userId) startForm.append('userId', opts.userId);
      if (opts?.accessToken) startForm.append('accessToken', opts.accessToken);

      const startRes = await fetch('/api/google-drive/upload', { method: 'POST', body: startForm });
      if (!startRes.ok) {
        const errText = await startRes.text();
        throw new Error(`Failed to start upload: ${errText}`);
      }
      const { uploadUrl } = await startRes.json();

      // Stage 4: Upload chunks
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      const total = paperData.file.size;
      let uploaded = 0;
      let finalResult: UploadResult | null = null;

      while (uploaded < total) {
        const start = uploaded;
        const end = Math.min(uploaded + CHUNK_SIZE, total) - 1;
        const chunkBlob = paperData.file.slice(start, end + 1);

        const chunkForm = new FormData();
        chunkForm.append('action', 'chunk');
        chunkForm.append('uploadUrl', uploadUrl);
        chunkForm.append('chunkStart', String(start));
        chunkForm.append('chunkEnd', String(end));
        chunkForm.append('totalSize', String(total));
        chunkForm.append('chunk', chunkBlob, `${paperData.file.name}.part`);
        chunkForm.append('year', year);
        chunkForm.append('journal', journal);
        chunkForm.append('paperTitle', paperTitle);

        const res = await fetch('/api/google-drive/upload', { method: 'POST', body: chunkForm });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Chunk upload failed: ${errText}`);
        }
        const data = await res.json();

        uploaded = end + 1;
        const pct = Math.min(99, Math.floor((uploaded / total) * 100));
        onProgress?.({ stage: 'uploading', progress: pct, message: `Uploading... ${pct}%` });

        if (data && data.fileId) {
          finalResult = {
            fileId: data.fileId,
            fileName: data.fileName,
            webViewLink: data.webViewLink,
            webContentLink: data.webContentLink,
            folderPath: data.folderPath,
          };
        }
      }

      if (!finalResult) {
        throw new Error('Upload did not finalize properly');
      }

      // Stage 5: Create paper object
      onProgress?.({
        stage: 'processing',
        progress: 95,
        message: 'Processing paper data...'
      });

      const paper: Partial<Paper> = {
        title: paperData.title,
        authors: paperData.authors,
        journal: paperData.journal,
        publicationYear: paperData.publicationYear,
        doi: paperData.doi,
        abstract: paperData.abstract,
        googleDriveId: finalResult.fileId,
        googleDriveUrl: finalResult.webViewLink,
        pdfPath: finalResult.folderPath,
        readingStatus: 'unread',
        dateAdded: new Date(),
        lastModified: new Date()
      };

      // Stage 6: Complete
      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Upload completed successfully!'
      });

      return { paper, uploadResult: finalResult };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Upload failed',
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Upload multiple papers in batch
   */
  async uploadMultiplePapers(
    papersData: PaperUploadData[],
    onProgress?: (index: number, progress: UploadProgress) => void
  ): Promise<Array<{ paper: Partial<Paper>; uploadResult: UploadResult; error?: string }>> {
    const results: Array<{ paper: Partial<Paper>; uploadResult: UploadResult; error?: string }> = [];

    for (let i = 0; i < papersData.length; i++) {
      try {
        const result = await this.uploadPaper(
          papersData[i],
          (progress) => onProgress?.(i, progress)
        );
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        results.push({
          paper: {} as Partial<Paper>,
          uploadResult: {} as UploadResult,
          error: errorMessage
        });
      }
    }

    return results;
  }

  /**
   * Check if paper already exists
   */
  async checkDuplicatePaper(
    title: string,
    year?: number,
    journal?: string
  ): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        title,
        ...(year && { year: year.toString() }),
        ...(journal && { journal })
      });

      const response = await fetch(`/api/google-drive/check-duplicate?${params}`);
      
      if (!response.ok) {
        throw new Error(`Check failed: ${response.statusText}`);
      }

      const { exists } = await response.json();
      return exists;
    } catch (error) {
      console.error('Error checking duplicate paper:', error);
      return false;
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(): Promise<{
    totalFiles: number;
    totalSize: string;
    recentUploads: number;
  }> {
    try {
      const response = await fetch('/api/google-drive/stats');
      
      if (!response.ok) {
        throw new Error(`Stats failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting upload stats:', error);
      return {
        totalFiles: 0,
        totalSize: '0 B',
        recentUploads: 0
      };
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
