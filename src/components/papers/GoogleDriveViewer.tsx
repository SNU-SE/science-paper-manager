'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  FileText,
  Eye,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { DriveFile } from '@/lib/google-drive';

interface GoogleDriveViewerProps {
  fileId: string;
  fileName?: string;
  webViewLink?: string;
  webContentLink?: string;
  className?: string;
  height?: string;
  showControls?: boolean;
  showFileInfo?: boolean;
  onError?: (error: string) => void;
}

export function GoogleDriveViewer({
  fileId,
  fileName,
  webViewLink,
  webContentLink,
  className,
  height = '600px',
  showControls = true,
  showFileInfo = true,
  onError
}: GoogleDriveViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fileInfo, setFileInfo] = useState<DriveFile | null>(null);
  const [viewMode, setViewMode] = useState<'embedded' | 'preview'>('embedded');

  // Generate Google Drive embed URL
  const getEmbedUrl = (mode: 'embedded' | 'preview' = 'embedded') => {
    if (!fileId) return '';
    
    if (mode === 'preview') {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    return `https://drive.google.com/file/d/${fileId}/preview?usp=embed_googleplus`;
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    const errorMsg = 'Failed to load PDF from Google Drive';
    setError(errorMsg);
    onError?.(errorMsg);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Refresh viewer
  const refreshViewer = () => {
    setIsLoading(true);
    setError(null);
    // Force iframe reload by changing key
    const iframe = document.getElementById(`drive-viewer-${fileId}`) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  // Open in new tab
  const openInNewTab = () => {
    if (webViewLink) {
      window.open(webViewLink, '_blank');
    } else {
      window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
    }
  };

  // Download file
  const downloadFile = () => {
    if (webContentLink) {
      window.open(webContentLink, '_blank');
    } else {
      window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, '_blank');
    }
  };

  // Switch view mode
  const switchViewMode = (mode: 'embedded' | 'preview') => {
    setViewMode(mode);
    setIsLoading(true);
    setError(null);
  };

  useEffect(() => {
    // Reset loading state when fileId changes
    setIsLoading(true);
    setError(null);
  }, [fileId]);

  if (!fileId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No file ID provided for Google Drive viewer
        </AlertDescription>
      </Alert>
    );
  }

  const containerClasses = isFullscreen 
    ? 'fixed inset-0 z-50 bg-white' 
    : className;

  const viewerHeight = isFullscreen ? '100vh' : height;

  return (
    <div className={containerClasses}>
      <Card className="h-full flex flex-col">
        {/* Header with controls */}
        {showControls && (
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {fileName || 'PDF Viewer'}
              </CardTitle>
              
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex rounded-md border">
                  <Button
                    variant={viewMode === 'embedded' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => switchViewMode('embedded')}
                    className="rounded-r-none"
                  >
                    Embedded
                  </Button>
                  <Button
                    variant={viewMode === 'preview' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => switchViewMode('preview')}
                    className="rounded-l-none"
                  >
                    Preview
                  </Button>
                </div>

                {/* Action Buttons */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshViewer}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadFile}
                >
                  <Download className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* File Info */}
            {showFileInfo && fileInfo && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <Badge variant="secondary">
                  {fileInfo.mimeType}
                </Badge>
                {fileInfo.size && (
                  <span>
                    {(parseInt(fileInfo.size) / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
                <span>
                  Modified: {new Date(fileInfo.modifiedTime).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardHeader>
        )}

        {/* Viewer Content */}
        <CardContent className="flex-1 p-0">
          <div className="relative h-full" style={{ height: viewerHeight }}>
            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">Loading PDF...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <Alert className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshViewer}
                      >
                        Try Again
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openInNewTab}
                      >
                        Open in Drive
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* PDF Iframe */}
            <iframe
              id={`drive-viewer-${fileId}`}
              src={getEmbedUrl(viewMode)}
              className={`w-full h-full border-0 ${isLoading || error ? 'invisible' : 'visible'}`}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={fileName || 'PDF Viewer'}
              allow="autoplay"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simplified viewer for inline use
export function InlineGoogleDriveViewer({
  fileId,
  fileName,
  height = '400px',
  className
}: {
  fileId: string;
  fileName?: string;
  height?: string;
  className?: string;
}) {
  return (
    <GoogleDriveViewer
      fileId={fileId}
      fileName={fileName}
      height={height}
      className={className}
      showControls={false}
      showFileInfo={false}
    />
  );
}

// Full-featured viewer with all controls
export function FullGoogleDriveViewer({
  fileId,
  fileName,
  webViewLink,
  webContentLink,
  height = '800px',
  className,
  onError
}: GoogleDriveViewerProps) {
  return (
    <GoogleDriveViewer
      fileId={fileId}
      fileName={fileName}
      webViewLink={webViewLink}
      webContentLink={webContentLink}
      height={height}
      className={className}
      showControls={true}
      showFileInfo={true}
      onError={onError}
    />
  );
}