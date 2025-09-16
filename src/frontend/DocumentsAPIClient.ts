/**
 * Documents Module Frontend API Client
 *
 * This client provides type-safe methods for interacting with the Documents module's
 * internal routes from frontend applications. It uses the internal Express routes
 * that are mounted within the unified Validator application.
 *
 * @module frontend/DocumentsAPIClient
 */

import type {
  Document,
  DocumentCategory,
  DocumentSearchParams,
  DocumentMetadata
} from '../services/documentation/DocumentationService';
import type {
  ForumThread,
  ForumPost,
  CreateThreadRequest,
  CreatePostRequest,
  ForumSearchOptions,
  ForumSearchResult,
  ForumStats
} from '../services/forum/ForumTypes';
import type {
  SupportRequest,
  SupportSession,
  SupportVolunteer,
  SupportSystemStats
} from '../services/support/SupportTypes';

/**
 * Generic API response wrapper
 */
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Frontend API Client for Documents Module
 *
 * @example
 * ```typescript
 * // Initialize the client with the base URL of your Validator app
 * const client = new DocumentsAPIClient('http://localhost:3000');
 *
 * // Search documents
 * const docs = await client.searchDocuments({ query: 'installation' });
 *
 * // Create a forum thread
 * const thread = await client.createForumThread({
 *   title: 'How to install?',
 *   content: 'Need help with installation',
 *   category: 'support',
 *   authorAddress: '0x...'
 * });
 *
 * // Request support
 * const session = await client.requestSupport({
 *   userAddress: '0x...',
 *   category: 'technical',
 *   initialMessage: 'I need help with...'
 * });
 * ```
 */
export class DocumentsAPIClient {
  private baseUrl: string;

