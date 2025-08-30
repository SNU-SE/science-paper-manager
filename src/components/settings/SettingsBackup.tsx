'use client'

import React, { useState, useMemo, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Upload, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  FileText,
  Lock,
  Unlock
} from 'lucide-react'
import { SettingsBackupService } from '@/services/settings/SettingsBackupService'
import { ExportOptions, RestoreOptions, RestoreResult, BackupMetadata } from '@/lib/database'
import { toast } from 'sonner'

interface SettingsBackupProps {
  userId: string
  onSuccess?: (message: string) => void
  onError?: (error: Error) => void
}

interface BackupPreview {
  metadata: BackupMetadata
  preview: {
    aiModels: number
    apiKeys: number
    googleDrive: boolean
    zotero: boolean
  }
  warnings: string[]
}

const SettingsBackup = memo(({ userId, onSuccess, onError }: SettingsBackupProps) => {
  const backupService = useMemo(() => new SettingsBackupService(), [])
  
  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeApiKeys: false, // Default to false for security
    includeGoogleDrive: true,
    includeZotero: true,
    includeAiModels: true,
    encryptData: true
  })
  const [exportPassword, setExportPassword] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    overwriteExisting: false,
    selectiveRestore: {
      aiModels: true,
      apiKeys: false, // Cannot restore API keys
      googleDrive: true,
      zotero: true
    },
    validateBeforeRestore: true
  })
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  // Memoized callback functions
  const handleExport = useCallback(async () => {
    if (exportOptions.encryptData && !exportPassword.trim()) {
      toast.error('Please enter a password for encryption')
      return
    }

    setIsExporting(true)
    try {
      const backupData = await backupService.exportSettings(userId, {
        ...exportOptions,
        password: exportOptions.encryptData ? exportPassword : undefined
      })

      // Create and download file
      const filename = backupService.generateBackupFilename(userId, exportOptions.encryptData)
      const blob = new Blob([backupData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Settings exported successfully')
      onSuccess?.('Settings backup created and downloaded')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed'
      toast.error(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsExporting(false)
    }
  }, [userId, exportOptions, exportPassword, backupService, onSuccess, onError])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setBackupPreview(null)
    setRestoreResult(null)

    // Try to preview the file
    try {
      const fileContent = await file.text()
      const preview = await backupService.previewRestore(fileContent, importPassword || undefined)
      setBackupPreview(preview)
    } catch (error) {
      // If preview fails, it might need a password
      // Preview failed, might need password
    }
  }, [backupService, importPassword])

  /**
   * Preview backup file with password
   */
  const handlePreview = async () => {
    if (!importFile) return

    try {
      const fileContent = await importFile.text()
      const preview = await backupService.previewRestore(fileContent, importPassword || undefined)
      setBackupPreview(preview)
      toast.success('Backup file loaded successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preview backup'
      toast.error(errorMessage)
      setBackupPreview(null)
    }
  }

  /**
   * Handle settings import
   */
  const handleImport = async () => {
    if (!importFile || !backupPreview) {
      toast.error('Please select and preview a backup file first')
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    setRestoreResult(null)

    try {
      const fileContent = await importFile.text()
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const result = await backupService.importSettings(userId, fileContent, {
        ...restoreOptions,
        password: importPassword || undefined
      })

      clearInterval(progressInterval)
      setImportProgress(100)
      setRestoreResult(result)

      if (result.success) {
        toast.success('Settings restored successfully')
        onSuccess?.('Settings have been restored from backup')
      } else {
        toast.error('Some settings could not be restored')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed'
      toast.error(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Backup & Restore</h3>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Settings
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Your Settings
              </CardTitle>
              <CardDescription>
                Create a backup of your settings that can be imported later or on another device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Export Options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">What to include:</Label>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-ai-models">AI Model Preferences</Label>
                    <p className="text-xs text-muted-foreground">Your preferred AI models and parameters</p>
                  </div>
                  <Switch
                    id="include-ai-models"
                    checked={exportOptions.includeAiModels}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeAiModels: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-api-keys">API Key References</Label>
                    <p className="text-xs text-muted-foreground">
                      Only references (actual keys are never exported for security)
                    </p>
                  </div>
                  <Switch
                    id="include-api-keys"
                    checked={exportOptions.includeApiKeys}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeApiKeys: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-google-drive">Google Drive Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      Configuration (credentials are never exported for security)
                    </p>
                  </div>
                  <Switch
                    id="include-google-drive"
                    checked={exportOptions.includeGoogleDrive}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeGoogleDrive: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-zotero">Zotero Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      Configuration (API key is never exported for security)
                    </p>
                  </div>
                  <Switch
                    id="include-zotero"
                    checked={exportOptions.includeZotero}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeZotero: checked }))
                    }
                  />
                </div>
              </div>

              {/* Encryption Options */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="encrypt-data" className="flex items-center gap-2">
                      {exportOptions.encryptData ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      Encrypt Backup File
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Recommended for additional security
                    </p>
                  </div>
                  <Switch
                    id="encrypt-data"
                    checked={exportOptions.encryptData}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, encryptData: checked }))
                    }
                  />
                </div>

                {exportOptions.encryptData && (
                  <div className="space-y-2">
                    <Label htmlFor="export-password">Encryption Password</Label>
                    <Input
                      id="export-password"
                      type="password"
                      placeholder="Enter a strong password"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Remember this password - you'll need it to restore the backup
                    </p>
                  </div>
                )}
              </div>

              {/* Security Notice */}
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  For security reasons, sensitive data like API keys and credentials are never included in backups. 
                  You'll need to re-enter these after restoring.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleExport} 
                disabled={isExporting}
                className="w-full"
              >
                {isExporting ? (
                  <>Creating Backup...</>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Settings
              </CardTitle>
              <CardDescription>
                Restore your settings from a previously exported backup file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Selection */}
              <div className="space-y-2">
                <Label htmlFor="backup-file">Select Backup File</Label>
                <Input
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Password for encrypted files */}
              {importFile && (
                <div className="space-y-2">
                  <Label htmlFor="import-password">Password (if encrypted)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="import-password"
                      type="password"
                      placeholder="Enter backup password"
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                    />
                    <Button onClick={handlePreview} variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              )}

              {/* Backup Preview */}
              {backupPreview && (
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Backup Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Created:</span>
                        <p className="text-muted-foreground">
                          {new Date(backupPreview.metadata.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Version:</span>
                        <p className="text-muted-foreground">{backupPreview.metadata.version}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-medium text-sm">Contents:</span>
                      <div className="flex flex-wrap gap-2">
                        {backupPreview.preview.aiModels > 0 && (
                          <Badge variant="secondary">
                            {backupPreview.preview.aiModels} AI Models
                          </Badge>
                        )}
                        {backupPreview.preview.apiKeys > 0 && (
                          <Badge variant="secondary">
                            {backupPreview.preview.apiKeys} API Key References
                          </Badge>
                        )}
                        {backupPreview.preview.googleDrive && (
                          <Badge variant="secondary">Google Drive Config</Badge>
                        )}
                        {backupPreview.preview.zotero && (
                          <Badge variant="secondary">Zotero Config</Badge>
                        )}
                      </div>
                    </div>

                    {backupPreview.warnings.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium text-sm">Warnings:</span>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {backupPreview.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Restore Options */}
              {backupPreview && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Restore Options:</Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="overwrite-existing">Overwrite Existing Settings</Label>
                      <p className="text-xs text-muted-foreground">
                        Replace current settings with backup data
                      </p>
                    </div>
                    <Switch
                      id="overwrite-existing"
                      checked={restoreOptions.overwriteExisting}
                      onCheckedChange={(checked) => 
                        setRestoreOptions(prev => ({ ...prev, overwriteExisting: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Select what to restore:</Label>
                    
                    {backupPreview.preview.aiModels > 0 && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="restore-ai-models">AI Model Preferences</Label>
                        <Switch
                          id="restore-ai-models"
                          checked={restoreOptions.selectiveRestore.aiModels}
                          onCheckedChange={(checked) => 
                            setRestoreOptions(prev => ({ 
                              ...prev, 
                              selectiveRestore: { ...prev.selectiveRestore, aiModels: checked }
                            }))
                          }
                        />
                      </div>
                    )}

                    {backupPreview.preview.googleDrive && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="restore-google-drive">Google Drive Settings</Label>
                        <Switch
                          id="restore-google-drive"
                          checked={restoreOptions.selectiveRestore.googleDrive}
                          onCheckedChange={(checked) => 
                            setRestoreOptions(prev => ({ 
                              ...prev, 
                              selectiveRestore: { ...prev.selectiveRestore, googleDrive: checked }
                            }))
                          }
                        />
                      </div>
                    )}

                    {backupPreview.preview.zotero && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="restore-zotero">Zotero Settings</Label>
                        <Switch
                          id="restore-zotero"
                          checked={restoreOptions.selectiveRestore.zotero}
                          onCheckedChange={(checked) => 
                            setRestoreOptions(prev => ({ 
                              ...prev, 
                              selectiveRestore: { ...prev.selectiveRestore, zotero: checked }
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Restoring settings...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {/* Restore Result */}
              {restoreResult && (
                <Card className={restoreResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      {restoreResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        {restoreResult.success ? 'Restore Completed' : 'Restore Failed'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Restored:</span>
                        <ul className="ml-4 mt-1 space-y-1">
                          <li>• AI Models: {restoreResult.restored.aiModels}</li>
                          <li>• Google Drive: {restoreResult.restored.googleDrive ? 'Yes' : 'No'}</li>
                          <li>• Zotero: {restoreResult.restored.zotero ? 'Yes' : 'No'}</li>
                        </ul>
                      </div>

                      {restoreResult.warnings.length > 0 && (
                        <div>
                          <span className="font-medium text-amber-600">Warnings:</span>
                          <ul className="ml-4 mt-1 space-y-1 text-amber-700">
                            {restoreResult.warnings.map((warning, index) => (
                              <li key={index}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {restoreResult.errors.length > 0 && (
                        <div>
                          <span className="font-medium text-red-600">Errors:</span>
                          <ul className="ml-4 mt-1 space-y-1 text-red-700">
                            {restoreResult.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button 
                onClick={handleImport} 
                disabled={!backupPreview || isImporting}
                className="w-full"
              >
                {isImporting ? (
                  <>Restoring Settings...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Restore Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
})

SettingsBackup.displayName = 'SettingsBackup'

export { SettingsBackup }