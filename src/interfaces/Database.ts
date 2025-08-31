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

/**
 * Mock database implementation for development/testing
 * Used when actual database connection is not available
 */
export class MockDatabase implements Database {
  private connected = true;

  /**
   * Execute a mock query
   * @param _query - SQL query string (unused in mock)
   * @param _params - Query parameters (unused in mock)
   * @returns Mock query result with empty rows
   */
  query<T = unknown>(_query: string, _params?: unknown[]): Promise<QueryResult<T>> {
    return Promise.resolve({
      rows: [],
      rowCount: 0,
    });
  }

  /**
   * Check if mock database is connected
   * @returns Always returns true
   */
  isConnected(): boolean {
    return this.connected;
  }
}
