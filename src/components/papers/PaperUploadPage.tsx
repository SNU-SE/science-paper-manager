'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  BarChart3, 
  Settings, 
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { PaperUpload } from './PaperUpload';
import { GoogleDriveViewer } from './GoogleDriveViewer';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserGoogleDriveServiceClient } from '@/services/google-drive/UserGoogleDriveService.client'
import { useGoogleDriveUpload } from '@/hooks/useGoogleDriveUpload';
import { PaperUploadService } from '@/services/upload/PaperUploadService';
import { Paper } from '@/types';

interface PaperUploadPageProps {
  onPapersUploaded?: (papers: Partial<Paper>[]) => void;
}

export function PaperUploadPage({ onPapersUploaded }: PaperUploadPageProps) {
  const [uploadedPapers, setUploadedPapers] = useState<Partial<Paper>[]>([]);
  const [uploadStats, setUploadStats] = useState<{
    totalFiles: number;
    totalSize: string;
    recentUploads: number;
  } | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Partial<Paper> | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const { user } = useAuth();

  const {
    isUploading,
    uploadProgress,
    error,
    getUploadStats,
    getAuthUrl,
    clearError
  } = useGoogleDriveUpload();

  // Mock upload service for demo (in real app, this would be properly configured)
  const uploadService = new PaperUploadService({
    googleDrive: {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || '',
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || ''
    }
  });

  useEffect(() => {
    // Check per-user Google Drive configuration via test-connection
    const checkConfiguration = async () => {
      try {
        if (!user?.id) {
          setIsConfigured(false);
          return;
        }
        const client = new UserGoogleDriveServiceClient();
        const ok = await client.testConnection(user.id);
        setIsConfigured(ok);
      } catch {
        setIsConfigured(false);
      }
    };

    checkConfiguration();
    loadUploadStats();
  }, [user?.id]);

  const loadUploadStats = async () => {
    try {
      const stats = await getUploadStats();
      setUploadStats(stats);
    } catch (error) {
      console.error('Failed to load upload stats:', error);
    }
  };

  const handleUploadComplete = (papers: Partial<Paper>[]) => {
    setUploadedPapers(prev => [...prev, ...papers]);
    onPapersUploaded?.(papers);
    loadUploadStats(); // Refresh stats
  };

  const handleUploadError = (errorMessage: string) => {
    console.error('Upload error:', errorMessage);
  };

  const handleAuthSetup = async () => {
    try {
      const authUrl = await getAuthUrl();
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    }
  };

  if (!isConfigured) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Google Drive Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Google Drive integration is not configured. Please set up the following environment variables:
                <ul className="mt-2 ml-4 list-disc">
                  <li>NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID</li>
                  <li>GOOGLE_DRIVE_CLIENT_SECRET</li>
                  <li>GOOGLE_DRIVE_REDIRECT_URI</li>
                  <li>GOOGLE_DRIVE_REFRESH_TOKEN</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="mt-4">
              <Button onClick={handleAuthSetup} className="mr-2">
                <ExternalLink className="h-4 w-4 mr-2" />
                Set up Google Drive Access
              </Button>
              <Button variant="outline" asChild>
                <a 
                  href="https://console.developers.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Paper Upload</h1>
        <p className="text-gray-600">
          Upload PDF papers to Google Drive with automatic organization and metadata management.
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="recent" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Recent ({uploadedPapers.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="viewer" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Viewer
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload">
          {error && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearError}
                  className="ml-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <PaperUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            uploadService={uploadService}
          />
        </TabsContent>

        {/* Recent Uploads Tab */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recently Uploaded Papers</CardTitle>
            </CardHeader>
            <CardContent>
              {uploadedPapers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No papers uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {uploadedPapers.map((paper, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium mb-2">{paper.title}</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {paper.authors?.map((author, i) => (
                                <Badge key={i} variant="secondary">
                                  {author}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              {paper.journal && (
                                <p><strong>Journal:</strong> {paper.journal}</p>
                              )}
                              {paper.publicationYear && (
                                <p><strong>Year:</strong> {paper.publicationYear}</p>
                              )}
                              {paper.doi && (
                                <p><strong>DOI:</strong> {paper.doi}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPaper(paper)}
                            >
                              View PDF
                            </Button>
                            {paper.googleDriveUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <a 
                                  href={paper.googleDriveUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {uploadStats?.totalFiles || 0}
                </div>
                <p className="text-xs text-gray-600">PDF files in Drive</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {uploadStats?.totalSize || '0 B'}
                </div>
                <p className="text-xs text-gray-600">Storage used</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {uploadStats?.recentUploads || 0}
                </div>
                <p className="text-xs text-gray-600">Last 7 days</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Upload Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload activity chart would go here</p>
                <p className="text-sm">Feature coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDF Viewer Tab */}
        <TabsContent value="viewer">
          <Card>
            <CardHeader>
              <CardTitle>PDF Viewer</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedPaper && selectedPaper.googleDriveId ? (
                <GoogleDriveViewer
                  fileId={selectedPaper.googleDriveId}
                  fileName={selectedPaper.title}
                  webViewLink={selectedPaper.googleDriveUrl}
                  height="700px"
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No PDF selected</p>
                  <p>Upload a paper or select one from the Recent tab to view it here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
