# Documents Module Frontend API Guide

This guide explains how to use the Documents module's frontend API client to interact with documentation, forum, and support services from your frontend application.

## Overview

The Documents module provides a unified API client (`DocumentsAPIClient`) that wraps all internal routes and provides type-safe methods for frontend developers. The client handles:

- Documentation management (CRUD operations, search, voting)
- Forum functionality (threads, posts, search, voting)
- Support system (requests, volunteer management, messaging)
- Unified search across all services
- Participation score tracking

## Installation and Setup

```typescript
import { DocumentsAPIClient } from '@omnibazaar/documents/frontend';

// Initialize the client with your Validator application's base URL
const documentsAPI = new DocumentsAPIClient('http://localhost:3000');
```

## API Reference

### Documentation APIs

#### Search Documents

```typescript
// Search with query
const results = await documentsAPI.searchDocuments({
  query: 'installation guide',
  page: 1,
  pageSize: 20
});

// Search with filters
const results = await documentsAPI.searchDocuments({
  query: 'wallet',
  filters: {
    category: 'tutorials',
    language: 'en'
  }
});
```

#### Get Document

```typescript
const document = await documentsAPI.getDocument('doc-id-123');
if (document) {
  console.log(document.title, document.content);
}
```

#### Create Document

```typescript
const newDoc = await documentsAPI.createDocument({
  title: 'Getting Started Guide',
  content: '# Getting Started\n\nWelcome to OmniBazaar...',
  category: 'tutorials',
  language: 'en',
  authorAddress: '0x1234...',
  tags: ['beginner', 'setup'],
  metadata: {
    readingTime: '5 minutes'
  }
});
```

#### Update Document

```typescript
const updated = await documentsAPI.updateDocument(
  'doc-id-123',
  {
    title: 'Updated Title',
    content: 'New content...',
    tags: ['updated', 'v2']
  },
  '0x1234...' // editor address
);
```

#### Vote on Document

```typescript
await documentsAPI.voteOnDocument(
  'doc-id-123',
  true, // approve
  '0xvalidator...'
);
```

### Forum APIs

#### Get Recent Threads

```typescript
// Get recent threads
const threads = await documentsAPI.getRecentForumThreads(20, 1);

// Get threads by category
const supportThreads = await documentsAPI.getRecentForumThreads(
  20,
  1,
  'support'
);
```

#### Create Thread

```typescript
const thread = await documentsAPI.createForumThread({
  title: 'How to set up a validator node?',
  content: 'I need help setting up my first validator node...',
  category: 'technical',
  authorAddress: '0x1234...',
  tags: ['validator', 'setup', 'help']
});
```

#### Create Post

```typescript
const post = await documentsAPI.createForumPost({
  threadId: 'thread-123',
  content: 'Here is how you can set up a validator...',
  authorAddress: '0x5678...',
  parentId: 'post-456' // optional, for replies
});
```

#### Search Forum

```typescript
const searchResults = await documentsAPI.searchForum({
  query: 'validator setup',
  category: 'technical',
  sortBy: 'relevance'
});

console.log(searchResults.threads);
console.log(searchResults.posts);
```

#### Get Thread Posts

```typescript
const posts = await documentsAPI.getThreadPosts('thread-123', 50, 0);
```

#### Vote on Post

```typescript
await documentsAPI.voteOnPost(
  'post-123',
  true, // upvote
  '0x1234...'
);
```

### Support APIs

#### Request Support

```typescript
const session = await documentsAPI.requestSupport({
  userAddress: '0x1234...',
  category: 'technical_issue',
  priority: 'high',
  initialMessage: 'I cannot access my wallet...',
  language: 'en',
  userScore: 75,
  metadata: {
    browser: 'Chrome',
    version: '120.0'
  }
});

console.log('Support session ID:', session.sessionId);
```

#### Register as Volunteer

```typescript
await documentsAPI.registerVolunteer({
  address: '0xvolunteer...',
  displayName: 'Helpful Helper',
  status: 'available',
  languages: ['en', 'es', 'fr'],
  expertiseCategories: ['wallet_setup', 'technical_issue', 'general'],
  participationScore: 85,
  maxConcurrentSessions: 3
});
```

#### Send Support Message

```typescript
await documentsAPI.sendSupportMessage(
  session.sessionId,
  'Thank you for contacting support. Can you provide more details?',
  '0xvolunteer...'
);
```

#### Get Support Session

```typescript
const session = await documentsAPI.getSupportSession('session-123');
if (session) {
  console.log('Status:', session.status);
  console.log('Messages:', session.messages);
}
```

### Unified Search

