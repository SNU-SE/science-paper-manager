'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Plus,
  Brain,
  RefreshCw,
  Pause,
  Play,
  Settings
} from 'lucide-react';
import { PaperUploadService, PaperUploadData, UploadProgress } from '@/services/upload/PaperUploadService';
import { Paper, AIModel } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { AIModelSelector } from '@/components/ai/AIModelSelector';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { useErrorToast } from '@/hooks/useErrorToast';
import { useRetry } from '@/hooks/useRetry';
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/loading-spinner';
import { withErrorBoundary } from '@/components/error/ErrorBoundary';

interface PaperUploadProps {
  onUploadComplete?: (papers: Partial<Paper>[]) => void;
  onUploadError?: (error: string) => void;
  uploadService: PaperUploadService;
  className?: string;
}

interface FileWithMetadata extends PaperUploadData {
  id: string;
  uploadProgress?: UploadProgress;
  analysisProgress?: BatchAnalysisProgress;
  isUploaded?: boolean;
  isAnalyzed?: boolean;
  error?: string;
  retryCount?: number;
  metadataFilling?: boolean;
  metadataAutoFilled?: boolean;
}

interface BatchAnalysisProgress {
  stage: 'pending' | 'analyzing' | 'completed' | 'error' | 'paused';
  progress: number;
  message: string;
  completedModels: AIModel[];
  failedModels: AIModel[];
  currentModel?: AIModel;
}

interface BatchOperationState {
  isRunning: boolean;
  isPaused: boolean;
  currentFileIndex: number;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

function PaperUploadComponent({ 
  onUploadComplete, 
  onUploadError, 
  uploadService,
  className 
}: PaperUploadProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [enableBatchAnalysis, setEnableBatchAnalysis] = useState(true);
  const [enableAutoFill, setEnableAutoFill] = useState(true);
  const [selectedModels, setSelectedModels] = useState<AIModel[]>(['openai']);
  const [batchState, setBatchState] = useState<BatchOperationState>({
    isRunning: false,
    isPaused: false,
    currentFileIndex: 0,
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0
  });
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(5000); // 5 seconds
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { startAnalysis, apiKeys, hasValidApiKey } = useAIAnalysis();
  const { showError, showSuccess, showWarning } = useErrorToast();
  const { user, session } = useAuth() as any;
  
  // Retry mechanism for upload operations
  const uploadRetry = useRetry(
    () => Promise.resolve(), // Will be replaced with actual upload function
    {
      maxRetries: maxRetries,
      baseDelay: retryDelay,
      onRetry: (attempt, error) => {
        showWarning(`Retrying upload (attempt ${attempt}/${maxRetries})...`)
      }
    }
  );

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== droppedFiles.length) {
      onUploadError?.('Only PDF files are allowed');
      return;
    }

