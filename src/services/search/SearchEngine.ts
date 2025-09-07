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

  /** In-memory document index for testing */
  private documentIndex: Map<string, IndexDocument>;

  /**
   * Creates a new SearchEngine instance
   * @param indexName - Name of the search index
   */
  constructor(indexName: string = 'documents') {
    this.indexName = indexName;
    this.documentIndex = new Map();
  }

  /**
   * Indexes a document
   * @param document - Document to index
   */
  indexDocument(document: IndexDocument): void {
    try {
      // Store document in memory for search
      this.documentIndex.set(document.id, document);

      logger.debug('Document indexed', {
        index: this.indexName,
        id: document.id,
        type: document.type,
        title: document.title,
        contentSnippet: document.content.substring(0, 50),
      });
    } catch (error) {
      logger.error('Failed to index document', {
        document: document.id,
        error: error instanceof Error ? error.message : String(error),
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
      // Update document in memory
      this.documentIndex.set(document.id, document);

      logger.debug('Document updated in index', {
        index: this.indexName,
        id: document.id,
        type: document.type,
      });
    } catch (error) {
      logger.error('Failed to update document in index', {
        document: document.id,
        error: error instanceof Error ? error.message : String(error),
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
      // Remove document from memory
      this.documentIndex.delete(documentId);

      logger.debug('Document removed from index', {
        index: this.indexName,
        id: documentId,
      });
    } catch (error) {
      logger.error('Failed to remove document from index', {
        document: documentId,
        error: error instanceof Error ? error.message : String(error),
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
      const query = params.query.toLowerCase();
      const results: SearchResult[] = [];

      logger.debug(`Searching for query: "${query}" in ${this.documentIndex.size} documents`);

      // Search through indexed documents
      for (const [_id, doc] of Array.from(this.documentIndex)) {
        // Filter by type if specified
        if (params.type !== null && params.type !== undefined && params.type !== '' && doc.type !== params.type) {
          continue;
        }

        // Apply filters
        if (params.filters !== null && params.filters !== undefined && Object.keys(params.filters).length > 0) {
          let skip = false;
          for (const [key, value] of Object.entries(params.filters)) {
            if (value !== undefined && value !== null && value !== '') {
              // Check metadata exists
              if (doc.metadata === null || doc.metadata === undefined) {
                // If metadata is required but missing, skip unless it's a basic document property
                if (['category', 'language', 'tags'].includes(key)) {
                  skip = true;
                  break;
                }
              } else {
                const metaValue = doc.metadata[key];

                // Handle array filters (like tags)
                if (Array.isArray(value) && Array.isArray(metaValue)) {
                  const hasTag = value.some(tag => (metaValue as unknown[]).includes(tag));
                  if (!hasTag) {
                    skip = true;
                    break;
                  }
                }
                // Handle regular equality filters
                else if (metaValue !== value) {
                  skip = true;
                  break;
                }
              }
            }
          }
          if (skip) continue;
        }

        // Text search - support both phrase and word-based matching
        const titleLower = doc.title.toLowerCase();
        const contentLower = doc.content.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact phrase match first
        let titleMatch = titleLower.includes(queryLower);
        let contentMatch = contentLower.includes(queryLower);
        
        // If no exact phrase match, try word-based matching
        if (!titleMatch && !contentMatch && queryLower.includes(' ')) {
          const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
          
          // Check if any query words are present in title or content (OR logic)
          titleMatch = queryWords.some(word => titleLower.includes(word));
          contentMatch = queryWords.some(word => contentLower.includes(word));
        }

        logger.debug(
          `Checking document: "${doc.title}" against query "${query}" - titleMatch: ${titleMatch}, contentMatch: ${contentMatch}`,
        );

        if (query === '' || titleMatch || contentMatch) {
          const score = titleMatch ? 1.0 : contentMatch ? 0.7 : 0.5;

          logger.debug(
            `Found match for "${query}": ${doc.title} (titleMatch: ${titleMatch}, contentMatch: ${contentMatch})`,
          );

          results.push({
            id: doc.id,
            type: doc.type,
            title: doc.title,
            snippet: this.generateSnippet(doc.content, query),
            score,
            ...(doc.metadata !== null && doc.metadata !== undefined && { metadata: doc.metadata }),
          });
        }
      }

      // Sort by relevance
      results.sort((a, b) => b.score - a.score);

      // Apply pagination
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedResults = results.slice(startIndex, startIndex + pageSize);

      const took = Date.now() - start;

      logger.debug('Search executed', {
        index: this.indexName,
        query: params.query,
        results: paginatedResults.length,
        took,
      });

      return {
        results: paginatedResults,
        total: results.length,
        page,
        pageSize,
        took,
      };
    } catch (error) {
      logger.error('Search failed', {
        query: params.query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generates a snippet from content
   * @param content - Full content
   * @param query - Search query
   * @returns Snippet with highlighted matches
   * @private
   */
  private generateSnippet(content: string, query: string): string {
    const maxLength = 200;
    const lowerContent = content.toLowerCase();
    const queryIndex = query !== null && query !== undefined && query !== '' ? lowerContent.indexOf(query.toLowerCase()) : -1;

    if (queryIndex === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(content.length, start + maxLength);
    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet += '...';

    return snippet;
  }
}
