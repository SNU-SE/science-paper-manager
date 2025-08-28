'use client';

import { useState, useCallback } from 'react';
import { Paper } from '@/types';

export interface UploadProgress {
  stage: 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface UploadResult {
  paper: Partial<Paper>;
  uploadResult: {
    fileId: string;
    fileName: string;
    webViewLink: string;
    webContentLink: string;
    folderPath: string;
  };
}

export interface UploadStats {
  totalFiles: number;
  totalSize: string;
  recentUploads: number;
}

export function useGoogleDriveUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadPaper = useCallback(async (
    file: File,
    metadata: {
      title: string;
      authors: string[];
      journal?: string;
      publicationYear?: number;
      doi?: string;
      abstract?: string;
    }
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({
      stage: 'validating',
      progress: 0,
      message: 'Starting upload...'
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('authors', JSON.stringify(metadata.authors));
      
      if (metadata.journal) formData.append('journal', metadata.journal);
      if (metadata.publicationYear) formData.append('publicationYear', metadata.publicationYear.toString());
      if (metadata.doi) formData.append('doi', metadata.doi);
      if (metadata.abstract) formData.append('abstract', metadata.abstract);

      setUploadProgress({
        stage: 'uploading',
        progress: 25,
        message: 'Uploading to Google Drive...'
      });

      const response = await fetch('/api/google-drive/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setUploadProgress({
        stage: 'processing',
        progress: 75,
        message: 'Processing upload...'
      });

      const result = await response.json();

      setUploadProgress({
        stage: 'complete',
        progress: 100,
        message: 'Upload completed successfully!'
      });

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setUploadProgress({
        stage: 'error',
        progress: 0,
        message: 'Upload failed',
        error: errorMessage
      });
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const checkDuplicate = useCallback(async (
    title: string,
    year?: number,
    journal?: string
  ): Promise<boolean> => {
    try {
      const params = new URLSearchParams({
        action: 'check-duplicate',
        title
      });
      
      if (year) params.append('year', year.toString());
      if (journal) params.append('journal', journal);

      const response = await fetch(`/api/google-drive/upload?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to check for duplicates');
      }

      const result = await response.json();
      return result.isDuplicate;

    } catch (err) {
      console.error('Error checking duplicate:', err);
      return false;
    }
  }, []);

  const getUploadStats = useCallback(async (): Promise<UploadStats> => {
    try {
      const response = await fetch('/api/google-drive/upload?action=stats');
      
      if (!response.ok) {
        throw new Error('Failed to get upload stats');
      }

      return await response.json();

    } catch (err) {
      console.error('Error getting upload stats:', err);
      return {
        totalFiles: 0,
        totalSize: '0 B',
        recentUploads: 0
      };
    }
  }, []);

  const getAuthUrl = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('/api/google-drive/auth?action=auth-url');
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const result = await response.json();
      return result.authUrl;

    } catch (err) {
      console.error('Error getting auth URL:', err);
      throw err;
    }
  }, []);

  const exchangeCodeForTokens = useCallback(async (code: string) => {
    try {
      const response = await fetch('/api/google-drive/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      return await response.json();

    } catch (err) {
      console.error('Error exchanging code for tokens:', err);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setUploadProgress(null);
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    error,

    // Actions
    uploadPaper,
    checkDuplicate,
    getUploadStats,
    getAuthUrl,
    exchangeCodeForTokens,
    clearError
  };
}