  /**
   * Creates a new DocumentsAPIClient instance
   *
   * @param baseUrl - Base URL of the Validator application (e.g., 'http://localhost:3000')
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Makes a generic HTTP request to the internal routes
   *
   * @param method - HTTP method
   * @param path - API path (relative to baseUrl)
   * @param body - Request body (for POST/PUT requests)
   * @param query - Query parameters
   * @returns Parsed response data
   * @private
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Add query parameters
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const result: APIResponse<T> = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Request failed: ${response.statusText}`);
    }

    if (!result.data) {
      throw new Error('No data in response');
    }

    return result.data;
  }

  // ========== Documentation API ==========

  /**
   * Search documents
   *
   * @param params - Search parameters
   * @returns Search results with pagination
   */
  async searchDocuments(params: DocumentSearchParams): Promise<{
    items: Document[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query: Record<string, string | number> = {
      page: params.page || 1,
      pageSize: params.pageSize || 20
    };

    if (params.query) query.query = params.query;
    if (params.filters?.category) query.category = params.filters.category;
    if (params.filters?.authorAddress) query.authorAddress = params.filters.authorAddress;
    if (params.filters?.language) query.language = params.filters.language;

    return this.request('/internal/documents', 'GET', undefined, query);
  }

  /**
   * Get a specific document by ID
   *
   * @param documentId - Document ID
   * @returns Document if found
   */
  async getDocument(documentId: string): Promise<Document | null> {
    try {
      return await this.request(`/internal/documents/${documentId}`, 'GET');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new document
   *
   * @param document - Document to create
   * @returns Created document with ID
   */
  async createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Document> {
    return this.request('/internal/documents', 'POST', document);
  }

  /**
   * Update an existing document
   *
   * @param documentId - Document ID
   * @param updates - Fields to update
   * @param editorAddress - Address of the editor
   * @returns Updated document
   */
  async updateDocument(
    documentId: string,
    updates: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>>,
    editorAddress: string
  ): Promise<Document> {
    return this.request(`/internal/documents/${documentId}`, 'PUT', { ...updates, editorAddress });
  }

  /**
   * Submit a vote for document consensus
   *
   * @param documentId - Document ID
   * @param vote - Vote (true = approve, false = reject)
   * @param validatorAddress - Validator's address
   */
  async voteOnDocument(documentId: string, vote: boolean, validatorAddress: string): Promise<void> {
    await this.request(`/internal/documents/${documentId}/vote`, 'POST', { vote, validatorAddress });
  }

  // ========== Forum API ==========

  /**
   * Get recent forum threads
   *
   * @param limit - Number of threads to retrieve
   * @param page - Page number
   * @param category - Optional category filter
   * @returns List of forum threads
   */
  async getRecentForumThreads(
    limit: number = 20,
    page: number = 1,
    category?: string
  ): Promise<ForumThread[]> {
    return this.request('/internal/forum/threads', 'GET', undefined, { limit, page, category });
  }

  /**
   * Get a specific forum thread
   *
   * @param threadId - Thread ID
   * @returns Thread if found
   */
  async getForumThread(threadId: string): Promise<ForumThread | null> {
    try {
      return await this.request(`/internal/forum/threads/${threadId}`, 'GET');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new forum thread
   *
   * @param thread - Thread creation request
   * @returns Created thread
   */
  async createForumThread(thread: CreateThreadRequest): Promise<ForumThread> {
    return this.request('/internal/forum/threads', 'POST', thread);
  }

  /**
   * Create a new forum post
   *
   * @param post - Post creation request
   * @returns Created post
   */
  async createForumPost(post: CreatePostRequest): Promise<ForumPost> {
    return this.request('/internal/forum/posts', 'POST', post);
  }

  /**
   * Search forum content
   *
   * @param options - Search options
   * @returns Search results
   */
  async searchForum(options: ForumSearchOptions): Promise<ForumSearchResult> {
    return this.request('/internal/forum/search', 'GET', undefined, options as any);
  }

  /**
   * Get posts for a thread
   *
   * @param threadId - Thread ID
   * @param limit - Number of posts to retrieve
   * @param offset - Offset for pagination
   * @returns List of posts
   */
  async getThreadPosts(threadId: string, limit: number = 50, offset: number = 0): Promise<ForumPost[]> {
    return this.request(`/internal/forum/threads/${threadId}/posts`, 'GET', undefined, { limit, offset });
  }

  /**
   * Vote on a forum post
   *
   * @param postId - Post ID
   * @param isUpvote - true for upvote, false for downvote
   * @param voterAddress - Voter's address
   */
  async voteOnPost(postId: string, isUpvote: boolean, voterAddress: string): Promise<void> {
    await this.request(`/internal/forum/posts/${postId}/vote`, 'POST', { isUpvote, voterAddress });
  }

  /**
   * Get forum statistics
   *
   * @returns Forum statistics
   */
  async getForumStats(): Promise<ForumStats> {
    return this.request('/internal/forum/stats', 'GET');
  }

  // ========== Support API ==========

  /**
   * Request support
   *
   * @param request - Support request details
   * @returns Created support session
   */
  async requestSupport(request: Omit<SupportRequest, 'requestId' | 'timestamp'>): Promise<SupportSession> {
    return this.request('/internal/support/requests', 'POST', request);
  }

  /**
   * Register as a support volunteer
   *
   * @param volunteer - Volunteer details
   */
  async registerVolunteer(volunteer: Omit<SupportVolunteer,
    'rating' | 'totalSessions' | 'avgResponseTime' | 'avgResolutionTime' | 'lastActive'
  >): Promise<void> {
    await this.request('/internal/support/volunteers', 'POST', volunteer);
  }

  /**
   * Get support system statistics
   *
   * @returns Support system stats
   */
  async getSupportStats(): Promise<SupportSystemStats> {
    return this.request('/internal/support/stats', 'GET');
  }

  /**
   * Update volunteer status
   *
   * @param volunteerAddress - Volunteer's address
   * @param status - New status
   */
  async updateVolunteerStatus(volunteerAddress: string, status: string): Promise<void> {
    await this.request(`/internal/support/volunteers/${volunteerAddress}/status`, 'PUT', { status });
  }

  /**
   * Send a message in a support session
   *
   * @param sessionId - Session ID
   * @param message - Message content
   * @param senderAddress - Sender's address
   */
  async sendSupportMessage(sessionId: string, message: string, senderAddress: string): Promise<void> {
    await this.request(`/internal/support/sessions/${sessionId}/messages`, 'POST', {
      content: message,
      sender: senderAddress
    });
  }

  /**
   * Get support session details
   *
   * @param sessionId - Session ID
   * @returns Session details if found
   */
  async getSupportSession(sessionId: string): Promise<SupportSession | null> {
    try {
      return await this.request(`/internal/support/sessions/${sessionId}`, 'GET');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Close a support session
   *
   * @param sessionId - Session ID
   * @param resolution - Resolution notes
   */
  async closeSupportSession(sessionId: string, resolution: string): Promise<void> {
    await this.request(`/internal/support/sessions/${sessionId}/close`, 'POST', { resolution });
  }

  // ========== Unified Search API ==========

  /**
   * Search across all services
   *
   * @param query - Search query
   * @param type - Type of content to search ('all', 'documents', 'forum')
   * @returns Search results from all services
   */
  async unifiedSearch(query: string, type: 'all' | 'documents' | 'forum' = 'all'): Promise<{
    documents?: any;
    forum?: any;
  }> {
    return this.request('/internal/search', 'GET', undefined, { query, type });
  }

  // ========== Participation Score API ==========

  /**
   * Get user's participation score
   *
   * @param userAddress - User's address
   * @returns Participation score
   */
  async getUserScore(userAddress: string): Promise<number> {
    return this.request(`/internal/participation/${userAddress}/score`, 'GET');
  }

  // ========== Health Check ==========

  /**
   * Check if the Documents module is healthy
   *
   * @returns Health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    services: Record<string, boolean>;
    version: string;
  }> {
    return this.request('/internal/health', 'GET');
  }
}

/**
 * Default export for convenience
 */
export default DocumentsAPIClient;