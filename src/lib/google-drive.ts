import { google, drive_v3, Auth } from 'googleapis';
import { Readable } from 'stream';

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  parents?: string[];
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  webContentLink: string;
  folderPath: string;
}

export class GoogleDriveService {
  private drive: drive_v3.Drive;
  private auth: Auth.OAuth2Client;

  constructor(config: GoogleDriveConfig) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.refreshToken) {
      this.auth.setCredentials({
        refresh_token: config.refreshToken
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly'
    ];

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<any> {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    return tokens;
  }

  /**
   * Set refresh token for authentication
   */
  setRefreshToken(refreshToken: string): void {
    this.auth.setCredentials({
      refresh_token: refreshToken
    });
  }

  /**
   * Create folder structure: 연도/저널/논문명
   */
  async createFolderStructure(
    year: string,
    journal: string,
    paperTitle: string,
    parentFolderId?: string
  ): Promise<string> {
    try {
      // Create or find year folder
      const yearFolderId = await this.createOrFindFolder(year, parentFolderId);
      
      // Create or find journal folder
      const journalFolderId = await this.createOrFindFolder(journal, yearFolderId);
      
      // Create or find paper folder
      const paperFolderId = await this.createOrFindFolder(paperTitle, journalFolderId);
      
      return paperFolderId;
    } catch (error) {
      console.error('Error creating folder structure:', error);
      throw new Error(`Failed to create folder structure: ${error}`);
    }
  }

  /**
   * Create folder or find existing one
   */
  private async createOrFindFolder(name: string, parentId?: string): Promise<string> {
    try {
      // Search for existing folder
      const query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchQuery = parentId ? `${query} and '${parentId}' in parents` : query;
      
      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'files(id, name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create new folder if not found
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return folder.data.id;
    } catch (error) {
      console.error(`Error creating/finding folder ${name}:`, error);
      throw error;
    }
  }

  /**
   * Check if file already exists in the specified folder
   */
  async checkDuplicateFile(fileName: string, folderId: string): Promise<DriveFile | null> {
    try {
      const query = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink, webContentLink, mimeType, size, createdTime, modifiedTime)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0] as DriveFile;
      }

      return null;
    } catch (error) {
      console.error('Error checking for duplicate file:', error);
      throw error;
    }
  }

  /**
   * Upload PDF file to Google Drive
   */
  async uploadPDF(
    fileBuffer: Buffer,
    fileName: string,
    year: string,
    journal: string,
    paperTitle: string,
    parentFolderId?: string
  ): Promise<UploadResult> {
    try {
      // Create folder structure
      const folderId = await this.createFolderStructure(year, journal, paperTitle, parentFolderId);
      
      // Check for duplicates
      const existingFile = await this.checkDuplicateFile(fileName, folderId);
      if (existingFile) {
        return {
          fileId: existingFile.id,
          fileName: existingFile.name,
          webViewLink: existingFile.webViewLink,
          webContentLink: existingFile.webContentLink,
          folderPath: `${year}/${journal}/${paperTitle}`
        };
      }

      // Upload file
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'application/pdf',
        body: Readable.from(fileBuffer)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      return {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        folderPath: `${year}/${journal}/${paperTitle}`
      };
    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw new Error(`Failed to upload PDF: ${error}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(fileId: string): Promise<DriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, webViewLink, webContentLink, parents, mimeType, size, createdTime, modifiedTime'
      });

      return response.data as DriveFile;
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: fileId
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folderId?: string, mimeType?: string): Promise<DriveFile[]> {
    try {
      let query = 'trashed=false';
      
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }
      
      if (mimeType) {
        query += ` and mimeType='${mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink, webContentLink, parents, mimeType, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }
}