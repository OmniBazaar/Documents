/**
 * Database Service
 *
 * Provides database connectivity and query execution for the Documents module.
 * Wraps the YugabyteDB PostgreSQL client with proper type safety and error handling.
 *
 * @module Database
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../../utils/logger';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Database host */
  host: string;
  /** Database port */
  port: number;
  /** Database name */
  database: string;
  /** Database user */
  user: string;
  /** Database password */
  password: string;
  /** Maximum number of connections in pool */
  max?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMillis?: number;
  /** Idle timeout in milliseconds */
  idleTimeoutMillis?: number;
}

/**
 * Database query result with proper typing
 */
export interface TypedQueryResult<T = unknown> extends QueryResult {
  /** Query result rows */
  rows: T[];
}

/**
 * Database service for YugabyteDB connections
 */
export class Database {
  /** Connection pool instance */
  private pool: Pool;

  /**
   * Creates a new Database instance
   * @param config - Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      ...config,
      max: config.max ?? 20,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 30000,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    });

    // Handle pool errors
    this.pool.on('error', err => {
      logger.error('Database pool error:', err);
    });
  }

  /**
   * Executes a database query
   * @param text - SQL query text
   * @param params - Query parameters
   * @returns Query result
   * @throws {Error} If query fails
   */
  async query<T = unknown>(text: string, params?: unknown[]): Promise<TypedQueryResult<T>> {
    const start = Date.now();
    let client: PoolClient | undefined;

    try {
      client = await this.pool.connect();
      const result = (await client.query(text, params)) as TypedQueryResult<T>;
      const duration = Date.now() - start;

      logger.debug('Database query executed', {
        text: text.substring(0, 100),
        duration,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        text: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (client !== undefined) {
        client.release();
      }
    }
  }

  /**
   * Begins a database transaction
   * @returns Transaction client
   */
  async beginTransaction(): Promise<PoolClient> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commits a database transaction
   * @param client - Transaction client
   */
  async commitTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  /**
   * Rolls back a database transaction
   * @param client - Transaction client
   */
  async rollbackTransaction(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  /**
   * Executes a transaction with automatic rollback on error
   * @param fn - Transaction function
   * @returns Transaction result
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.beginTransaction();

    try {
      const result = await fn(client);
      await this.commitTransaction(client);
      return result;
    } catch (error) {
      await this.rollbackTransaction(client);
      throw error;
    }
  }

  /**
   * Checks database connectivity
   * @returns True if connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets database statistics
   * @returns Database statistics
   */
  getStats(): {
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
  } {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingConnections: this.pool.waitingCount,
    };
  }

  /**
   * Closes all database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connections closed');
  }
}
