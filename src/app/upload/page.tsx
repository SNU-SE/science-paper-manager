'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PaperUpload } from '@/components/papers/PaperUpload'
import { PaperUploadService } from '@/services/upload/PaperUploadService'
import { Paper } from '@/types'
import { toast } from 'sonner'

export default function UploadPage() {
  
  const uploadService = new PaperUploadService()

  const handleUploadComplete = (papers: Partial<Paper>[]) => {
    toast.success(`Successfully uploaded ${papers.length} paper(s)!`)
    // Uploaded papers
    // Optionally redirect to papers page
    // router.push('/papers')
  }

  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
    // Upload error
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Upload Papers</h1>
            <p className="text-gray-600">
              Upload PDF files and automatically organize them with AI-powered analysis
            </p>
          </div>

          <PaperUpload
            uploadService={uploadService}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            className="max-w-4xl"
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}