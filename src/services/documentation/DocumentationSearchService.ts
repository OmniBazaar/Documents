/**
 * Documentation Search Service
 * 
 * Provides full-text search capabilities for documentation
 * using PostgreSQL's built-in search features.
 * 
 * @module DocumentationSearchService
 */

import { Database } from '../database/Database';
import { logger } from '../../utils/logger';

/**
 * Search options
 */
export interface SearchOptions {
  /** Search query */
  query: string;
  /** Categories to filter by */
  categories?: string[];
  /** Languages to filter by */
  languages?: string[];
  /** Tags to filter by */
  tags?: string[];
  /** Maximum results */
  limit?: number;
  /** Result offset for pagination */
  offset?: number;
  /** Sort order */
  sortBy?: 'relevance' | 'date' | 'rating';
}

/**
 * Search result
 */
export interface SearchResult {
  /** Document ID */
  id: string;
  /** Document title */
  title: string;
  /** Content snippet */
  snippet: string;
  /** Category */
  category: string;
  /** Language */
  language: string;
  /** Tags */
  tags: string[];
  /** Author */
  author: string;
  /** Average rating */
  rating: number;
  /** Relevance score */
  relevance: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Documentation Search Service
 */
export class DocumentationSearchService {
  /**
   * Creates a new Documentation Search Service
   * @param {Database} db - Database instance
   */
  constructor(private db: Database) {}

  /**
   * Searches documentation
   * @param {SearchOptions} options - Search options
   * @returns {Promise<SearchResult[]>} Search results
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      categories = [],
      languages = [],
      tags = [],
      limit = 20,
      offset = 0,
      sortBy = 'relevance'
    } = options;

    try {
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      // Full-text search
      if (query !== '') {
        conditions.push(`
          (setweight(to_tsvector('english', d.title), 'A') ||
           setweight(to_tsvector('english', d.content), 'B') ||
           setweight(to_tsvector('english', array_to_string(d.tags, ' ')), 'C'))
          @@ plainto_tsquery('english', $${paramIndex})
        `);
        params.push(query);
        paramIndex++;
      }

      // Category filter
      if (categories.length > 0) {
        conditions.push(`d.category = ANY($${paramIndex})`);
        params.push(categories);
        paramIndex++;
      }

      // Language filter
      if (languages.length > 0) {
        conditions.push(`d.language = ANY($${paramIndex})`);
        params.push(languages);
        paramIndex++;
      }

      // Tags filter
      if (tags.length > 0) {
        conditions.push(`d.tags && $${paramIndex}`);
        params.push(tags);
        paramIndex++;
      }

      // Build query
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const orderByClause = sortBy === 'date' 
        ? 'ORDER BY d.updated_at DESC'
        : sortBy === 'rating'
        ? 'ORDER BY avg_rating DESC NULLS LAST'
        : query !== ''
        ? `ORDER BY ts_rank(
            setweight(to_tsvector('english', d.title), 'A') ||
            setweight(to_tsvector('english', d.content), 'B') ||
            setweight(to_tsvector('english', array_to_string(d.tags, ' ')), 'C'),
            plainto_tsquery('english', '${query}')
          ) DESC`
        : 'ORDER BY d.created_at DESC';

      const sql = `
        SELECT 
          d.id,
          d.title,
          substring(d.content, 1, 200) as snippet,
          d.category,
          d.language,
          d.tags,
          d.author,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          ${query !== '' ? `ts_rank(
            setweight(to_tsvector('english', d.title), 'A') ||
            setweight(to_tsvector('english', d.content), 'B') ||
            setweight(to_tsvector('english', array_to_string(d.tags, ' ')), 'C'),
            plainto_tsquery('english', '${query}')
          )` : '1'} as relevance,
          d.updated_at
        FROM documentation_pages d
        LEFT JOIN documentation_ratings r ON d.id = r.page_id
        ${whereClause}
        GROUP BY d.id
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await this.db.query(sql, params);

      return result.rows.map(row => ({
        id: row.id as string,
        title: row.title as string,
        snippet: row.snippet as string,
        category: row.category as string,
        language: row.language as string,
        tags: row.tags as string[],
        author: row.author as string,
        rating: parseFloat(row.avg_rating as string),
        relevance: parseFloat(row.relevance as string),
        lastUpdated: row.updated_at as Date
      }));

    } catch (error) {
      logger.error('Documentation search failed:', error);
      throw error;
    }
  }

  /**
   * Indexes a document for search
   * @param {string} documentId - Document ID
   */
  indexDocument(documentId: string): void {
    // PostgreSQL automatically updates the tsvector indexes
    // This method is here for future enhancements
    logger.debug(`Document ${documentId} indexed for search`);
  }

  /**
   * Gets popular search terms
   * @param {number} limit - Maximum number of terms
   * @returns {Promise<Array<{term: string, count: number}>>} Popular search terms
   */
  async getPopularSearches(limit = 10): Promise<Array<{term: string, count: number}>> {
    try {
      const result = await this.db.query(`
        SELECT search_term, COUNT(*) as count
        FROM search_history
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY search_term
        ORDER BY count DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        term: row.search_term as string,
        count: parseInt(row.count as string)
      }));

    } catch (error) {
      logger.error('Failed to get popular searches:', error);
      return [];
    }
  }

  /**
   * Records a search query
   * @param {string} query - Search query
   * @param {string} userId - User ID
   * @param {number} resultCount - Number of results
   */
  async recordSearch(query: string, userId: string, resultCount: number): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO search_history (search_term, user_id, result_count)
        VALUES ($1, $2, $3)
      `, [query, userId, resultCount]);
    } catch (error) {
      logger.error('Failed to record search:', error);
    }
  }
}