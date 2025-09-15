/**
 * Validator API Client
 *
 * Handles all communication between Documents module and Validator module.
 * All database operations should go through this client to the Validator API.
 *
 * @module services/validator/ValidatorAPIClient
 */

import { logger } from '../../utils/logger';
import type { Document, DocumentCategory } from '../documentation/DocumentationService';
import type { ForumThread, ForumPost } from '../forum/ForumTypes';
import type { SupportRequest, SupportSession, SupportVolunteer } from '../support/SupportTypes';

/**
 * Validator API client configuration
 */
export interface ValidatorAPIConfig {
  /** Base URL of the Validator API */
  endpoint: string;
  /** API timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Initial delay between retries in ms */
    initialDelay: number;
    /** Maximum delay between retries in ms */
    maxDelay: number;
  };
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if request failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Client for communicating with the Validator API
 */
export class ValidatorAPIClient {
  private config: Required<ValidatorAPIConfig>;

  /**
   * Creates a new Validator API client
   * @param config - Client configuration
   */
  constructor(config: ValidatorAPIConfig) {
    this.config = {
      endpoint: config.endpoint,
      timeout: config.timeout ?? 30000,
      retry: config.retry ?? {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
      },
    };
  }

  /**
   * Makes an API request with retry logic
   * @param method - HTTP method
   * @param path - API path
   * @param data - Request data
   * @returns API response
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown
  ): Promise<APIResponse<T>> {
    const url = `${this.config.endpoint}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retry.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        };

        if (data !== undefined) {
          fetchOptions.body = JSON.stringify(data);
        }

        const response = await fetch(url, fetchOptions);

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return {
          success: true,
          data: result as T,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retry.maxRetries) {
          const delay = Math.min(
            this.config.retry.initialDelay * Math.pow(2, attempt),
            this.config.retry.maxDelay
          );

          logger.warn(`API request failed (attempt ${attempt + 1}), retrying in ${delay}ms`, {
            url,
            error: lastError.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('API request failed after all retries', {
      url,
      error: lastError?.message,
    });

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error',
    };
  }

  // Document operations

  /**
   * Creates a new document
   * @param document - Document data
   * @returns Created document
   */
  async createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const response = await this.request<Document>('POST', '/api/documents', document);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to create document');
    }

    return response.data;
  }

  /**
   * Gets a document by ID
   * @param id - Document ID
   * @returns Document or null if not found
   */
  async getDocument(id: string): Promise<Document | null> {
    const response = await this.request<Document>('GET', `/api/documents/${id}`);

    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  }

  /**
   * Updates a document
   * @param id - Document ID
   * @param updates - Document updates
   * @returns Updated document
   */
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const response = await this.request<Document>('PUT', `/api/documents/${id}`, updates);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to update document');
    }

    return response.data;
  }

  /**
   * Deletes a document
   * @param id - Document ID
   */
  async deleteDocument(id: string): Promise<void> {
    const response = await this.request<void>('DELETE', `/api/documents/${id}`);

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to delete document');
    }
  }

  /**
   * Searches documents
   * @param query - Search query
   * @param filters - Search filters
   * @returns Search results
   */
  async searchDocuments(query: string, filters?: {
    category?: DocumentCategory;
    tags?: string[];
    author?: string;
    language?: string;
  }): Promise<{ items: Document[]; total: number }> {
    const response = await this.request<{ items: Document[]; total: number }>(
      'POST',
      '/api/documents/search',
      { query, ...filters }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to search documents');
    }

    return response.data;
  }

  // Forum operations

  /**
   * Creates a new forum thread
   * @param thread - Thread data
   * @returns Created thread
   */
  async createForumThread(thread: Omit<ForumThread, 'id' | 'createdAt' | 'updatedAt'>): Promise<ForumThread> {
    const response = await this.request<ForumThread>('POST', '/api/forum/threads', thread);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to create forum thread');
    }

    return response.data;
  }

  /**
   * Gets a forum thread by ID
   * @param id - Thread ID
   * @returns Thread or null if not found
   */
  async getForumThread(id: string): Promise<ForumThread | null> {
    const response = await this.request<ForumThread>('GET', `/api/forum/threads/${id}`);

    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  }

  /**
   * Creates a forum post
   * @param post - Post data
   * @returns Created post
   */
  async createForumPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<ForumPost> {
    const response = await this.request<ForumPost>('POST', '/api/forum/posts', post);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to create forum post');
    }

    return response.data;
  }

  /**
   * Searches forum threads
   * @param params - Search parameters
   * @returns Search results
   */
  async searchForumThreads(params: {
    query?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ForumThread[]; total: number; page: number; pageSize: number }> {
    const response = await this.request<{
      items: ForumThread[];
      total: number;
      page: number;
      pageSize: number;
    }>('POST', '/api/forum/threads/search', params);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to search forum threads');
    }

    return response.data;
  }

  // Support operations

  /**
   * Creates a support request
   * @param request - Request data
   * @returns Created request
   */
  async createSupportRequest(request: Omit<SupportRequest, 'id' | 'createdAt'>): Promise<SupportRequest> {
    const response = await this.request<SupportRequest>('POST', '/api/support/requests', request);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to create support request');
    }

    return response.data;
  }

  /**
   * Gets a support request by ID
   * @param id - Request ID
   * @returns Request or null if not found
   */
  async getSupportRequest(id: string): Promise<SupportRequest | null> {
    const response = await this.request<SupportRequest>('GET', `/api/support/requests/${id}`);

    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  }

  /**
   * Creates a support session
   * @param session - Session data
   * @returns Created session
   */
  async createSupportSession(session: Omit<SupportSession, 'id' | 'createdAt'>): Promise<SupportSession> {
    const response = await this.request<SupportSession>('POST', '/api/support/sessions', session);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to create support session');
    }

    return response.data;
  }

  /**
   * Registers a support volunteer
   * @param volunteer - Volunteer data
   * @returns Registered volunteer
   */
  async registerSupportVolunteer(volunteer: Omit<SupportVolunteer, 'id' | 'createdAt'>): Promise<SupportVolunteer> {
    const response = await this.request<SupportVolunteer>('POST', '/api/support/volunteers', volunteer);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to register support volunteer');
    }

    return response.data;
  }

  // Participation score operations

  /**
   * Gets user participation score
   * @param userAddress - User's wallet address
   * @returns Participation score data
   */
  async getUserScore(userAddress: string): Promise<{
    total: number;
    components: Record<string, number>;
  }> {
    const response = await this.request<{
      total: number;
      components: Record<string, number>;
    }>('GET', `/api/participation/score/${userAddress}`);

    if (!response.success || !response.data) {
      throw new Error(response.error ?? 'Failed to get user score');
    }

    return response.data;
  }

  /**
   * Awards participation points
   * @param userAddress - User's wallet address
   * @param points - Points to award
   * @param category - Point category
   * @param reason - Reason for awarding points
   */
  async awardPoints(
    userAddress: string,
    points: number,
    category: string,
    reason: string
  ): Promise<void> {
    const response = await this.request<void>('POST', '/api/participation/award', {
      userAddress,
      points,
      category,
      reason,
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to award points');
    }
  }

  // Health check

  /**
   * Checks if the Validator API is healthy
   * @returns Health status
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
  }> {
    const response = await this.request<{
      status: string;
      services: Record<string, { healthy: boolean; error?: string }>;
    }>('GET', '/health');

    return {
      healthy: response.success && response.data?.status === 'healthy',
      services: response.data?.services ?? {},
    };
  }
}