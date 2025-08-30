/**
 * Mock database implementation for testing and development
 * In production, this will be replaced with actual Validator database connection
 */

import { IDatabase } from '../../types/shared';

/**
 * Mock database implementation for Documents module
 */
export class MockDatabase implements IDatabase {
  private mockData: Map<string, unknown[]> = new Map();
  private transactionActive = false;

  /**
   * Creates a new MockDatabase instance with sample data
   */
  constructor() {
    // Initialize with some mock data
    this.mockData.set('documents', [
      { id: 1, title: 'Getting Started', content: 'Welcome to OmniBazaar', created: Date.now() },
      { id: 2, title: 'API Reference', content: 'API documentation', created: Date.now() },
    ]);

    this.mockData.set('users', [
      { userId: 'user1', username: 'testuser', score: 85 },
      { userId: 'user2', username: 'volunteer', score: 92 },
    ]);

    this.mockData.set('forum_posts', [
      { id: 1, userId: 'user1', title: 'Welcome', content: 'First post', votes: 5 },
    ]);
  }

  /**
   * Execute a query and return results
   * @param sql - SQL query to execute
   * @param _params - Query parameters (unused in mock)
   * @returns Query results
   */
  async query(sql: string, _params?: unknown[]): Promise<unknown> {
    // Simulate async database query
    await new Promise(resolve => setTimeout(resolve, 10));

    // Parse table name from SQL (simplified)
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (tableMatch !== null && tableMatch[1] !== undefined) {
      const tableName = tableMatch[1];
      const data = this.mockData.get(tableName);
      return data !== undefined ? data : [];
    }

    return [];
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   * @param _sql - SQL command to execute (unused in mock)
   * @param _params - Command parameters (unused in mock)
   * @returns Execution result
   */
  async execute(_sql: string, _params?: unknown[]): Promise<unknown> {
    // Simulate async database operation
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      affectedRows: 1,
      insertId: Math.floor(Math.random() * 1000),
    };
  }

  /**
   * Execute a transaction
   * @param fn - Transaction function
   * @returns Transaction result
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.transactionActive) {
      throw new Error('Transaction already in progress');
    }

    this.transactionActive = true;

    try {
      const result = await fn();
      this.transactionActive = false;
      return result;
    } catch (error) {
      this.transactionActive = false;
      throw error;
    }
  }
}
