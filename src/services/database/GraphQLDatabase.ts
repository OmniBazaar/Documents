/**
 * GraphQL Database Implementation
 *
 * Implements the Database interface using GraphQL API calls to the Validator.
 * This replaces direct SQL queries with GraphQL operations, maintaining
 * compatibility with existing services while using the Validator's GraphQL API.
 *
 * @module GraphQLDatabase
 */

import { logger } from '../../utils/logger';
import { DocumentsGraphQLClient } from '../../api/graphqlClient';
import type { DatabaseConfig, TypedQueryResult } from './Database';
import type { Document } from '../../api/graphqlClient';
import type { ForumThread, ForumPost } from '../../api/graphqlClient';
import type { SupportRequest } from '../../api/graphqlClient';

/**
 * GraphQL implementation of the Database interface
 * Translates SQL queries to GraphQL operations
 */
export class GraphQLDatabase {
  /** GraphQL client instance */
  private client: DocumentsGraphQLClient;

  /**
   * Creates a new GraphQL database instance
   * @param config - Database configuration (endpoint used for GraphQL)
   */
  constructor(config: DatabaseConfig) {
    // Use the host as GraphQL endpoint
    const endpoint = `http://${config.host}:${config.port}/graphql`;
    this.client = new DocumentsGraphQLClient(endpoint);
  }

  /**
   * Executes a query using GraphQL instead of SQL
   * Parses the SQL query and converts it to appropriate GraphQL operations
   *
   * @param text - SQL query text
   * @param values - Query parameter values
   * @returns Query result
   */
  async query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    const startTime = Date.now();

