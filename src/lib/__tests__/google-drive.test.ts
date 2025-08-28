import { GoogleDriveService } from '../google-drive';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token'
          }
        }),
        setCredentials: jest.fn()
      }))
    },
    drive: jest.fn().mockReturnValue({
      files: {
        list: jest.fn(),
        create: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      }
    })
  }
}));

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  const mockConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    redirectUri: 'http://localhost:3000/callback',
    refreshToken: 'test_refresh_token'
  };

  beforeEach(() => {
    service = new GoogleDriveService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth2 authorization URL', () => {
      const authUrl = service.getAuthUrl();
      expect(authUrl).toBe('https://accounts.google.com/oauth/authorize');
    });
  });

  describe('getTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const tokens = await service.getTokens('test_code');
      
      expect(tokens).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token'
      });
    });
  });

  describe('createFolderStructure', () => {
    it('should create folder structure for paper organization', async () => {
      const mockDrive = {
        files: {
          list: jest.fn()
            .mockResolvedValueOnce({ data: { files: [] } }) // Year folder not found
            .mockResolvedValueOnce({ data: { files: [] } }) // Journal folder not found
            .mockResolvedValueOnce({ data: { files: [] } }), // Paper folder not found
          create: jest.fn()
            .mockResolvedValueOnce({ data: { id: 'year_folder_id' } })
            .mockResolvedValueOnce({ data: { id: 'journal_folder_id' } })
            .mockResolvedValueOnce({ data: { id: 'paper_folder_id' } })
        }
      };

      // Mock the drive instance
      (service as any).drive = mockDrive;

      const folderId = await service.createFolderStructure(
        '2024',
        'Nature',
        'Test Paper Title'
      );

      expect(folderId).toBe('paper_folder_id');
      expect(mockDrive.files.create).toHaveBeenCalledTimes(3);
    });

    it('should use existing folders when they exist', async () => {
      const mockDrive = {
        files: {
          list: jest.fn()
            .mockResolvedValueOnce({ data: { files: [{ id: 'existing_year_id' }] } })
            .mockResolvedValueOnce({ data: { files: [{ id: 'existing_journal_id' }] } })
            .mockResolvedValueOnce({ data: { files: [{ id: 'existing_paper_id' }] } }),
          create: jest.fn()
        }
      };

      (service as any).drive = mockDrive;

      const folderId = await service.createFolderStructure(
        '2024',
        'Nature',
        'Test Paper Title'
      );

      expect(folderId).toBe('existing_paper_id');
      expect(mockDrive.files.create).not.toHaveBeenCalled();
    });
  });

  describe('checkDuplicateFile', () => {
    it('should return null when no duplicate exists', async () => {
      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({ data: { files: [] } })
        }
      };

      (service as any).drive = mockDrive;

      const duplicate = await service.checkDuplicateFile('test.pdf', 'folder_id');
      
      expect(duplicate).toBeNull();
    });

    it('should return file info when duplicate exists', async () => {
      const mockFile = {
        id: 'duplicate_file_id',
        name: 'test.pdf',
        webViewLink: 'https://drive.google.com/view',
        webContentLink: 'https://drive.google.com/download'
      };

      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({ data: { files: [mockFile] } })
        }
      };

      (service as any).drive = mockDrive;

      const duplicate = await service.checkDuplicateFile('test.pdf', 'folder_id');
      
      expect(duplicate).toEqual(mockFile);
    });
  });

  describe('uploadPDF', () => {
    it('should upload PDF file successfully', async () => {
      const mockBuffer = Buffer.from('test pdf content');
      const mockUploadResponse = {
        data: {
          id: 'uploaded_file_id',
          name: 'test.pdf',
          webViewLink: 'https://drive.google.com/view',
          webContentLink: 'https://drive.google.com/download'
        }
      };

      const mockDrive = {
        files: {
          list: jest.fn()
            .mockResolvedValueOnce({ data: { files: [] } }) // Year folder
            .mockResolvedValueOnce({ data: { files: [] } }) // Journal folder
            .mockResolvedValueOnce({ data: { files: [] } }) // Paper folder
            .mockResolvedValueOnce({ data: { files: [] } }), // Duplicate check
          create: jest.fn()
            .mockResolvedValueOnce({ data: { id: 'year_id' } })
            .mockResolvedValueOnce({ data: { id: 'journal_id' } })
            .mockResolvedValueOnce({ data: { id: 'paper_id' } })
            .mockResolvedValueOnce(mockUploadResponse)
        }
      };

      (service as any).drive = mockDrive;

      const result = await service.uploadPDF(
        mockBuffer,
        'test.pdf',
        '2024',
        'Nature',
        'Test Paper'
      );

      expect(result).toEqual({
        fileId: 'uploaded_file_id',
        fileName: 'test.pdf',
        webViewLink: 'https://drive.google.com/view',
        webContentLink: 'https://drive.google.com/download',
        folderPath: '2024/Nature/Test Paper'
      });
    });

    it('should return existing file when duplicate is found', async () => {
      const mockBuffer = Buffer.from('test pdf content');
      const existingFile = {
        id: 'existing_file_id',
        name: 'test.pdf',
        webViewLink: 'https://drive.google.com/existing',
        webContentLink: 'https://drive.google.com/existing-download'
      };

      const mockDrive = {
        files: {
          list: jest.fn()
            .mockResolvedValueOnce({ data: { files: [] } }) // Year folder
            .mockResolvedValueOnce({ data: { files: [] } }) // Journal folder
            .mockResolvedValueOnce({ data: { files: [] } }) // Paper folder
            .mockResolvedValueOnce({ data: { files: [existingFile] } }), // Duplicate found
          create: jest.fn()
            .mockResolvedValueOnce({ data: { id: 'year_id' } })
            .mockResolvedValueOnce({ data: { id: 'journal_id' } })
            .mockResolvedValueOnce({ data: { id: 'paper_id' } })
        }
      };

      (service as any).drive = mockDrive;

      const result = await service.uploadPDF(
        mockBuffer,
        'test.pdf',
        '2024',
        'Nature',
        'Test Paper'
      );

      expect(result).toEqual({
        fileId: 'existing_file_id',
        fileName: 'test.pdf',
        webViewLink: 'https://drive.google.com/existing',
        webContentLink: 'https://drive.google.com/existing-download',
        folderPath: '2024/Nature/Test Paper'
      });
    });
  });

  describe('getFileInfo', () => {
    it('should retrieve file information', async () => {
      const mockFileInfo = {
        id: 'file_id',
        name: 'test.pdf',
        webViewLink: 'https://drive.google.com/view',
        mimeType: 'application/pdf',
        size: '1024000'
      };

      const mockDrive = {
        files: {
          get: jest.fn().mockResolvedValue({ data: mockFileInfo })
        }
      };

      (service as any).drive = mockDrive;

      const fileInfo = await service.getFileInfo('file_id');
      
      expect(fileInfo).toEqual(mockFileInfo);
      expect(mockDrive.files.get).toHaveBeenCalledWith({
        fileId: 'file_id',
        fields: 'id, name, webViewLink, webContentLink, parents, mimeType, size, createdTime, modifiedTime'
      });
    });
  });

  describe('listFiles', () => {
    it('should list files in a folder', async () => {
      const mockFiles = [
        { id: 'file1', name: 'paper1.pdf' },
        { id: 'file2', name: 'paper2.pdf' }
      ];

      const mockDrive = {
        files: {
          list: jest.fn().mockResolvedValue({ data: { files: mockFiles } })
        }
      };

      (service as any).drive = mockDrive;

      const files = await service.listFiles('folder_id', 'application/pdf');
      
      expect(files).toEqual(mockFiles);
      expect(mockDrive.files.list).toHaveBeenCalledWith({
        q: "trashed=false and 'folder_id' in parents and mimeType='application/pdf'",
        fields: 'files(id, name, webViewLink, webContentLink, parents, mimeType, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc'
      });
    });
  });

  describe('deleteFile', () => {
    it('should delete file from Google Drive', async () => {
      const mockDrive = {
        files: {
          delete: jest.fn().mockResolvedValue({})
        }
      };

      (service as any).drive = mockDrive;

      await service.deleteFile('file_id');
      
      expect(mockDrive.files.delete).toHaveBeenCalledWith({
        fileId: 'file_id'
      });
    });
  });
});