    addFiles(pdfFiles);
  }, [onUploadError]);

  // Handle file input change
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    e.target.value = ''; // Reset input
  }, []);

  // Add files to the list
  const addFiles = useCallback((newFiles: File[]) => {
    const now = Date.now();
    const filesWithMetadata: FileWithMetadata[] = newFiles.map((file, idx) => ({
      id: `${file.name}-${now}-${idx}-${Math.random()}`,
      file,
      title: file.name.replace(/\.pdf$/i, ''),
      authors: [],
      journal: '',
      publicationYear: new Date().getFullYear(),
      abstract: '',
      metadataFilling: enableAutoFill && hasValidApiKey('openai') ? true : false,
      metadataAutoFilled: false
    }));

    setFiles(prev => [...prev, ...filesWithMetadata]);

    if (enableAutoFill && hasValidApiKey('openai')) {
      filesWithMetadata.forEach((f) => {
        (async () => {
          try {
            const form = new FormData();
            form.append('file', f.file);
            form.append('openaiApiKey', apiKeys.openai);
            const res = await fetch('/api/metadata/extract', { method: 'POST', body: form });
            if (res.ok) {
              const meta = await res.json();
              setFiles(prev => prev.map(existing => existing.id === f.id ? ({
                ...existing,
                title: meta.title || existing.title,
                authors: Array.isArray(meta.authors) ? meta.authors : existing.authors,
                publicationYear: meta.publicationYear || existing.publicationYear,
                journal: meta.journal || existing.journal,
                doi: meta.doi || existing.doi,
                metadataFilling: false,
                metadataAutoFilled: true
              }) : existing));
            } else {
              setFiles(prev => prev.map(existing => existing.id === f.id ? ({
                ...existing,
                metadataFilling: false
              }) : existing));
            }
          } catch (e) {
            setFiles(prev => prev.map(existing => existing.id === f.id ? ({
              ...existing,
              metadataFilling: false
            }) : existing));
          }
        })();
      });
    }
  }, [enableAutoFill, hasValidApiKey, apiKeys.openai]);

  // Remove file from list
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  }, []);

  // Update file metadata
  const updateFileMetadata = useCallback((id: string, updates: Partial<PaperUploadData>) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  }, []);

  // Add author to file
  const addAuthor = useCallback((fileId: string, author: string) => {
    if (!author.trim()) return;
    
    updateFileMetadata(fileId, {
      authors: [...(files.find(f => f.id === fileId)?.authors || []), author.trim()]
    });
  }, [files, updateFileMetadata]);

  // Remove author from file
  const removeAuthor = useCallback((fileId: string, authorIndex: number) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const newAuthors = file.authors.filter((_, index) => index !== authorIndex);
    updateFileMetadata(fileId, { authors: newAuthors });
  }, [files, updateFileMetadata]);

  // Upload all files with batch processing
  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
    setIsUploading(true);
    setBatchState({
      isRunning: true,
      isPaused: false,
      currentFileIndex: 0,
      totalFiles: files.length,
      completedFiles: 0,
      failedFiles: 0,
      startTime: new Date()
    });

    const uploadedPapers: Partial<Paper>[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        // Check for cancellation
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        // Check for pause
        while (batchState.isPaused && !abortControllerRef.current?.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const file = files[i];
        
        // Skip already uploaded files
        if (file.isUploaded) {
          setBatchState(prev => ({ ...prev, currentFileIndex: i + 1, completedFiles: prev.completedFiles + 1 }));
          continue;
        }

        setBatchState(prev => ({ ...prev, currentFileIndex: i }));

        try {
          const result = await uploadFileWithRetry(file, i);
          uploadedPapers.push(result.paper);

          // Start AI analysis if enabled
          if (enableBatchAnalysis && selectedModels.length > 0) {
            await analyzeFileWithRetry(result.paper, file.id);
          }

          setBatchState(prev => ({ 
            ...prev, 
            completedFiles: prev.completedFiles + 1,
            estimatedTimeRemaining: calculateEstimatedTime(prev.startTime!, i + 1, files.length)
          }));

        } catch (error) {
          showError(error, {
            title: 'Upload Failed',
            onRetry: () => retryFile(file.id)
          });
          setBatchState(prev => ({ ...prev, failedFiles: prev.failedFiles + 1 }));
        }
      }

      if (uploadedPapers.length > 0) {
        onUploadComplete?.(uploadedPapers);
      }

    } catch (error) {
      showError(error, {
        title: 'Batch Upload Failed',
        onRetry: () => startBatchUpload()
      });
      const errorMessage = error instanceof Error ? error.message : 'Batch upload failed';
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setBatchState(prev => ({ ...prev, isRunning: false }));
      abortControllerRef.current = null;
    }
  }, [files, uploadService, onUploadComplete, onUploadError, enableBatchAnalysis, selectedModels, batchState.isPaused]);

  // Upload single file with retry logic
  const uploadFileWithRetry = useCallback(async (file: FileWithMetadata, index: number): Promise<{ paper: Partial<Paper> }> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await uploadService.uploadPaper(
          file,
          (progress) => {
            setFiles(prev => prev.map(f => 
              f.id === file.id ? { ...f, uploadProgress: progress } : f
            ));
          },
          { userId: user?.id, accessToken: session?.access_token }
        );

        // Persist to Papers DB so it appears in lists (requires API auth header)
        try {
          const savedRes = await fetch('/api/papers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify(result.paper)
          })
          if (savedRes.ok) {
            const savedPaper = await savedRes.json()
            // Attach returned id to enable downstream analysis
            result.paper.id = savedPaper.id
          } else {
            console.warn('Failed to persist paper to DB')
          }
        } catch (e) {
          console.warn('Persist error:', e)
        }

        // Mark as uploaded
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            isUploaded: true, 
            error: undefined,
            retryCount: attempt
          } : f
        ));

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Upload failed');
        
        if (attempt < maxRetries) {
          // Update retry count and wait before retry
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { 
              ...f, 
              retryCount: attempt + 1,
              uploadProgress: {
                stage: 'error',
                progress: 0,
                message: `Retry ${attempt + 1}/${maxRetries} in ${retryDelay/1000}s...`,
                error: lastError?.message
              }
            } : f
          ));

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Upload failed after retries';
    setFiles(prev => prev.map(f => 
      f.id === file.id ? { 
        ...f, 
        error: errorMessage, 
        uploadProgress: undefined,
        retryCount: maxRetries
      } : f
    ));

    throw lastError || new Error(errorMessage);
  }, [uploadService, maxRetries, retryDelay]);

  // Analyze file with retry logic
  const analyzeFileWithRetry = useCallback(async (paper: Partial<Paper>, fileId: string) => {
    if (!paper.id) return;

    // Validate API keys for selected models
    const validModels = selectedModels.filter(model => hasValidApiKey(model));
    if (validModels.length === 0) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          analysisProgress: {
            stage: 'error',
            progress: 0,
            message: 'No valid API keys for selected models',
            completedModels: [],
            failedModels: selectedModels
          }
        } : f
      ));
      return;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Update analysis progress
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            analysisProgress: {
              stage: 'analyzing',
              progress: 0,
              message: `Analyzing with ${validModels.length} models...`,
              completedModels: [],
              failedModels: []
            }
          } : f
        ));

        await startAnalysis(paper as Paper, validModels);

        // Mark as analyzed
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            isAnalyzed: true,
            analysisProgress: {
              stage: 'completed',
              progress: 100,
              message: 'Analysis completed successfully',
              completedModels: validModels,
              failedModels: []
            }
          } : f
        ));

        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Analysis failed');
        
        if (attempt < maxRetries) {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              analysisProgress: {
                stage: 'error',
                progress: 0,
                message: `Analysis retry ${attempt + 1}/${maxRetries} in ${retryDelay/1000}s...`,
                completedModels: [],
                failedModels: validModels
              }
            } : f
          ));

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { 
        ...f, 
        analysisProgress: {
          stage: 'error',
          progress: 0,
          message: lastError?.message || 'Analysis failed after retries',
          completedModels: [],
          failedModels: validModels
        }
      } : f
    ));
  }, [selectedModels, hasValidApiKey, startAnalysis, maxRetries, retryDelay]);

  // Calculate estimated time remaining
  const calculateEstimatedTime = useCallback((startTime: Date, completed: number, total: number): number => {
    if (completed === 0) return 0;
    
    const elapsed = Date.now() - startTime.getTime();
    const avgTimePerFile = elapsed / completed;
    const remaining = total - completed;
    
    return Math.round((avgTimePerFile * remaining) / 1000); // in seconds
  }, []);

  // Pause/Resume batch operation
  const togglePause = useCallback(() => {
    setBatchState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // Cancel batch operation
  const cancelBatch = useCallback(() => {
    abortControllerRef.current?.abort();
    setBatchState(prev => ({ ...prev, isRunning: false, isPaused: false }));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setBatchState({
      isRunning: false,
      isPaused: false,
      currentFileIndex: 0,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0
    });
  }, []);

  // Retry failed file
  const retryFile = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || file.isUploaded) return;

    try {
      // Reset error state
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          error: undefined, 
          retryCount: 0,
          uploadProgress: undefined,
          analysisProgress: undefined
        } : f
      ));

      // Retry upload
      const result = await uploadFileWithRetry(file, 0);
      
      // Retry analysis if enabled
      if (enableBatchAnalysis && selectedModels.length > 0) {
        await analyzeFileWithRetry(result.paper, fileId);
      }

    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [files, uploadFileWithRetry, analyzeFileWithRetry, enableBatchAnalysis, selectedModels]);

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className={className}>
      {/* Upload Area */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Papers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
          >
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              Drop PDF files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supports multiple PDF files up to 50MB each
            </p>
            <Input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              // Keep the input hidden visually but accessible via ref click
              className="hidden"
              id="file-upload"
              ref={fileInputRef}
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Select Files
            </Button>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Label htmlFor="auto-fill" className="text-sm">AI Auto-fill metadata</Label>
              <Switch
                id="auto-fill"
                checked={enableAutoFill && hasValidApiKey('openai')}
                onCheckedChange={setEnableAutoFill}
                disabled={!hasValidApiKey('openai')}
              />
              {!hasValidApiKey('openai') && (
                <span className="text-xs text-gray-500">Requires OpenAI API key</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Processing Settings */}
      {files.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Batch Processing Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Analysis Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="enable-analysis">Enable AI Analysis</Label>
                <p className="text-sm text-gray-500">
                  Automatically analyze papers with selected AI models after upload
                </p>
              </div>
              <Switch
                id="enable-analysis"
                checked={enableBatchAnalysis}
                onCheckedChange={setEnableBatchAnalysis}
                disabled={isUploading}
              />
            </div>

            {/* AI Model Selection */}
            {enableBatchAnalysis && (
              <div className="space-y-2">
                <Label>AI Models for Analysis</Label>
                <AIModelSelector
                  availableModels={['openai', 'anthropic', 'xai', 'gemini']}
                  selectedModels={selectedModels}
                  onSelectionChange={setSelectedModels}
                  apiKeys={apiKeys}
                  disabled={isUploading}
                />
              </div>
            )}

            {/* Retry Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max-retries">Max Retries</Label>
                <Input
                  id="max-retries"
                  type="number"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                  disabled={isUploading}
                />
              </div>
              <div>
                <Label htmlFor="retry-delay">Retry Delay (seconds)</Label>
                <Input
                  id="retry-delay"
                  type="number"
                  min="1"
                  max="60"
                  value={retryDelay / 1000}
                  onChange={(e) => setRetryDelay((parseInt(e.target.value) || 1) * 1000)}
                  disabled={isUploading}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Progress */}
      {batchState.isRunning && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Batch Processing Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>
                Processing file {batchState.currentFileIndex + 1} of {batchState.totalFiles}
              </span>
              <span>
                {batchState.completedFiles} completed, {batchState.failedFiles} failed
              </span>
            </div>
            <Progress 
              value={(batchState.completedFiles / batchState.totalFiles) * 100} 
              className="h-3"
            />
            
            {batchState.estimatedTimeRemaining && (
              <p className="text-sm text-gray-500">
                Estimated time remaining: {Math.floor(batchState.estimatedTimeRemaining / 60)}m {batchState.estimatedTimeRemaining % 60}s
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                disabled={!batchState.isRunning}
              >
                {batchState.isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={cancelBatch}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      {files.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Files to Upload ({files.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFiles}
                disabled={isUploading}
              >
                Clear All
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || files.every(f => f.isUploaded)}
                className="min-w-[120px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Batch Upload
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file, index) => (
              <FileMetadataForm
                key={file.id}
                file={file}
                index={index}
                isCurrentFile={batchState.isRunning && batchState.currentFileIndex === index}
                onUpdate={(updates) => updateFileMetadata(file.id, updates)}
                onRemove={() => removeFile(file.id)}
                onAddAuthor={(author) => addAuthor(file.id, author)}
                onRemoveAuthor={(index) => removeAuthor(file.id, index)}
                onRetry={() => retryFile(file.id)}
                disabled={isUploading}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// File metadata form component
interface FileMetadataFormProps {
  file: FileWithMetadata;
  index: number;
  isCurrentFile: boolean;
  onUpdate: (updates: Partial<PaperUploadData>) => void;
  onRemove: () => void;
  onAddAuthor: (author: string) => void;
  onRemoveAuthor: (index: number) => void;
  onRetry: () => void;
  disabled: boolean;
}

function FileMetadataForm({
  file,
  index,
  isCurrentFile,
  onUpdate,
  onRemove,
  onAddAuthor,
  onRemoveAuthor,
  onRetry,
  disabled
}: FileMetadataFormProps) {
  const [newAuthor, setNewAuthor] = useState('');

  const handleAddAuthor = () => {
    if (newAuthor.trim()) {
      onAddAuthor(newAuthor);
      setNewAuthor('');
    }
  };

  const getStatusIcon = () => {
    if (file.isUploaded && file.isAnalyzed) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (file.isUploaded && file.analysisProgress?.stage === 'analyzing') {
      return <Brain className="h-5 w-5 animate-pulse text-purple-500" />;
    }
    if (file.isUploaded) {
      return <CheckCircle className="h-5 w-5 text-blue-500" />;
    }
    if (file.error) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    if (file.uploadProgress || isCurrentFile) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (file.isUploaded && file.isAnalyzed) {
      return 'Upload & Analysis Complete';
    }
    if (file.isUploaded && file.analysisProgress?.stage === 'analyzing') {
      return 'Analyzing...';
    }
    if (file.isUploaded) {
      return 'Upload Complete';
    }
    if (file.error) {
      return `Failed${file.retryCount ? ` (${file.retryCount} retries)` : ''}`;
    }
    if (isCurrentFile) {
      return 'Processing...';
    }
    return 'Pending';
  };

  return (
    <Card className={`${
      file.isUploaded && file.isAnalyzed 
        ? 'bg-green-50 border-green-200' 
        : file.isUploaded 
        ? 'bg-blue-50 border-blue-200'
        : isCurrentFile
        ? 'bg-yellow-50 border-yellow-200'
        : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{file.file.name}</h4>
                <Badge variant="outline" className="text-xs">
                  #{index + 1}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{(file.file.size / 1024 / 1024).toFixed(2)} MB</span>
                <span>{getStatusText()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file.error && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={disabled}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upload Progress */}
        {file.uploadProgress && (
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span>{file.uploadProgress.message}</span>
              <span>{file.uploadProgress.progress}%</span>
            </div>
            <Progress value={file.uploadProgress.progress} className="h-2" />
          </div>
        )}

        {/* Analysis Progress */}
        {file.analysisProgress && file.analysisProgress.stage !== 'pending' && (
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                {file.analysisProgress.message}
              </span>
              <span>{file.analysisProgress.progress}%</span>
            </div>
            <Progress 
              value={file.analysisProgress.progress} 
              className="h-2"
            />
            
            {/* Model Status */}
            {(file.analysisProgress.completedModels.length > 0 || file.analysisProgress.failedModels.length > 0) && (
              <div className="flex gap-2 mt-2">
                {file.analysisProgress.completedModels.map(model => (
                  <Badge key={model} variant="default" className="text-xs bg-green-100 text-green-800">
                    {model} ✓
                  </Badge>
                ))}
                {file.analysisProgress.failedModels.map(model => (
                  <Badge key={model} variant="destructive" className="text-xs">
                    {model} ✗
                  </Badge>
                ))}
                {file.analysisProgress.currentModel && (
                  <Badge variant="outline" className="text-xs">
                    {file.analysisProgress.currentModel} ...
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {file.error && (
          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {file.error}
              {file.retryCount && file.retryCount > 0 && (
                <span className="block text-xs mt-1">
                  Attempted {file.retryCount} retries
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      {!file.isUploaded && (
        <CardContent className="space-y-4">
          {file.metadataFilling && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Auto-filling metadata with AI...
            </div>
          )}
          {!file.metadataFilling && file.metadataAutoFilled && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 inline-block">
              Metadata auto-filled by AI
            </div>
          )}

          {!file.metadataFilling && (
            <>
            {/* Title */}
            <div>
            <Label htmlFor={`title-${file.id}`}>Title</Label>
            <Input
              id={`title-${file.id}`}
              value={file.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              disabled={disabled}
              placeholder="Paper title"
            />
          </div>

          {/* Authors */}
          <div>
            <Label>Authors</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Add author"
                disabled={disabled}
                onKeyPress={(e) => e.key === 'Enter' && handleAddAuthor()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAuthor}
                disabled={disabled || !newAuthor.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {file.authors.map((author, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {author}
                  <button
                    onClick={() => onRemoveAuthor(index)}
                    disabled={disabled}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Journal and Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`journal-${file.id}`}>Journal</Label>
              <Input
                id={`journal-${file.id}`}
                value={file.journal}
                onChange={(e) => onUpdate({ journal: e.target.value })}
                disabled={disabled}
                placeholder="Journal name"
              />
            </div>
            <div>
              <Label htmlFor={`year-${file.id}`}>Publication Year</Label>
              <Input
                id={`year-${file.id}`}
                type="number"
                value={file.publicationYear}
                onChange={(e) => onUpdate({ publicationYear: parseInt(e.target.value) || undefined })}
                disabled={disabled}
                placeholder="2024"
              />
            </div>
          </div>

          {/* DOI */}
          <div>
            <Label htmlFor={`doi-${file.id}`}>DOI</Label>
            <Input
              id={`doi-${file.id}`}
              value={file.doi}
              onChange={(e) => onUpdate({ doi: e.target.value })}
              disabled={disabled}
              placeholder="10.1000/182"
            />
          </div>

          {/* Abstract */}
          <div>
            <Label htmlFor={`abstract-${file.id}`}>Abstract</Label>
            <Textarea
              id={`abstract-${file.id}`}
              value={file.abstract}
              onChange={(e) => onUpdate({ abstract: e.target.value })}
              disabled={disabled}
              placeholder="Paper abstract..."
              rows={3}
            />
          </div>
          </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Export with error boundary
export const PaperUpload = withErrorBoundary(PaperUploadComponent, 
  <div className="p-8 text-center">
    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
    <h3 className="text-lg font-semibold mb-2">Upload Error</h3>
    <p className="text-muted-foreground">
      There was an error with the paper upload component. Please refresh the page and try again.
    </p>
  </div>
);