    try {
      // Normalize query for parsing
      const normalizedQuery = text.toLowerCase().trim();

      // Handle different query types
      if (normalizedQuery.startsWith('select')) {
        return await this.handleSelect<T>(text, values);
      } else if (normalizedQuery.startsWith('insert')) {
        return await this.handleInsert<T>(text, values);
      } else if (normalizedQuery.startsWith('update')) {
        return await this.handleUpdate<T>(text, values);
      } else if (normalizedQuery.startsWith('delete')) {
        return await this.handleDelete<T>(text, values);
      } else if (normalizedQuery.includes('drop table')) {
        // Handle DROP TABLE for test cleanup
        return {
          rows: [],
          rowCount: 0,
          command: 'DROP',
          oid: 0,
          fields: [],
        };
      } else if (normalizedQuery.includes('create table')) {
        // Handle CREATE TABLE for test setup
        return {
          rows: [],
          rowCount: 0,
          command: 'CREATE',
          oid: 0,
          fields: [],
        };
      } else {
        throw new Error(`Unsupported query type: ${text.substring(0, 50)}`);
      }
    } catch (error) {
      logger.error('GraphQL query execution failed', {
        query: text.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Handles SELECT queries by converting to GraphQL queries
   */
  private async handleSelect<T>(
    text: string,
    values?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    const normalizedQuery = text.toLowerCase();

    // Handle documents queries
    if (normalizedQuery.includes('from documents')) {
      if (normalizedQuery.includes('where id =')) {
        // Get single document
        const id = String(values?.[0] ?? '');
        logger.debug('GraphQLDatabase: Getting document by ID', { id });
        try {
          const document = await this.client.getDocument(id);
          logger.debug('GraphQLDatabase: Document retrieved', { document: document ? 'found' : 'not found', id });
          return {
            rows: document ? [document as T] : [],
            rowCount: document ? 1 : 0,
            command: 'SELECT',
            oid: 0,
            fields: [],
          };
        } catch (error) {
          logger.error('GraphQLDatabase: Error getting document', { id, error });
          throw error;
        }
      } else {
        // Search documents
        const filters = this.extractDocumentFilters(text, values);
        logger.debug('GraphQLDatabase: Extracted filters', { filters, text, values });
        const result = await this.client.searchDocuments(filters);
        return {
          rows: result.items as T[],
          rowCount: result.items.length,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
    }

    // Handle forum threads queries
    if (normalizedQuery.includes('from forum_threads')) {
      if (normalizedQuery.includes('where id =')) {
        // Get single thread
        const id = String(values?.[0] ?? '');
        const thread = await this.client.getForumThread(id);
        return {
          rows: thread ? [thread as T] : [],
          rowCount: thread ? 1 : 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      } else {
        // Search threads
        const filters = this.extractForumFilters(text, values);
        const result = await this.client.searchForumThreads(filters);
        return {
          rows: result.items as T[],
          rowCount: result.items.length,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
    }

    // Handle forum posts queries
    if (normalizedQuery.includes('from forum_posts')) {
      if (normalizedQuery.includes('where thread_id =')) {
        // Get posts for thread
        const threadId = String(values?.[0] ?? '');
        const posts = await this.client.getThreadPosts(threadId);
        return {
          rows: posts as T[],
          rowCount: posts.length,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
    }

    // Handle support requests queries
    if (normalizedQuery.includes('from support_requests')) {
      if (normalizedQuery.includes('where id =')) {
        // Get single request
        const id = String(values?.[0] ?? '');
        const request = await this.client.getSupportRequest(id);
        return {
          rows: request ? [request as T] : [],
          rowCount: request ? 1 : 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
    }

    // Default: return empty result
    logger.warn('Unhandled SELECT query', { query: text.substring(0, 100) });
    return {
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    };
  }

  /**
   * Handles INSERT queries by converting to GraphQL mutations
   */
  private async handleInsert<T>(
    text: string,
    values?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    const normalizedQuery = text.toLowerCase();

    // Handle document inserts
    if (normalizedQuery.includes('into documents')) {
      const document = this.extractDocumentFromInsert(values);
      // Extract only the fields that CreateDocumentInput expects
      // Don't send ID if it's null - let server generate it
      const input: Record<string, unknown> = {
        title: document.title,
        description: document.description,
        content: document.content,
        category: document.category,
        authorAddress: document.authorAddress,
        tags: document.tags,
        language: document.language,
        isOfficial: document.isOfficial,
        metadata: document.metadata,
      };

      // Check if ID is provided in values (first parameter of INSERT)
      if (values?.[0] && values[0] !== null) {
        input.id = String(values[0]);
      }
      const created = await this.client.createDocument(input);
      logger.debug('GraphQLDatabase: Document created', {
        hasCreated: created !== null && created !== undefined,
        createdId: created?.id,
        inputId: input.id
      });
      return {
        rows: [created as T],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      };
    }

    // Handle forum thread inserts
    if (normalizedQuery.includes('into forum_threads')) {
      const thread = this.extractThreadFromInsert(values);
      // Extract only the fields that CreateForumThreadInput expects
      const input: Record<string, unknown> = {
        title: thread.title,
        category: thread.category,
        authorAddress: thread.authorAddress,
        tags: thread.tags,
        metadata: thread.metadata,
      };
      // Don't include ID - let the server generate it
      // The GraphQL server will create the ID and return it
      const created = await this.client.createForumThread(input);
      return {
        rows: [created as T],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      };
    }

    // Handle forum post inserts
    if (normalizedQuery.includes('into forum_posts')) {
      const post = this.extractPostFromInsert(values);
      // Extract only the fields that CreateForumPostInput expects
      const input = {
        threadId: post.threadId,
        authorAddress: post.authorAddress,
        content: post.content,
        parentId: post.parentId,
        attachments: post.attachments,
        metadata: post.metadata,
      };
      const created = await this.client.createForumPost(input);
      return {
        rows: [created as T],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      };
    }

    // Handle support request inserts
    if (normalizedQuery.includes('into support_requests')) {
      const request = this.extractSupportRequestFromInsert(values);
      // Extract only the fields that CreateSupportRequestInput expects
      const input = {
        userAddress: request.userAddress,
        category: request.category,
        priority: request.priority,
        initialMessage: request.initialMessage,
        language: request.language,
        metadata: request.metadata,
      };
      const created = await this.client.createSupportRequest(input);
      return {
        rows: [created as T],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      };
    }

    // Default: return empty result
    logger.warn('Unhandled INSERT query', { query: text.substring(0, 100) });
    return {
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      oid: 0,
      fields: [],
    };
  }

  /**
   * Handles UPDATE queries by converting to GraphQL mutations
   */
  private async handleUpdate<T>(
    text: string,
    values?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    const normalizedQuery = text.toLowerCase();

    // Handle document updates
    if (normalizedQuery.includes('update documents')) {
      const updates = this.extractDocumentUpdates(text, values);
      if (updates.id) {
        const id = String(updates.id);
        // Remove id from updates to pass to mutation
        const { id: _, ...updateInput } = updates;
        const updated = await this.client.updateDocument(id, updateInput);
        return {
          rows: [updated as T],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: [],
        };
      }
    }

    // Handle forum thread updates
    if (normalizedQuery.includes('update forum_threads')) {
      // TODO: Implement updateForumThread in GraphQL client
      // For now, return empty result to avoid errors
      return {
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      };
    }

    // Default: return empty result
    logger.warn('Unhandled UPDATE query', { query: text.substring(0, 100) });
    return {
      rows: [],
      rowCount: 0,
      command: 'UPDATE',
      oid: 0,
      fields: [],
    };
  }

  /**
   * Handles DELETE queries
   */
  private async handleDelete<T>(
    _text: string,
    _values?: unknown[]
  ): Promise<TypedQueryResult<T>> {
    // Most deletes are soft deletes handled by UPDATE
    return {
      rows: [],
      rowCount: 0,
      command: 'DELETE',
      oid: 0,
      fields: [],
    };
  }

  /**
   * Begins a transaction (no-op for GraphQL)
   */
  async begin(): Promise<void> {
    // GraphQL doesn't support transactions
    logger.debug('GraphQL transaction begin (no-op)');
  }

  /**
   * Commits a transaction (no-op for GraphQL)
   */
  async commit(): Promise<void> {
    // GraphQL doesn't support transactions
    logger.debug('GraphQL transaction commit (no-op)');
  }

  /**
   * Rolls back a transaction (no-op for GraphQL)
   */
  async rollback(): Promise<void> {
    // GraphQL doesn't support transactions
    logger.debug('GraphQL transaction rollback (no-op)');
  }

  /**
   * Closes the database connection
   */
  async close(): Promise<void> {
    // GraphQL client doesn't need explicit closing
    logger.info('GraphQL database connection closed');
  }

  /**
   * Helper methods for extracting data from SQL queries
   */

  private extractDocumentFilters(text: string, values?: unknown[]): Record<string, unknown> {
    const filters: Record<string, unknown> = {};

    // Parse the WHERE clause to extract filters
    const whereMatch = text.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|\s*$)/i);
    if (!whereMatch || !values) {
      return filters;
    }

    const whereClause = whereMatch[1];

    // Extract text search pattern (ILIKE conditions)
    // Look for patterns like: title ILIKE $1 OR description ILIKE $1
    const ilikeMatches = whereClause ? whereClause.match(/ilike\s+\$(\d+)/gi) : null;
    if (ilikeMatches && ilikeMatches.length > 0) {
      // Get the parameter index from the first ILIKE match
      const firstMatch = ilikeMatches[0].match(/\$(\d+)/);
      if (firstMatch && firstMatch[1]) {
        const paramIndex = parseInt(firstMatch[1]) - 1;
        const searchValue = values[paramIndex];
        if (searchValue !== undefined) {
          const searchStr = String(searchValue);
          // Remove SQL wildcards if present
          if (searchStr.startsWith('%') && searchStr.endsWith('%')) {
            filters.query = searchStr.slice(1, -1);
          } else if (searchStr.startsWith('%')) {
            filters.query = searchStr.slice(1);
          } else if (searchStr.endsWith('%')) {
            filters.query = searchStr.slice(0, -1);
          } else {
            filters.query = searchStr;
          }
        }
      }
    }

    // Extract category filter
    const categoryMatch = whereClause ? whereClause.match(/category\s*=\s*\$(\d+)/i) : null;
    if (categoryMatch && categoryMatch[1]) {
      const paramIndex = parseInt(categoryMatch[1]) - 1;
      if (values[paramIndex] !== undefined) {
        const category = String(values[paramIndex]);
        // Map category from lowercase to uppercase for GraphQL
        const categoryMap: Record<string, string> = {
          'getting_started': 'TUTORIALS',
          'wallet': 'GUIDES',
          'marketplace': 'MARKETPLACE',
          'dex': 'GUIDES',
          'technical': 'API_REFERENCE',
          'faq': 'FAQ',
          'governance': 'COMMUNITY',
          'security': 'GUIDES',
          'best_practices': 'GUIDES',
          'troubleshooting': 'TROUBLESHOOTING',
          'api': 'API_REFERENCE',
          'legal': 'LEGAL',
        };
        filters.category = categoryMap[category] ?? category.toUpperCase();
      }
    }

    // Extract author address filter
    const authorMatch = whereClause ? whereClause.match(/author_address\s*=\s*\$(\d+)/i) : null;
    if (authorMatch && authorMatch[1]) {
      const paramIndex = parseInt(authorMatch[1]) - 1;
      if (values[paramIndex] !== undefined) {
        filters.authorAddress = values[paramIndex];
      }
    }

    // Extract limit and offset
    const limitMatch = text.match(/limit (\$\d+|\d+)/i);
    const offsetMatch = text.match(/offset (\$\d+|\d+)/i);

    if (limitMatch && limitMatch[1]) {
      const limitParam = limitMatch[1];
      if (limitParam.startsWith('$')) {
        const index = parseInt(limitParam.substring(1)) - 1;
        filters.pageSize = values?.[index] ?? 10;
      } else {
        filters.pageSize = parseInt(limitParam);
      }
    }

    if (offsetMatch && offsetMatch[1]) {
      const offsetParam = offsetMatch[1];
      if (offsetParam.startsWith('$')) {
        const index = parseInt(offsetParam.substring(1)) - 1;
        const offset = values?.[index] ?? 0;
        filters.page = Math.floor(Number(offset) / Number(filters.pageSize ?? 10)) + 1;
      }
    }

    return filters;
  }

  private extractForumFilters(text: string, values?: unknown[]): Record<string, unknown> {
    const filters: Record<string, unknown> = {};

    if (text.includes('category =') && values?.[0]) {
      filters.category = values[0];
    }

    if (text.includes('author_address =') && values?.[0]) {
      filters.authorAddress = values[0];
    }

    return filters;
  }

  private extractDocumentFromInsert(values?: unknown[]): Omit<Document, 'id' | 'createdAt' | 'updatedAt'> {
    // Map values based on typical INSERT column order
    // Map category from lowercase to uppercase for GraphQL
    const categoryMap: Record<string, string> = {
      'getting_started': 'TUTORIALS',
      'wallet': 'GUIDES',
      'marketplace': 'MARKETPLACE',
      'dex': 'GUIDES',
      'technical': 'API_REFERENCE',
      'faq': 'FAQ',
      'governance': 'COMMUNITY',
      'security': 'GUIDES',
      'best_practices': 'GUIDES',
      'troubleshooting': 'TROUBLESHOOTING',
      'api': 'API_REFERENCE',
      'legal': 'LEGAL',
    };

    const category = String(values?.[4] ?? 'GENERAL');
    const mappedCategory = categoryMap[category] ?? 'GENERAL';

    return {
      title: String(values?.[1] ?? ''),
      description: String(values?.[2] ?? ''),
      content: String(values?.[3] ?? ''),
      category: mappedCategory as any,
      authorAddress: String(values?.[7] ?? ''),
      tags: values?.[8] as string[] ?? [],
      language: values?.[5] as any ?? 'en',
      version: Number(values?.[6] ?? 1),
      viewCount: 0,
      rating: null,
      ipfsHash: null,
      isOfficial: Boolean(values?.[9] ?? false),
      status: values?.[11] as any ?? 'draft',
      metadata: values?.[12] ? JSON.parse(String(values[12])) : {},
      publishedAt: null,
    };
  }

  private extractThreadFromInsert(values?: unknown[]): Omit<ForumThread, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      title: String(values?.[1] ?? ''),
      category: String(values?.[2] ?? ''),
      authorAddress: String(values?.[3] ?? ''),
      viewCount: 0,
      replyCount: 0,
      lastReplyAt: Date.now(),
      isPinned: false,
      isLocked: false,
      tags: [],
      metadata: {},
    };
  }

  private extractPostFromInsert(values?: unknown[]): Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'> {
    const post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'> = {
      threadId: String(values?.[1] ?? ''),
      authorAddress: String(values?.[3] ?? ''),
      content: String(values?.[4] ?? ''),
      parentId: '',  // Default to empty string
      editedAt: null,
      upvotes: 0,
      downvotes: 0,
      isAcceptedAnswer: false,
      isDeleted: false,
      attachments: [],
      metadata: {},
    };

    // Only set parentId if it exists
    if (values?.[2]) {
      post.parentId = String(values[2]);
    }

    return post;
  }

  private extractSupportRequestFromInsert(values?: unknown[]): Omit<SupportRequest, 'id' | 'createdAt'> {
    return {
      userAddress: String(values?.[1] ?? ''),
      category: values?.[2] as any,
      priority: values?.[3] as any,
      status: 'waiting',
      initialMessage: String(values?.[4] ?? ''),
      language: values?.[5] as any ?? 'en',
      userScore: Number(values?.[6] ?? 0),
      assignedVolunteer: null,
      resolvedAt: null,
      resolutionRating: null,
      metadata: {},
    };
  }

  private extractDocumentUpdates(text: string, values?: unknown[]): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    // Extract ID from WHERE clause
    const whereMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
    if (whereMatch && whereMatch[1] && values) {
      const idIndex = parseInt(whereMatch[1]) - 1;
      updates.id = values[idIndex];
    }

    // Extract SET fields
    const setMatch = text.match(/set\s+(.+?)\s+where/i);
    if (setMatch && setMatch[1] && values) {
      const setPart = setMatch[1];
      const fields = setPart.split(',').map(f => f.trim());

      fields.forEach(field => {
        const fieldMatch = field.match(/(\w+)\s*=\s*\$(\d+)/);
        if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
          const fieldName = fieldMatch[1];
          const valueIndex = parseInt(fieldMatch[2]) - 1;
          if (valueIndex >= 0 && valueIndex < values.length && values[valueIndex] !== undefined) {
            // Map database column names to GraphQL field names
            if (fieldName === 'ipfs_hash') {
              updates.ipfsHash = values[valueIndex];
            } else {
              updates[fieldName] = values[valueIndex];
            }
          }
        }
      });
    }

    return updates;
  }

}