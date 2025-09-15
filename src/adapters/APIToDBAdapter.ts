/**
 * API to Database Adapter
 *
 * Adapts the ValidatorAPIClient to provide a Database-like interface
 * for legacy services that still expect direct database access.
 * This is a temporary solution until all services are refactored
 * to use the Validator API directly.
 *
 * @module adapters/APIToDBAdapter
 */

import { ValidatorAPIClient } from '../services/validator/ValidatorAPIClient';
import { logger } from '../utils/logger';
import type { ForumPost, ForumThread } from '../services/forum/ForumTypes';
import type { Document, DocumentCategory } from '../services/documentation/DocumentationService';

/**
 * Query result format matching pg module
 * @template T - Type of the row data
 */
export interface QueryResult<T = unknown> {
  /** Array of result rows */
  rows: T[];
  /** Number of rows affected or returned */
  rowCount: number;
  /** SQL command that was executed */
  command: string;
}

/**
 * Database-like interface adapter for ValidatorAPIClient
 */
export class APIToDBAdapter {
  /**
   * Creates a new API to DB adapter
   * @param apiClient - The ValidatorAPIClient instance to use
   */
  constructor(private readonly apiClient: ValidatorAPIClient) {}

  /**
   * Simulates database query by routing to appropriate API methods
   * @param text - SQL query text (used to determine operation type)
   * @param values - Query parameters
   * @returns Query result
   */
  async query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    logger.debug('APIToDBAdapter query', { text, values });

    // Parse the query to determine the operation
    const normalizedQuery = text.trim().toLowerCase();

