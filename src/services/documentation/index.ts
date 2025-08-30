/**
 * Documentation Service Module Exports
 * 
 * Central export file for all documentation-related services and types
 * 
 * @module Documentation
 */

/**
 * DocumentationService - Main service for managing documentation
 * @see {@link DocumentationService}
 */
export { DocumentationService } from './DocumentationService';

/**
 * Array of supported documentation languages
 * @see {@link SUPPORTED_LANGUAGES}
 */
export { SUPPORTED_LANGUAGES } from './DocumentationService';

/**
 * Documentation category enumeration for organizing documents
 * @see {@link DocumentCategory}
 */
export { DocumentCategory } from './DocumentationService';

/**
 * Type representing supported documentation languages
 * @see {@link DocumentLanguage}
 */
export type { DocumentLanguage } from './DocumentationService';

/**
 * Interface for document metadata information
 * @see {@link DocumentMetadata}
 */
export type { DocumentMetadata } from './DocumentationService';

/**
 * Interface representing a complete document with content
 * @see {@link Document}
 */
export type { Document } from './DocumentationService';

/**
 * Interface for document attachments
 * @see {@link DocumentAttachment}
 */
export type { DocumentAttachment } from './DocumentationService';

/**
 * Interface for document contributions and proposals
 * @see {@link DocumentContribution}
 */
export type { DocumentContribution } from './DocumentationService';

/**
 * Interface for document search parameters
 * @see {@link DocumentSearchParams}
 */
export type { DocumentSearchParams } from './DocumentationService';

/**
 * Interface for document update proposals
 * @see {@link DocumentUpdateProposal}
 */
export type { DocumentUpdateProposal } from './DocumentationService';

/**
 * Create a fully configured documentation service instance
 * 
 * @param db - Database instance for YugabyteDB connection
 * @param participationService - ParticipationScoreService instance for score tracking
 * @param searchEngine - SearchEngine instance for document search functionality
 * @param validationService - ValidationService instance for content validation
 * @returns Promise resolving to initialized DocumentationService instance
 * 
 * @example
 * ```typescript
 * import { createDocumentationService } from '@omnibazaar/documents';
 * 
 * const docs = await createDocumentationService(db, participationService, searchEngine, validationService);
 * ```
 */
export async function createDocumentationService(
  db: Database,
  participationService: ParticipationScoreService,
  searchEngine: SearchEngine,
  validationService: ValidationService
): Promise<DocumentationServiceType> {
  const { DocumentationService: DocService } = await import('./DocumentationService');
  const docService = new DocService(
    db,
    searchEngine,
    participationService,
    validationService
  );
  return docService;
}

/**
 * Documentation module version
 */
export const DOCUMENTATION_VERSION = '1.0.0';

/**
 * Default configuration for documentation service
 */
export const DEFAULT_DOCUMENTATION_CONFIG = {
  cacheSize: 100,
  cacheTTLSeconds: 3600, // 1 hour
  maxDocumentSize: 1024 * 1024 * 10, // 10MB
  maxAttachmentSize: 1024 * 1024 * 100, // 100MB
  supportedAttachmentTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'video/mp4',
    'application/pdf',
    'text/plain',
    'text/markdown'
  ]
};

/**
 * Documentation event types for external listeners
 */
export enum DocumentationEvent {
  /** Fired when a new document is created */
  DOCUMENT_CREATED = 'documentCreated',
  /** Fired when a document is updated */
  DOCUMENT_UPDATED = 'documentUpdated',
  /** Fired when a document is rated */
  DOCUMENT_RATED = 'documentRated',
  /** Fired when a contribution is submitted */
  CONTRIBUTION_SUBMITTED = 'contributionSubmitted',
  /** Fired when a contribution is approved */
  CONTRIBUTION_APPROVED = 'contributionApproved',
  /** Fired when a contribution is rejected */
  CONTRIBUTION_REJECTED = 'contributionRejected'
}

/**
 * Helper function to validate document content
 * 
 * @param content - Document content to validate
 * @returns Validation result
 */
export function validateDocumentContent(content: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (content.trim().length === 0) {
    errors.push('Content cannot be empty');
  }

  if (content.length > DEFAULT_DOCUMENTATION_CONFIG.maxDocumentSize) {
    errors.push(`Content exceeds maximum size of ${DEFAULT_DOCUMENTATION_CONFIG.maxDocumentSize} bytes`);
  }

  // Check for basic markdown structure
  const hasHeading = /^#+ .+/m.test(content);
  if (!hasHeading) {
    errors.push('Document should have at least one heading');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to format document for display
 * 
 * @param document - Document to format
 * @returns Formatted document
 */
export function formatDocumentForDisplay(document: Document): {
  title: string;
  summary: string;
  readingTime: number;
  lastUpdated: string;
} {
  // Extract first paragraph as summary
  const firstParagraph = document.content
    .split('\n\n')
    .find(p => p.trim().length > 0 && !p.startsWith('#'));
  
  const summary = firstParagraph !== undefined
    ? firstParagraph.substring(0, 200) + (firstParagraph.length > 200 ? '...' : '')
    : '';

  // Estimate reading time (200 words per minute)
  const wordCount = document.content.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    title: document.title,
    summary,
    readingTime,
    lastUpdated: new Date(document.updatedAt).toLocaleDateString()
  };
}

// Re-import types for type checking
import type { Document, DocumentationService as DocumentationServiceType } from './DocumentationService';
import type { Database } from '../database/Database';
import type { ParticipationScoreService } from '../participation/ParticipationScoreService';
import type { SearchEngine } from '../search/SearchEngine';
import type { ValidationService } from '../validation/ValidationService';