/**
 * Adapter to make DirectServiceCaller compatible with Database interface
 *
 * This adapter allows services that expect a Database instance to work
 * with the DirectServiceCaller in the direct integration architecture.
 *
 * @module adapters/DirectServiceToDatabase
 */

import type { TypedQueryResult } from '../services/database/Database';
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
export class DirectServiceToDatabase {
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
   * @param text - SQL query string
   * @param params - Query parameters
   * @returns Query results
   */
  async query<T = unknown>(text: string, params?: unknown[]): Promise<TypedQueryResult<T>> {
    const result = await this.serviceCaller.queryDatabase<T>(text, params);

    // Return a TypedQueryResult compatible object
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command !== null && result.command !== undefined && result.command !== '' ? result.command : 'SELECT',
      oid: 0,
      fields: []
    };
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
  getStats(): {
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
  } {
    return {
      totalConnections: 1, // Always 1 in direct mode
      idleConnections: 0,
      waitingConnections: 0
    };
  }

  /**
   * Close database connections (no-op in direct mode)
   */
  close(): void {
    logger.debug('Database close called (no-op in direct mode)');
  }
}