/**
 * Frontend API Exports
 *
 * This module exports the frontend API client and related types
 * for easy consumption by browser-based applications.
 *
 * @module frontend
 */

// Export the main API client
export { DocumentsAPIClient, DocumentsAPIClient as default } from './DocumentsAPIClient';

// Re-export commonly used types for convenience
export type {
  // Documentation types
  Document,
  DocumentCategory,
  DocumentSearchParams,
  DocumentMetadata,
  DocumentLanguage,
  DocumentAttachment,
} from '../services/documentation/DocumentationService';

export type {
  // Forum types
  ForumThread,
  ForumPost,
  CreateThreadRequest,
  CreatePostRequest,
  ForumSearchOptions,
  ForumSearchResult,
  ForumStats,
  ForumCategory,
  ForumVote,
  VoteRequest,
} from '../services/forum/ForumTypes';

export type {
  // Support types
  SupportRequest,
  SupportSession,
  SupportVolunteer,
  SupportSystemStats,
  SupportCategory,
  SupportPriority,
  SupportSessionStatus,
  VolunteerStatus,
  ChatMessage,
} from '../services/support/SupportTypes';

/**
 * Quick start example for frontend developers
 *
 * @example
 * ```typescript
 * import DocumentsAPI from '@omnibazaar/documents/frontend';
 *
 * const api = new DocumentsAPI('http://localhost:3000');
 *
 * // Search documents
 * const docs = await api.searchDocuments({ query: 'wallet' });
 *
 * // Create forum thread
 * const thread = await api.createForumThread({
 *   title: 'Question about staking',
 *   content: 'How do I stake XOM tokens?',
 *   category: 'support',
 *   authorAddress: '0x...'
 * });
 *
 * // Request support
 * const session = await api.requestSupport({
 *   userAddress: '0x...',
 *   category: 'technical_issue',
 *   initialMessage: 'I need help with...'
 * });
 * ```
 */