```typescript
// Search across all services
const results = await documentsAPI.unifiedSearch('wallet setup');
console.log('Documents:', results.documents);
console.log('Forum:', results.forum);

// Search specific service
const docsOnly = await documentsAPI.unifiedSearch('installation', 'documents');
```

### Participation Score

```typescript
const score = await documentsAPI.getUserScore('0x1234...');
console.log('User participation score:', score);
```

### Health Check

```typescript
const health = await documentsAPI.getHealthStatus();
console.log('System status:', health.status);
console.log('Services:', health.services);
```

## Error Handling

All API methods throw errors when requests fail. Always wrap API calls in try-catch blocks:

```typescript
try {
  const document = await documentsAPI.getDocument('invalid-id');
} catch (error) {
  if (error.message.includes('404')) {
    console.log('Document not found');
  } else {
    console.error('API error:', error);
  }
}
```

## TypeScript Support

The API client is fully typed. Import types for better IDE support:

```typescript
import type {
  Document,
  ForumThread,
  SupportSession,
  DocumentCategory,
  SupportPriority
} from '@omnibazaar/documents';
```

## Best Practices

1. **Initialize Once**: Create a single instance of `DocumentsAPIClient` and reuse it throughout your application.

2. **Error Handling**: Always handle errors, especially for 404 (not found) cases.

3. **Pagination**: Use pagination parameters for large result sets:
   ```typescript
   const results = await documentsAPI.searchDocuments({
     query: 'guide',
     page: 2,
     pageSize: 50
   });
   ```

4. **Caching**: Consider implementing client-side caching for frequently accessed data:
   ```typescript
   const cache = new Map();

   async function getCachedDocument(id: string) {
     if (cache.has(id)) {
       return cache.get(id);
     }
     const doc = await documentsAPI.getDocument(id);
     cache.set(id, doc);
     return doc;
   }
   ```

5. **Debouncing**: Debounce search requests to reduce API calls:
   ```typescript
   import { debounce } from 'lodash';

   const debouncedSearch = debounce(async (query: string) => {
     const results = await documentsAPI.searchDocuments({ query });
     updateSearchResults(results);
   }, 300);
   ```

## Example: Complete React Component

```typescript
import React, { useState, useEffect } from 'react';
import { DocumentsAPIClient } from '@omnibazaar/documents/frontend';
import type { Document } from '@omnibazaar/documents';

const documentsAPI = new DocumentsAPIClient('http://localhost:3000');

function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    try {
      const results = await documentsAPI.searchDocuments({
        page: 1,
        pageSize: 20
      });
      setDocuments(results.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {documents.map(doc => (
        <div key={doc.id}>
          <h3>{doc.title}</h3>
          <p>{doc.description}</p>
        </div>
      ))}
    </div>
  );
}
```

## API Endpoints Reference

All endpoints are prefixed with `/internal/` and are meant to be accessed through the `DocumentsAPIClient`. Direct access is possible but not recommended.

### Documentation Endpoints
- `GET /internal/documents` - Search documents
- `GET /internal/documents/:id` - Get document
- `POST /internal/documents` - Create document
- `PUT /internal/documents/:id` - Update document
- `POST /internal/documents/:id/vote` - Vote on document

### Forum Endpoints
- `GET /internal/forum/threads` - Get recent threads
- `GET /internal/forum/threads/:id` - Get thread
- `POST /internal/forum/threads` - Create thread
- `POST /internal/forum/posts` - Create post
- `GET /internal/forum/threads/:id/posts` - Get thread posts
- `POST /internal/forum/posts/:id/vote` - Vote on post
- `GET /internal/forum/search` - Search forum
- `GET /internal/forum/stats` - Get forum statistics

### Support Endpoints
- `POST /internal/support/requests` - Request support
- `POST /internal/support/volunteers` - Register volunteer
- `GET /internal/support/stats` - Get support statistics
- `GET /internal/support/sessions/:id` - Get session details
- `POST /internal/support/sessions/:id/messages` - Send message
- `POST /internal/support/sessions/:id/close` - Close session

### Other Endpoints
- `GET /internal/search` - Unified search
- `GET /internal/participation/:address/score` - Get user score
- `GET /internal/health` - Health check

## Migration from Old API

If you're migrating from the old GraphQL API:

```typescript
// Old GraphQL query
const query = `
  query GetDocument($id: String!) {
    document(id: $id) {
      id
      title
      content
    }
  }
`;

// New API client
const document = await documentsAPI.getDocument(id);
```

The new API is simpler and provides better type safety with less boilerplate.

## Support

For issues or questions about the Documents module frontend API:
- Check the TypeScript types for accurate method signatures
- Review the internal routes in `src/routes/internalRoutes.ts`
- Consult the service implementations in `src/services/`

Remember: This API client is designed for frontend applications running in browsers. For server-side or direct integration, use the service classes directly.