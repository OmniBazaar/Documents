# Bazaar Integration Guide

This guide explains how the Bazaar module can integrate with the Documents module to provide documentation, forum, and support functionality.

## Overview

The Documents module provides three main services:
- **Documentation Service** - Multi-language documentation with search
- **Forum Service** - P2P forum with consensus-based moderation
- **Support Service** - Volunteer-based support chat system

## Installation

```bash
npm install @omnibazaar/documents
```

## Basic Integration

### Method 1: High-Level Integration (Recommended)

```typescript
import { startDocumentsModule } from '@omnibazaar/documents';

const documentsModule = await startDocumentsModule({
  database: {
    host: 'localhost',
    port: 5433,
    database: 'omnibazaar',
    user: 'omnibazaar',
    password: 'password'
  },
  validatorEndpoint: 'http://localhost:8080'
});

// Get all services
const services = documentsModule.getServices();

// Use services
const docs = await services.documentation.searchDocuments({
  query: 'wallet setup',
  language: 'en'
});
```

### Method 2: Direct Service Import

```typescript
import { 
  Database,
  createForumService,
  MockParticipationScoreService 
} from '@omnibazaar/documents';

// Create database
const db = new Database(dbConfig);

// Create participation service
const participationService = new MockParticipationScoreService();

// Create forum service
const forumService = await createForumService(db, participationService);
```

## Service APIs

### Documentation Service

```typescript
// Search documents
const results = await documentationService.searchDocuments({
  query: 'staking',
  category: 'technical',
  language: 'en',
  limit: 10
});

// Get document by ID
const doc = await documentationService.getDocument('doc-123');

// Get categories
const categories = await documentationService.getDocumentsByCategory('wallet');
```

### Forum Service

```typescript
// Create thread
const thread = await forumService.createThread({
  title: 'How to stake XOM?',
  content: 'I want to learn about staking...',
  category: 'staking',
  tags: ['staking', 'xom']
});

// Get thread with posts
const threadData = await forumService.getThreadPosts('thread-123');

// Search forum
const searchResults = await forumService.search({
  query: 'wallet issues',
  category: 'support'
});
```

### Support Service

```typescript
// Send support message
const message = await supportService.sendMessage(
  'session-123',
  '0x1234...',
  'I need help with my wallet',
  'text'
);

// Rate support session
await supportService.rateSession('session-123', 5, 'Very helpful!');

// Get volunteer metrics
const metrics = await supportService.getVolunteerMetrics('0x5678...');
```

## Type Imports

```typescript
import type {
  // Documentation types
  DocumentMetadata,
  Document,
  DocumentCategory,
  DocumentSearchParams,
  
  // Forum types
  ForumThread,
  ForumPost,
  CreateThreadRequest,
  ForumSearchResult,
  
  // Support types
  SupportSession,
  ChatMessage,
  SupportCategory
} from '@omnibazaar/documents';
```

## React Components Example

```typescript
import type { DocumentMetadata, ForumThread } from '@omnibazaar/documents';

interface DocumentCardProps {
  document: DocumentMetadata;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document }) => (
  <div className="doc-card">
    <h3>{document.title}</h3>
    <p>{document.description}</p>
    <span>{document.category}</span>
  </div>
);

interface ForumThreadProps {
  thread: ForumThread;
}

const ForumThread: React.FC<ForumThreadProps> = ({ thread }) => (
  <div className="forum-thread">
    <h2>{thread.title}</h2>
    <div className="meta">
      <span>{thread.authorAddress}</span>
      <span>{thread.replyCount} replies</span>
    </div>
  </div>
);
```

## Event Handling

```typescript
// Subscribe to forum events
forumService.on('newThread', (thread) => {
  // Handle new thread
});

forumService.on('newPost', (post) => {
  // Handle new post
});

// Subscribe to support events
supportService.on('newMessage', (message) => {
  // Handle new support message
});
```

## Error Handling

```typescript
try {
  const results = await documentationService.searchDocuments({
    query: 'wallet'
  });
} catch (error) {
  if (error.code === 'DB_CONNECTION_ERROR') {
    // Handle database error
  } else if (error.code === 'SEARCH_ERROR') {
    // Handle search error
  }
}
```

## Environment Variables

The Documents module uses these environment variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=omnibazaar
DB_USER=omnibazaar
DB_PASSWORD=password

# Validator
VALIDATOR_ENDPOINT=http://localhost:8080
VALIDATOR_API_KEY=optional-api-key

# Services
IPFS_API_URL=http://localhost:5001
```

## Best Practices

1. **Always handle errors** - Services can throw errors for network/database issues
2. **Use TypeScript types** - Import types for better IDE support
3. **Cache frequently accessed data** - Services have built-in caching
4. **Subscribe to events** - For real-time updates in UI
5. **Use participation scoring** - Integrate with user reputation system

## Production Deployment

For production, use actual services instead of mocks:

```typescript
import { ParticipationScoreService } from '@omnibazaar/validator';

// Use real participation service from Validator module
const participationService = new ParticipationScoreService(db);

// Pass to Documents services
const forumService = await createForumService(db, participationService);
```

## Support

For issues or questions:
- Check the [Documentation](./README.md)
- Search existing [GitHub Issues](https://github.com/OmniBazaar/Documents/issues)
- Ask in the OmniBazaar Discord