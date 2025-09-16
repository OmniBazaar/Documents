/**
 * Adapter to make DirectServiceCaller compatible with Database interface
 *
 * This adapter allows services that expect a Database instance to work
 * with the DirectServiceCaller in the direct integration architecture.
 *
 * @module adapters/DirectServiceToDatabase
 */

import type { Database } from '../services/database/Database';
import type { DirectServiceCaller } from '../services/DirectServiceCaller';
import { logger } from '../utils/logger';

/**
 * Adapts DirectServiceCaller to Database interface
 *
 * @example
 * ```typescript
 * const dbAdapter = new DirectServiceToDatabase(directServiceCaller);
 * const forum = new P2PForumService(dbAdapter, participationService);
 * ```
 */
export class DirectServiceToDatabase implements Database {
  /**
   * Creates adapter instance
   *
   * @param serviceCaller - Direct service caller to wrap
   */
  constructor(private serviceCaller: DirectServiceCaller) {
    logger.debug('Creating DirectServiceToDatabase adapter');
  }

  /**
   * Execute a database query
   *
   * @param sql - SQL query string
   * @param params - Query parameters
   * @returns Query results
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.serviceCaller.queryDatabase<T>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount
    };
  }

  /**
   * Connect to database (no-op for direct integration)
   *
   * @returns Resolves when connected
   */
  async connect(): Promise<void> {
    // No-op - connection managed by validator
    logger.debug('Database connect called (no-op in direct mode)');
  }

  /**
   * Disconnect from database (no-op for direct integration)
   *
   * @returns Resolves when disconnected
   */
  async disconnect(): Promise<void> {
    // No-op - connection managed by validator
    logger.debug('Database disconnect called (no-op in direct mode)');
  }

  /**
   * Execute multiple queries in a transaction
   *
   * @param queries - Array of SQL queries with optional parameters
   * @returns Combined results
   */
  async transaction(queries: Array<{ sql: string; params?: unknown[] }>): Promise<unknown[]> {
    // For now, execute queries sequentially
    // In a real implementation, this would use a database transaction
    const results = [];
    for (const query of queries) {
      const result = await this.query(query.sql, query.params);
      results.push(result);
    }
    return results;
  }

  /**
   * Check if database is connected
   *
   * @returns Always true in direct mode
   */
  isConnected(): boolean {
    return true; // Always connected in direct mode
  }

  /**
   * Get database statistics
   *
   * @returns Database statistics
   */
  async getStats(): Promise<{ connections: number; queries: number }> {
    return {
      connections: 1, // Always 1 in direct mode
      queries: 0 // Would need to track in serviceCaller
    };
  }
}