/**
 * Search Engine Service Interface
 * 
 * Interface for interacting with the Validator module's SearchEngine.
 * Provides full-text and semantic search capabilities across documentation and forums.
 * 
 * @module SearchEngine
 */

import { logger } from '../../utils/logger';

/**
 * Search result item
 */
export interface SearchResult {
  /** Document/item ID */
  id: string;
  /** Result type (documentation, forum_post, etc.) */
  type: string;
  /** Result title */
  title: string;
  /** Content snippet with highlighted matches */
  snippet: string;
  /** Relevance score (0-1) */
  score: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search parameters
 */
export interface SearchParams {
  /** Search query */
  query: string;
  /** Filter by type */
  type?: string;
  /** Additional filters */
  filters?: Record<string, unknown>;
  /** Page number (1-based) */
  page?: number;
  /** Results per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Search response
 */
export interface SearchResponse {
  /** Search results */
  results: SearchResult[];
  /** Total number of results */
  total: number;
  /** Current page */
  page: number;
  /** Results per page */
  pageSize: number;
  /** Query execution time in ms */
  took: number;
}

/**
 * Document to be indexed
 */
export interface IndexDocument {
  /** Document ID */
  id: string;
  /** Document type */
  type: string;
  /** Document title */
  title: string;
  /** Document content */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search engine service for full-text search
 */
export class SearchEngine {
  /** Search index name */
  private indexName: string;

  /**
   * Creates a new SearchEngine instance
   * @param indexName - Name of the search index
   */
  constructor(indexName: string = 'documents') {
    this.indexName = indexName;
  }

  /**
   * Indexes a document
   * @param document - Document to index
   */
  indexDocument(document: IndexDocument): void {
    try {
      // In production, this would index in Elasticsearch/similar
      // For now, we rely on PostgreSQL's full-text search
      logger.debug('Document indexed', {
        index: this.indexName,
        id: document.id,
        type: document.type
      });
    } catch (error) {
      logger.error('Failed to index document', {
        document: document.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Updates an indexed document
   * @param document - Document to update
   */
  updateDocument(document: IndexDocument): void {
    try {
      logger.debug('Document updated in index', {
        index: this.indexName,
        id: document.id,
        type: document.type
      });
    } catch (error) {
      logger.error('Failed to update document in index', {
        document: document.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Removes a document from the index
   * @param documentId - Document ID to remove
   */
  removeDocument(documentId: string): void {
    try {
      logger.debug('Document removed from index', {
        index: this.indexName,
        id: documentId
      });
    } catch (error) {
      logger.error('Failed to remove document from index', {
        document: documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Searches for documents
   * @param params - Search parameters
   * @returns Search results
   */
  search(params: SearchParams): SearchResponse {
    const start = Date.now();
    
    try {
      // In production, this would perform actual search
      // For now, return mock results
      const results: SearchResult[] = [];
      const total = 0;
      const took = Date.now() - start;

      logger.debug('Search executed', {
        index: this.indexName,
        query: params.query,
        results: results.length,
        took
      });

      return {
        results,
        total,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        took
      };
    } catch (error) {
      logger.error('Search failed', {
        query: params.query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}