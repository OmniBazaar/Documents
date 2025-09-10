/**
 * Database interface for Documents module
 * Provides a local interface to avoid importing from Validator module
 */

/**
 * Database query result interface
 * @template T The type of rows returned by the query
 */
export interface QueryResult<T = unknown> {
  /**
   * Array of result rows
   */
  rows: T[];
  /**
   * Number of rows returned
   */
  rowCount: number;
}

/**
 * Database interface for executing queries
 * Provides methods for database operations
 */
export interface Database {
  /**
   * Execute a query with parameters
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query result
   */
  query<T = unknown>(query: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Check if database is connected
   * @returns Connection status
   */
  isConnected(): boolean;
}

