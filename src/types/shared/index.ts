/**
 * Shared types for cross-module integration
 * These types are duplicated across modules to avoid direct source dependencies
 */

/**
 * Database interface for cross-module integration
 */
export interface IDatabase {
  /**
   * Execute a SQL query and return results
   * @param sql - SQL query string
   * @param params - Optional query parameters
   * @returns Promise resolving to query results
   */
  query(sql: string, params?: unknown[]): Promise<unknown>;
  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   * @param sql - SQL statement string
   * @param params - Optional statement parameters
   * @returns Promise resolving to execution results
   */
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  /**
   * Execute operations within a database transaction
   * @param fn - Function containing database operations to execute in transaction
   * @returns Promise resolving to transaction result
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Participation score interface for cross-module integration
 */
export interface IParticipationScoreService {
  /**
   * Calculate total participation score for a user
   * @param userId - User identifier
   * @returns Promise resolving to calculated score
   */
  calculateScore(userId: string): Promise<number>;
  /**
   * Update a specific score component for a user
   * @param userId - User identifier
   * @param component - Score component name
   * @param value - New component value
   */
  updateScore(userId: string, component: string, value: number): Promise<void>;
  /**
   * Get detailed breakdown of user's participation score components
   * @param userId - User identifier
   * @returns Promise resolving to score breakdown by component
   */
  getScoreBreakdown(userId: string): Promise<Record<string, number>>;
}

/**
 * Validator client interface for cross-module integration
 */
export interface IValidatorClient {
  /**
   * Establish connection to validator network
   * @returns Promise that resolves when connection is established
   */
  connect(): Promise<void>;
  /**
   * Disconnect from validator network
   * @returns Promise that resolves when disconnection is complete
   */
  disconnect(): Promise<void>;
  /**
   * Send RPC request to validator network
   * @param method - RPC method name
   * @param params - Method parameters
   * @returns Promise resolving to method response
   */
  sendRequest(method: string, params: unknown[]): Promise<unknown>;
  /**
   * Subscribe to validator network events
   * @param event - Event type to subscribe to
   * @param callback - Callback function for event data
   */
  subscribe(event: string, callback: (data: unknown) => void): void;
}

/**
 * Generic service response
 */
export interface ServiceResponse<T> {
  /**
   * Indicates if the service operation was successful
   */
  success: boolean;
  /**
   * Response data if operation was successful
   */
  data?: T;
  /**
   * Error message if operation failed
   */
  error?: string;
  /**
   * Unix timestamp when response was generated
   */
  timestamp: number;
}
