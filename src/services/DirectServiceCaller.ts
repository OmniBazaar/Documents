/**
 * Direct Service Caller
 *
 * Replaces API-based communication with direct service method calls.
 * Provides a compatible interface to existing code while using direct
 * access to Validator services.
 *
 * @module services/DirectServiceCaller
 */

import { logger } from '../utils/logger';
import type { ValidatorServices } from '../integration/DirectValidatorIntegration';
import type { Document, DocumentSearchParams } from './documentation/DocumentationService';
import type { ForumThread } from './forum/ForumTypes';
// import type { SupportRequest } from './support/SupportTypes'; // Currently unused

/**
 * Query result type matching database interface
 */
export interface QueryResult<T = unknown> {
  /** Result rows */
  rows: T[];
  /** Number of rows affected */
  rowCount: number;
  /** SQL command executed */
  command: string;
}

/**
 * Direct service response wrapper
 */
export interface ServiceResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if request failed */
  error?: string;
}

/**
 * Direct Service Caller
 *
 * @example
 * ```typescript
 * const caller = new DirectServiceCaller(validatorServices);
 *
 * // Direct database query
 * const users = await caller.queryDatabase<User>(
 *   'SELECT * FROM users WHERE active = $1',
 *   [true]
 * );
 *
 * // Direct service method call
 * const score = await caller.getParticipationScore(userId);
 * ```
 */
export class DirectServiceCaller {
  private validatorServices: ValidatorServices;
  private callMetrics: Map<string, { count: number; totalTime: number }> = new Map();

  /**
   * Creates a new Direct Service Caller
   *
   * @param validatorServices - Validator services for direct access
   */
  constructor(validatorServices: ValidatorServices) {
    this.validatorServices = validatorServices;
  }

  /**
   * Executes a database query directly
   *
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query result
   */
  async queryDatabase<T = unknown>(query: string, params?: unknown[]): Promise<QueryResult<T>> {
    const start = Date.now();
    const metricKey = 'database.query';

    try {
      const result = await this.validatorServices.database.query<T>(query, params);

      // Record metrics
      this.recordMetric(metricKey, Date.now() - start);

      // Ensure result matches expected format
      if (this.isQueryResult<T>(result)) {
        return result;
      }

      // Convert if needed
      return {
        rows: Array.isArray(result) ? result : [result],
        rowCount: Array.isArray(result) ? result.length : 1,
        command: (query.split(' ')[0] ?? 'SELECT').toUpperCase()
      };
    } catch (error) {
      logger.error('Direct database query failed', {
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start
      });
      throw error;
    }
  }

  /**
   * Gets user participation score directly
   *
   * @param userId - User ID
   * @returns User's participation score
   */
  async getParticipationScore(userId: string): Promise<number> {
    const start = Date.now();
    const metricKey = 'participation.getScore';

    try {
      const score = await this.validatorServices.participationScore.getUserScore(userId);
      this.recordMetric(metricKey, Date.now() - start);
      return score;
    } catch (error) {
      logger.error('Failed to get participation score', { userId, error });
      throw error;
    }
  }

  /**
   * Updates user participation score directly
   *
   * @param userId - User ID
   * @param delta - Score change (positive or negative)
   */
  async updateParticipationScore(userId: string, delta: number): Promise<void> {
    const start = Date.now();
    const metricKey = 'participation.updateScore';

    try {
      await this.validatorServices.participationScore.updateScore(userId, delta);
      this.recordMetric(metricKey, Date.now() - start);
    } catch (error) {
      logger.error('Failed to update participation score', { userId, delta, error });
      throw error;
    }
  }

  /**
   * Gets current blockchain height
   *
   * @returns Current block height
   */
  async getBlockHeight(): Promise<number> {
    if (this.validatorServices.blockchain === undefined) {
      throw new Error('Blockchain service not available');
    }

    const start = Date.now();
    const metricKey = 'blockchain.getHeight';

    try {
      const height = await this.validatorServices.blockchain.getBlockHeight();
      this.recordMetric(metricKey, Date.now() - start);
      return height;
    } catch (error) {
      logger.error('Failed to get block height', { error });
      throw error;
    }
  }

  /**
   * Adds content to IPFS
   *
   * @param content - Content to add
   * @returns IPFS hash
   */
  async ipfsAdd(content: string | Buffer): Promise<string> {
    if (this.validatorServices.ipfs === undefined) {
      throw new Error('IPFS service not available');
    }

    const start = Date.now();
    const metricKey = 'ipfs.add';

    try {
      const hash = await this.validatorServices.ipfs.add(content);
      this.recordMetric(metricKey, Date.now() - start);
      return hash;
    } catch (error) {
      logger.error('Failed to add to IPFS', { error });
      throw error;
    }
  }

  /**
   * Gets content from IPFS
   *
   * @param hash - IPFS hash
   * @returns Content buffer
   */
  async ipfsGet(hash: string): Promise<Buffer> {
    if (this.validatorServices.ipfs === undefined) {
      throw new Error('IPFS service not available');
    }

    const start = Date.now();
    const metricKey = 'ipfs.get';

    try {
      const content = await this.validatorServices.ipfs.get(hash);
      this.recordMetric(metricKey, Date.now() - start);
      return content;
    } catch (error) {
      logger.error('Failed to get from IPFS', { hash, error });
      throw error;
    }
  }

