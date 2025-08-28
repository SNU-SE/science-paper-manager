# Science Paper Manager

AI-powered research paper management system with multi-model analysis and semantic search.

## Features

- 🤖 **Multi-Model AI Analysis**: Analyze papers with OpenAI, Anthropic, xAI, and Gemini
- 🔍 **Semantic Search**: Vector similarity search using pgvector and OpenAI embeddings
- 📚 **Paper Management**: Organize papers with ratings, notes, tags, and reading status
- 🔗 **Integrations**: Google Drive storage and Zotero synchronization
- 💬 **RAG Chat**: Ask questions about your research collection

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL with pgvector extension
- **Vector Store**: LangChain SupabaseVectorStore
- **Deployment**: Vercel (Frontend), Supabase (Backend)
- **Storage**: Google Drive API
- **AI Services**: OpenAI, Anthropic, xAI, Gemini APIs

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- API keys for AI services (stored client-side)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your configuration:
   - Supabase URL and keys
   - Google Drive API credentials
   - Zotero API credentials

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Authentication

The system uses simple authentication with hardcoded credentials:
- Email: `admin@email.com`
- Password: `1234567890`

### API Keys

AI service API keys are managed client-side through the settings interface for security and cost control.

## Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── papers/         # Paper management components
│   ├── ai/             # AI analysis components
│   ├── search/         # Search and RAG components
│   └── ui/             # shadcn/ui components
├── services/           # Service layer
│   ├── ai/             # AI service implementations
│   └── vector/         # Vector database service
├── stores/             # Zustand state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── config/             # Application configuration
```

## Development

### Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database Setup

The application requires a Supabase database with pgvector extension. See the design document for the complete schema.

## Contributing

This is a personal research tool. For questions or suggestions, please open an issue.

## License

Private project - All rights reserved.