    try {
      // Handle INSERT operations
      if (normalizedQuery.startsWith('insert into documents')) {
        // The DocumentationService already generated the ID and passes it as values[0]
        const id = String(values?.[0]);
        const document = {
          id: id,
          title: String(values?.[1] ?? ''),
          description: String(values?.[2] ?? ''),
          content: String(values?.[3] ?? ''),
          category: String(values?.[4] ?? 'general') as DocumentCategory,
          language: String(values?.[5] ?? 'en') as Document['language'],
          authorAddress: String(values?.[7] ?? ''),
          tags: (values?.[8] ?? []) as string[],
          isOfficial: Boolean(values?.[9] ?? false),
          version: Number(values?.[6] ?? 1),
          status: String(values?.[11] ?? 'draft') as 'draft' | 'published' | 'archived',
          rating: 0,
          viewCount: 0,
        };

        // For MockValidatorAPIClient, we need to pass the ID
        const created = await this.apiClient.createDocument(document);
        logger.debug('APIToDBAdapter created document', { id, created });

        // Return empty result - DocumentationService doesn't use the result
        return {
          rows: [],
          rowCount: 1,
          command: 'INSERT',
        };
      }

      // Handle SELECT operations
      if (normalizedQuery.startsWith('select') && normalizedQuery.includes('from documents')) {
        // Handle IN clause queries for getDocumentsByIds
        if (normalizedQuery.includes('where id in (')) {
          if (values === undefined || values === null || values.length === 0) {
            return {
              rows: [],
              rowCount: 0,
              command: 'SELECT',
            };
          }

          // Get all documents by IDs
          const documents = await Promise.all(
            values.map(async (id) => {
              const doc = await this.apiClient.getDocument(id as string);
              return doc;
            })
          );

          // Filter out nulls and map to database row format
          const rows = documents
            .filter((doc): doc is NonNullable<typeof doc> => doc !== null)
            .map(doc => ({
              id: doc.id,
              title: doc.title,
              description: doc.description ?? '',
              content: doc.content,
              category: doc.category,
              language: doc.language,
              version: doc.version ?? 1,
              author_address: doc.authorAddress,
              tags: doc.tags ?? [],
              is_official: doc.isOfficial ?? false,
              view_count: doc.viewCount ?? 0,
              rating: doc.rating ?? 0,
              status: doc.status ?? 'draft',
              created_at: doc.createdAt ?? new Date(),
              updated_at: doc.updatedAt ?? new Date(),
              metadata: JSON.stringify(doc.metadata ?? {}),
              attachments: JSON.stringify(doc.attachments ?? []),
              ipfs_hash: doc.ipfsHash ?? null,
              published_at: doc.publishedAt ?? null,
            }));

          return {
            rows: (rows as unknown) as T[],
            rowCount: rows.length,
            command: 'SELECT',
          };
        }

        // Handle COUNT queries
        if (normalizedQuery.includes('count(*)')) {
          // Parse WHERE clause for count query
          const filters: Record<string, unknown> = {};

          // Check for author_address filter
          if (normalizedQuery.includes('author_address in') && values !== undefined && values !== null && values.length > 0) {
            filters.authorAddress = values[0];
          }

          const results = await this.apiClient.searchDocuments('', filters as {
            category?: DocumentCategory;
            tags?: string[];
            author?: string;
            language?: string;
          });

          return {
            rows: [{ count: results.total.toString() }] as T[],
            rowCount: 1,
            command: 'SELECT',
          };
        }

        // Handle document retrieval
        if (normalizedQuery.includes('where id =')) {
          const id = String(values?.[0]);
          const doc = await this.apiClient.getDocument(id);
          logger.debug('APIToDBAdapter getDocument result', { id, doc });

          // Map API response to database row format
          if (doc !== null && doc !== undefined) {
            const dbRow = {
              id: doc.id,
              title: doc.title,
              description: doc.description ?? '',
              content: doc.content,
              category: doc.category,
              language: doc.language,
              version: doc.version ?? 1,
              author_address: doc.authorAddress,
              tags: doc.tags ?? [],
              is_official: doc.isOfficial ?? false,
              view_count: doc.viewCount ?? 0,
              rating: doc.rating ?? 0,
              status: doc.status ?? 'draft',
              created_at: doc.createdAt ?? new Date(),
              updated_at: doc.updatedAt ?? new Date(),
              metadata: JSON.stringify(doc.metadata ?? {}),
              attachments: JSON.stringify(doc.attachments ?? []),
              ipfs_hash: doc.ipfsHash ?? null,
              published_at: doc.publishedAt ?? null,
            };

            const result: QueryResult<T> = {
              rows: [dbRow] as T[],
              rowCount: 1,
              command: 'SELECT',
            };
            logger.debug('APIToDBAdapter returning document row', { dbRow });
            return result;
          }

          return {
            rows: [],
            rowCount: 0,
            command: 'SELECT',
          };
        }

        // Handle document search
        // Parse the WHERE clause to extract filters
        const filters: Record<string, unknown> = {};

        // Check for category filter
        if (normalizedQuery.includes('category =')) {
          // Find the parameter position for category
          let paramIndex = 0;
          // Count how many parameters come before category in the WHERE clause
          const beforeCategory = normalizedQuery.substring(0, normalizedQuery.indexOf('category ='));
          const paramMatches = beforeCategory.match(/\$/g);
          if (paramMatches !== null && paramMatches !== undefined) {
            paramIndex = paramMatches.length;
          }
          if (values !== undefined && values !== null && paramIndex < values.length && values[paramIndex] !== undefined && values[paramIndex] !== null) {
            filters.category = values[paramIndex];
          }
        }

        // Check for author_address filter
        if (normalizedQuery.includes('author_address in')) {
          // Extract author addresses from IN clause
          const authorAddresses = values?.slice(0, values.length - 2); // Remove LIMIT and OFFSET
          if (authorAddresses !== undefined && authorAddresses !== null && authorAddresses.length === 1) {
            filters.authorAddress = authorAddresses[0];
          }
        }

        // Get limit and offset from the last two values
        // Note: The API doesn't support pagination, so we get all results
        // These values are parsed but not used since the API returns all results
        const results = await this.apiClient.searchDocuments('', filters as {
          category?: DocumentCategory;
          tags?: string[];
          author?: string;
          language?: string;
        });

        // Convert API results to database row format
        const rows = results.items.map(doc => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          content: doc.content,
          category: doc.category,
          language: doc.language,
          version: doc.version,
          author_address: doc.authorAddress,
          created_at: doc.createdAt,
          updated_at: doc.updatedAt,
          tags: doc.tags,
          is_official: doc.isOfficial,
          view_count: doc.viewCount ?? 0,
          rating: doc.rating ?? 0,
          status: doc.status ?? 'draft',
          metadata: JSON.stringify(doc.metadata ?? {}),
          attachments: JSON.stringify(doc.attachments ?? []),
          ipfs_hash: doc.ipfsHash ?? null,
          published_at: doc.publishedAt ?? null,
        }));