  /**
   * Wrapper methods for common database operations
   */

  /**
   * Creates a document record
   *
   * @param document - Document to create
   * @returns Created document with ID
   */
  async createDocument(document: Document): Promise<Document> {
    const query = `
      INSERT INTO documents (
        id, title, content, category, tags, language,
        author_address, version, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const now = new Date();
    const params = [
      document.id,
      document.title,
      document.content,
      document.category,
      document.tags !== null && document.tags !== undefined ? document.tags : [],
      document.language !== null && document.language !== undefined ? document.language : 'en',
      document.authorAddress,
      document.version !== null && document.version !== undefined && document.version !== 0 ? document.version : 1,
      document.status !== null && document.status !== undefined ? document.status : 'draft',
      document.createdAt !== null && document.createdAt !== undefined ? document.createdAt : now,
      document.updatedAt !== null && document.updatedAt !== undefined ? document.updatedAt : now
    ];

    const result = await this.queryDatabase<Document>(query, params);
    const createdDoc = result.rows[0];
    if (createdDoc === null || createdDoc === undefined) {
      throw new Error('Failed to create document - no result returned');
    }
    return createdDoc;
  }

  /**
   * Gets a document by ID
   *
   * @param documentId - Document ID
   * @returns Document or undefined
   */
  async getDocument(documentId: string): Promise<Document | undefined> {
    const query = 'SELECT * FROM documents WHERE id = $1';
    const result = await this.queryDatabase<Document>(query, [documentId]);
    return result.rows[0];
  }

  /**
   * Searches for documents
   *
   * @param params - Search parameters
   * @returns Document search results
   */
  async searchDocuments(params: DocumentSearchParams): Promise<{
    items: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    let query = 'SELECT * FROM documents WHERE 1=1';
    const queryParams: unknown[] = [];
    let paramCount = 0;

    // Build dynamic query
    if (params.query !== undefined && params.query !== '') {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
      queryParams.push(`%${params.query}%`);
    }

    if (params.filters?.category !== undefined) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      queryParams.push(params.filters.category);
    }

    if (params.filters?.authorAddress !== undefined) {
      paramCount++;
      query += ` AND author_address = $${paramCount}`;
      queryParams.push(params.filters.authorAddress);
    }

    // Count total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.queryDatabase<{ count: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.count !== null && countResult.rows[0]?.count !== undefined && countResult.rows[0]?.count !== '' ? countResult.rows[0].count : '0', 10);

    // Add pagination
    const page = params.page !== null && params.page !== undefined && params.page !== 0 ? params.page : 1;
    const pageSize = params.pageSize !== null && params.pageSize !== undefined && params.pageSize !== 0 ? params.pageSize : 20;
    const offset = (page - 1) * pageSize;

    paramCount++;
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    queryParams.push(pageSize);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(offset);

    // Get documents
    const result = await this.queryDatabase<Document>(query, queryParams);

    return {
      items: result.rows,
      total,
      page,
      pageSize
    };
  }

  /**
   * Creates a forum thread
   *
   * @param thread - Thread to create
   * @returns Created thread
   */
  async createForumThread(thread: ForumThread): Promise<ForumThread> {
    const query = `
      INSERT INTO forum_threads (
        id, title, content, category, author_address,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const now = new Date();
    const params = [
      thread.id,
      thread.title,
      '', // ForumThread doesn't have content property
      thread.category !== null && thread.category !== undefined && thread.category !== '' ? thread.category : 'general',
      thread.authorAddress,
      'active', // status is not a property of ForumThread
      thread.createdAt !== null && thread.createdAt !== undefined ? thread.createdAt : now,
      thread.updatedAt !== null && thread.updatedAt !== undefined ? thread.updatedAt : now
    ];

    const result = await this.queryDatabase<ForumThread>(query, params);
    const createdThread = result.rows[0];
    if (createdThread === null || createdThread === undefined) {
      throw new Error('Failed to create forum thread - no result returned');
    }
    return createdThread;
  }

  /**
   * Gets service call metrics
   *
   * @returns Metrics map
   */
  getMetrics(): Record<string, { count: number; averageTime: number }> {
    const metrics: Record<string, { count: number; averageTime: number }> = {};

    this.callMetrics.forEach((value, key) => {
      metrics[key] = {
        count: value.count,
        averageTime: value.totalTime / value.count
      };
    });

    return metrics;
  }

  /**
   * Resets metrics
   */
  resetMetrics(): void {
    this.callMetrics.clear();
  }

  /**
   * Type guard for QueryResult
   *
   * @param value - Value to check
   * @returns True if value is a QueryResult
   */
  private isQueryResult<T>(value: unknown): value is QueryResult<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'rows' in value &&
      'rowCount' in value &&
      Array.isArray((value as { rows: unknown }).rows)
    );
  }

  /**
   * Records a metric
   *
   * @param key - Metric key
   * @param duration - Duration in ms
   */
  private recordMetric(key: string, duration: number): void {
    const current = this.callMetrics.get(key) ?? { count: 0, totalTime: 0 };
    current.count++;
    current.totalTime += duration;
    this.callMetrics.set(key, current);
  }
}