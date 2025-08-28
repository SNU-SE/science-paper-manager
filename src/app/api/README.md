# Science Paper Manager API Documentation

This document provides an overview of all available API endpoints in the Science Paper Manager application.

## Authentication Endpoints

### POST /api/auth/login
Authenticate user with hardcoded credentials.

**Request Body:**
```json
{
  "email": "admin@email.com",
  "password": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "admin@email.com",
    "role": "admin"
  },
  "token": "session_token"
}
```

### POST /api/auth/logout
Logout user and clear session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/session
Check current session status.

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "email": "admin@email.com",
    "role": "admin"
  }
}
```

## Paper Management Endpoints

### GET /api/papers
Get all papers or a specific paper by ID.

**Query Parameters:**
- `id` (optional): Paper ID to fetch specific paper

**Response:**
```json
[
  {
    "id": "1",
    "title": "Paper Title",
    "authors": ["Author 1", "Author 2"],
    "journal": "Journal Name",
    "publicationYear": 2024,
    "doi": "10.1000/example",
    "abstract": "Paper abstract...",
    "readingStatus": "unread",
    "dateAdded": "2024-01-01T00:00:00.000Z",
    "lastModified": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/papers
Create a new paper.

**Request Body:**
```json
{
  "title": "Paper Title",
  "authors": ["Author 1"],
  "journal": "Journal Name",
  "publicationYear": 2024,
  "abstract": "Abstract text...",
  "readingStatus": "unread"
}
```

### PUT /api/papers
Update an existing paper.

**Request Body:**
```json
{
  "id": "paper_id",
  "title": "Updated Title",
  "readingStatus": "reading"
}
```

### DELETE /api/papers?id={paperId}
Delete a paper by ID.

**Response:**
```json
{
  "success": true,
  "message": "Paper deleted successfully"
}
```

## AI Analysis Endpoints

### GET /api/ai-analysis
Get all AI analysis results.

**Response:**
```json
[
  {
    "id": "1",
    "paperId": "1",
    "modelProvider": "openai",
    "modelName": "gpt-4",
    "summary": "Analysis summary...",
    "keywords": ["keyword1", "keyword2"],
    "confidenceScore": 0.95,
    "tokensUsed": 1500,
    "processingTimeMs": 2500,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /api/ai-analysis
Store AI analysis result.

**Request Body:**
```json
{
  "id": "analysis_id",
  "paperId": "paper_id",
  "modelProvider": "openai",
  "summary": "Analysis summary...",
  "keywords": ["keyword1", "keyword2"]
}
```

### GET /api/ai-analysis/[paperId]
Get all AI analyses for a specific paper.

**Response:**
```json
{
  "paperId": "1",
  "analyses": {
    "openai": { /* analysis result */ },
    "anthropic": { /* analysis result */ }
  },
  "totalAnalyses": 2
}
```

### POST /api/ai-analysis/[paperId]
Start AI analysis for a paper with multiple models.

**Request Body:**
```json
{
  "modelProviders": ["openai", "anthropic"],
  "apiKeys": {
    "openai": "sk-...",
    "anthropic": "sk-ant-..."
  }
}
```

### DELETE /api/ai-analysis/[paperId]
Delete all AI analyses for a paper.

### GET /api/ai-analysis/[paperId]/[provider]
Get specific provider analysis for a paper.

### POST /api/ai-analysis/[paperId]/[provider]
Start analysis with specific provider.

### DELETE /api/ai-analysis/[paperId]/[provider]
Delete specific provider analysis.

### POST /api/ai-analysis/batch
Start batch analysis for multiple papers.

**Request Body:**
```json
{
  "paperIds": ["1", "2", "3"],
  "modelProviders": ["openai", "anthropic"],
  "apiKeys": {
    "openai": "sk-...",
    "anthropic": "sk-ant-..."
  }
}
```

## User Evaluation Endpoints

### GET /api/evaluations
Get user evaluations.

**Query Parameters:**
- `paperId` (optional): Get evaluation for specific paper
- `paperIds` (optional): Comma-separated list of paper IDs

### POST /api/evaluations
Save user evaluation.

**Request Body:**
```json
{
  "evaluation": {
    "paperId": "1",
    "rating": 5,
    "notes": "Excellent paper",
    "tags": ["important", "survey"]
  }
}
```

### DELETE /api/evaluations?paperId={paperId}
Delete evaluation for a paper.

### GET /api/evaluations/stats
Get evaluation statistics.

### GET /api/evaluations/tags
Get all unique tags from evaluations.

## Search and RAG Endpoints

### POST /api/search
Perform semantic search across papers.

**Request Body:**
```json
{
  "query": "search query",
  "openaiApiKey": "sk-...",
  "filters": {
    "readingStatus": ["completed"],
    "publicationYear": { "min": 2020, "max": 2024 }
  },
  "limit": 10
}
```

### POST /api/rag/query
Ask questions using RAG (Retrieval-Augmented Generation).

**Request Body:**
```json
{
  "question": "What are the main findings?",
  "openaiApiKey": "sk-...",
  "filters": {
    "tags": ["important"]
  }
}
```

### POST /api/rag/embed
Embed paper content for vector search.

**Request Body:**
```json
{
  "paper": { /* paper object */ },
  "evaluation": { /* evaluation object */ },
  "analyses": { /* analyses object */ },
  "openaiApiKey": "sk-..."
}
```

### DELETE /api/rag/embed?paperId={paperId}&openaiApiKey={key}
Remove paper embedding.

### GET /api/rag/stats?openaiApiKey={key}
Get RAG/embedding statistics.

## AI Key Management Endpoints

### POST /api/ai-keys/validate
Validate API key for AI service.

**Request Body:**
```json
{
  "service": "openai",
  "apiKey": "sk-..."
}
```

### GET /api/ai-keys/usage
Get API usage statistics.

## Google Drive Integration Endpoints

### GET /api/google-drive/auth?action=auth-url
Get Google Drive authorization URL.

### POST /api/google-drive/auth
Exchange authorization code for tokens.

**Request Body:**
```json
{
  "code": "authorization_code"
}
```

### POST /api/google-drive/upload
Upload paper to Google Drive.

**Form Data:**
- `file`: PDF file
- `title`: Paper title
- `authors`: JSON array of authors
- `journal`: Journal name
- `publicationYear`: Publication year

## Zotero Integration Endpoints

### GET /api/zotero/config
Get Zotero configuration.

### POST /api/zotero/config
Update Zotero configuration.

### GET /api/zotero/sync
Get sync status.

### POST /api/zotero/sync
Perform Zotero synchronization.

**Request Body:**
```json
{
  "type": "incremental" // or "full"
}
```

## Database Health Endpoints

### GET /api/database/health
Check database connection health.

### GET /api/database/test
Test database operations.

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Authentication required
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server error

## Authentication

Most endpoints require authentication. Include the session cookie or use the session token from the login response.

For AI-related endpoints, API keys for the respective services (OpenAI, Anthropic, etc.) are required in the request body.