/**
 * Shared types for cross-module integration
 * These types are duplicated across modules to avoid direct source dependencies
 */

/**
 * Database interface for cross-module integration
 */
export interface IDatabase {
  query(sql: string, params?: unknown[]): Promise<unknown>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Participation score interface for cross-module integration
 */
export interface IParticipationScoreService {
  calculateScore(userId: string): Promise<number>;
  updateScore(userId: string, component: string, value: number): Promise<void>;
  getScoreBreakdown(userId: string): Promise<Record<string, number>>;
}

/**
 * Validator client interface for cross-module integration
 */
export interface IValidatorClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(method: string, params: unknown[]): Promise<unknown>;
  subscribe(event: string, callback: (data: unknown) => void): void;
}

/**
 * Generic service response
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