        return {
          rows: (rows as unknown) as T[],
          rowCount: results.total,
          command: 'SELECT',
        };
      }

      // Handle UPDATE operations
      if (normalizedQuery.startsWith('update documents')) {
        // Handle publish/unpublish/archive operations
        if (normalizedQuery.includes('set status =')) {
          if (values !== undefined && values !== null && values.length >= 2) {
            const documentId = String(values[0]);
            const status = String(values[1]);

            // For publish operation, values[2] would be ipfs_hash
            const updates: Partial<Document> = { status: status as 'draft' | 'published' | 'archived' };
            if (values[2] !== undefined && values[2] !== null) {
              updates.ipfsHash = values[2] as string;
            }

            // Call the API to update the document (result not used)
            await this.apiClient.updateDocument(documentId, updates);

            // Return empty result - DocumentationService doesn't use the result
            return {
              rows: [],
              rowCount: 1,
              command: 'UPDATE',
            };
          }
        }

        // Handle regular document updates
        // The SQL query has parameters like $1, $2, etc.
        // Based on the query structure, we know:
        // $1 = id (WHERE clause)
        // $2 = title
        // $3 = description
        // $4 = content
        // $5 = category
        // $6 = language
        // $7 = version
        // $8 = tags
        // $9 = updated_at
        // $10 = search_vector text

        if (values !== undefined && values !== null && values.length >= 1) {
          const documentId = String(values[0]); // First value is the ID from WHERE clause

          const updates: Partial<Document> = {};
          if (values[1] !== undefined && values[1] !== null) updates.title = String(values[1]);
          if (values[3] !== undefined && values[3] !== null) updates.content = String(values[3]);
          if (values[2] !== undefined && values[2] !== null) updates.description = String(values[2]);
          if (values[4] !== undefined && values[4] !== null) updates.category = values[4] as DocumentCategory;
          if (values[5] !== undefined && values[5] !== null) updates.language = values[5] as Document['language'];
          if (values[6] !== undefined && values[6] !== null) updates.version = Number(values[6]);
          if (values[7] !== undefined && values[7] !== null) updates.tags = values[7] as string[];

          // Call the API to update the document
          const updated = await this.apiClient.updateDocument(documentId, updates);

          // Return the updated document as if it was selected
          return {
            rows: [{
              id: updated.id,
              title: updated.title,
              description: updated.description,
              content: updated.content,
              category: updated.category,
              language: updated.language,
              version: updated.version,
              author_address: updated.authorAddress,
              created_at: updated.createdAt,
              updated_at: updated.updatedAt,
              tags: updated.tags,
              is_official: updated.isOfficial,
              view_count: updated.viewCount ?? 0,
              rating: updated.rating ?? 0,
              status: updated.status ?? 'draft',
              metadata: JSON.stringify(updated.metadata ?? {}),
              attachments: JSON.stringify(updated.attachments ?? []),
              ipfs_hash: updated.ipfsHash ?? null,
              published_at: updated.publishedAt ?? null,
            }] as T[],
            rowCount: 1,
            command: 'UPDATE',
          };
        }

        return {
          rows: [],
          rowCount: 0,
          command: 'UPDATE',
        };
      }

      // Handle DELETE operations
      if (normalizedQuery.startsWith('delete from documents')) {
        const id = String(values?.[0]);
        await this.apiClient.deleteDocument(id);
        return {
          rows: [],
          rowCount: 1,
          command: 'DELETE',
        };
      }

      // Handle forum operations
      if (normalizedQuery.includes('forum_threads')) {
        // Handle COUNT queries for forum threads
        if (normalizedQuery.includes('count(*)')) {
          const searchParams: Record<string, unknown> = {};

          // Extract search query if present
          if (normalizedQuery.includes('ilike') && values !== undefined && values !== null && values.length > 0) {
            const queryParam = values[0];
            if (queryParam !== undefined && queryParam !== null && typeof queryParam === 'string' && queryParam !== '') {
              searchParams.query = queryParam.replace(/%/g, '');
            }
          }

          const results = await this.apiClient.searchForumThreads({
            ...searchParams,
            page: 1,
            pageSize: 1, // We only need the total count
          });

          return {
            rows: [{ count: results.total.toString() }] as T[],
            rowCount: 1,
            command: 'SELECT',
          };
        }

        // Handle forum search
        if (normalizedQuery.includes('where') && normalizedQuery.includes('ilike')) {
          // This is a search query
          const searchParams: Record<string, unknown> = {};

          // Extract search query
          if (normalizedQuery.includes('title ilike') || normalizedQuery.includes('content ilike')) {
            // The query parameter is the first value (before LIMIT and OFFSET)
            const queryParam = values?.[0];
            if (queryParam !== undefined && queryParam !== null && typeof queryParam === 'string' && queryParam !== '') {
              searchParams.query = queryParam.replace(/%/g, '');
            }
          }

          // Extract pagination
          const limit = Number(values?.[values?.length - 2] ?? 10);
          const offset = Number(values?.[values?.length - 1] ?? 0);
          const page = Math.floor(offset / limit) + 1;

          const results = await this.apiClient.searchForumThreads({
            ...searchParams,
            page,
            pageSize: Number(limit),
          });

          // Convert API results to database row format
          const rows = results.items.map(thread => ({
            id: thread.id,
            title: thread.title,
            content: '',
            category: thread.category,
            author_address: thread.authorAddress,
            created_at: thread.createdAt !== undefined && thread.createdAt !== null ? new Date(thread.createdAt) : new Date(),
            updated_at: thread.updatedAt !== undefined && thread.updatedAt !== null ? new Date(thread.updatedAt) : new Date(),
            view_count: thread.viewCount ?? 0,
            reply_count: thread.replyCount ?? 0,
            last_reply_at: thread.lastReplyAt !== undefined && thread.lastReplyAt !== null ? new Date(thread.lastReplyAt) : new Date(),
            is_pinned: thread.isPinned ?? false,
            is_locked: thread.isLocked ?? false,
            is_deleted: false, // ForumThread doesn't have isDeleted property
            tags: thread.tags ?? [],
            metadata: JSON.stringify(thread.metadata ?? {}),
          }));

          return {
            rows: (rows as unknown) as T[],
            rowCount: results.total,
            command: 'SELECT',
          };
        }

        if (normalizedQuery.startsWith('insert')) {
          // The ID is passed as the first value
          const id = String(values?.[0]);
          const thread: Omit<ForumThread, 'createdAt' | 'updatedAt'> = {
            id: id,
            title: String(values?.[1] ?? ''),
            category: String(values?.[3] ?? 'general'),
            authorAddress: String(values?.[4] ?? ''),
            tags: (values?.[5] ?? []) as string[],
            viewCount: 0,
            metadata: {},
            replyCount: 0,
            lastReplyAt: Date.now(),
            isPinned: false,
            isLocked: false,
          };
          await this.apiClient.createForumThread(thread);
          return {
            rows: [],
            rowCount: 1,
            command: 'INSERT',
          };
        }

        // Handle SELECT for getThread
        if (normalizedQuery.startsWith('select') && normalizedQuery.includes('where id =')) {
          const threadId = String(values?.[0] ?? '');
          const thread = await this.apiClient.getForumThread(threadId);

          if (thread !== null && thread !== undefined) {
            const dbRow = {
              id: thread.id,
              title: thread.title,
              category: thread.category,
              author_address: thread.authorAddress,
              created_at: thread.createdAt !== undefined && thread.createdAt !== null ? new Date(thread.createdAt) : new Date(),
              updated_at: thread.updatedAt !== undefined && thread.updatedAt !== null ? new Date(thread.updatedAt) : new Date(),
              view_count: thread.viewCount ?? 0,
              reply_count: thread.replyCount ?? 0,
              last_reply_at: new Date(thread.lastReplyAt),
              is_pinned: thread.isPinned ?? false,
              is_locked: thread.isLocked ?? false,
              is_deleted: false, // ForumThread doesn't have isDeleted property
              tags: thread.tags ?? [],
              metadata: JSON.stringify(thread.metadata ?? {}),
            };

            return {
              rows: [dbRow] as T[],
              rowCount: 1,
              command: 'SELECT',
            } as QueryResult<T>;
          }

          return {
            rows: [],
            rowCount: 0,
            command: 'SELECT',
          };
        }
      }

      // Handle forum posts operations
      if (normalizedQuery.includes('forum_posts')) {
        if (normalizedQuery.startsWith('insert')) {
          // The ID is passed as the first value but not used in GraphQL API
          const parentId = values?.[2] !== undefined && values?.[2] !== null ? String(values?.[2]) : undefined;
          const postData: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'> = {
            threadId: String(values?.[1] ?? ''),
            authorAddress: String(values?.[3] ?? ''),
            content: String(values?.[4] ?? ''),
            attachments: [],
            metadata: {},
            editedAt: null,
            upvotes: 0,
            downvotes: 0,
            isAcceptedAnswer: false,
            isDeleted: false,
            ...(parentId !== undefined && { parentId }),
          };
          await this.apiClient.createForumPost(postData);
          return {
            rows: [],
            rowCount: 1,
            command: 'INSERT',
          };
        }
      }

      // Handle support operations
      if (normalizedQuery.includes('support_requests')) {
        if (normalizedQuery.startsWith('insert')) {
          // Support service doesn't return the created request, just stores it
          // We don't need to call the API here since the support service
          // generates its own IDs and manages its own state
          return {
            rows: [],
            rowCount: 1,
            command: 'INSERT',
          };
        }
      }

      // Handle support sessions
      if (normalizedQuery.includes('support_sessions')) {
        if (normalizedQuery.startsWith('insert')) {
          // Support service manages its own sessions
          return {
            rows: [],
            rowCount: 1,
            command: 'INSERT',
          };
        }
      }

      // Handle support volunteers
      if (normalizedQuery.includes('support_volunteers')) {
        if (normalizedQuery.startsWith('insert')) {
          // Support service manages its own volunteers
          return {
            rows: [],
            rowCount: 1,
            command: 'INSERT',
          };
        }

        if (normalizedQuery.startsWith('select')) {
          // Return empty for volunteer queries
          return {
            rows: [],
            rowCount: 0,
            command: 'SELECT',
          };
        }
      }

      // Default fallback for unhandled queries
      logger.warn('Unhandled query in APIToDBAdapter', { text });
      return {
        rows: [],
        rowCount: 0,
        command: 'UNKNOWN',
      };
    } catch (error) {
      logger.error('APIToDBAdapter query error', { text, error });
      throw error;
    }
  }

  /**
   * Begin transaction (no-op for API adapter)
   */
  async beginTransaction(): Promise<void> {
    // No-op - API handles transactions internally
  }

  /**
   * Commit transaction (no-op for API adapter)
   */
  async commitTransaction(): Promise<void> {
    // No-op - API handles transactions internally
  }

  /**
   * Rollback transaction (no-op for API adapter)
   */
  async rollbackTransaction(): Promise<void> {
    // No-op - API handles transactions internally
  }

  /**
   * Transaction wrapper (executes function immediately)
   * @param fn - Function to execute within transaction context
   * @returns Result of the function execution
   */
  async transaction<T>(fn: (client: APIToDBAdapter) => Promise<T>): Promise<T> {
    // Execute immediately - API handles transactions
    return fn(this);
  }

  /**
   * Close connection (no-op for API adapter)
   */
  async close(): Promise<void> {
    // No-op - API client manages its own connections
  }
}