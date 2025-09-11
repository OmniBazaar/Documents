/**
 * Validator Client Types
 *
 * Type definitions for interacting with the Validator module.
 * These types mirror the Validator's client interface without
 * creating a direct dependency.
 *
 * @module ValidatorTypes
 */

/**
 * Configuration for the OmniValidator client
 */
export interface OmniValidatorClientConfig {
  /** Validator API endpoint */
  validatorEndpoint: string;
  /** WebSocket endpoint for real-time updates (optional) */
  wsEndpoint?: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retryAttempts?: number;
}

/**
 * Response from validator API calls
 */
export interface ValidatorResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if request failed */
  error?: string;
}

/**
 * Health status for validator services
 */
export interface ValidatorHealth {
  /** Whether validator is healthy */
  healthy: boolean;
  /** Service-specific health status */
  services: {
    /** Storage service health */
    storage?: boolean;
    /** Forum service health */
    forum?: boolean;
    /** Documents service health */
    documents?: boolean;
  };
}

/**
 * Document storage result
 */
export interface DocumentStorageResult {
  /** Document ID */
  documentId: string;
  /** IPFS hash of stored content */
  ipfsHash: string;
  /** Storage timestamp */
  timestamp: number;
}

/**
 * Document retrieval result
 */
export interface DocumentRetrievalResult {
  /** Document content */
  content: string;
  /** Document metadata */
  metadata?: Record<string, unknown>;
}

/**
 * OmniValidator client interface
 */
export interface OmniValidatorClient {
  /** Client configuration */
  config: OmniValidatorClientConfig;

  /**
   * Makes a GET request to the validator API
   * @param path - API endpoint path
   * @param params - Optional query parameters
   * @returns Promise resolving to validator response
   */
  get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<ValidatorResponse<T>>;

  /**
   * Makes a POST request to the validator API
   * @param path - API endpoint path
   * @param data - Request body data
   * @returns Promise resolving to validator response
   */
  post<T = unknown>(path: string, data?: unknown): Promise<ValidatorResponse<T>>;

  /**
   * Makes a PUT request to the validator API
   * @param path - API endpoint path
   * @param data - Request body data
   * @returns Promise resolving to validator response
   */
  put<T = unknown>(path: string, data?: unknown): Promise<ValidatorResponse<T>>;

  /**
   * Makes a DELETE request to the validator API
   * @param path - API endpoint path
   * @returns Promise resolving to validator response
   */
  delete<T = unknown>(path: string): Promise<ValidatorResponse<T>>;

  /**
   * Establishes WebSocket connection for real-time updates
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void>;

  /**
   * Closes WebSocket connection
   */
  disconnect(): void;

  /**
   * Subscribes to events
   * @param event - Event name to subscribe to
   * @param handler - Event handler function
   */
  on(event: string, handler: (data: unknown) => void): void;

  /**
   * Unsubscribes from events
   * @param event - Event name to unsubscribe from
   * @param handler - Event handler function to remove
   */
  off(event: string, handler: (data: unknown) => void): void;

  /**
   * Gets validator health status
   * @returns Promise resolving to health status
   */
  getHealth(): Promise<ValidatorHealth>;

  /**
   * Stores data to IPFS through validator
   * @param data - Data to store
   * @param metadata - Optional metadata
   * @returns Promise resolving to IPFS hash
   */
  storeData(data: string, metadata?: Record<string, unknown>): Promise<string>;

  /**
   * Retrieves data from IPFS through validator
   * @param ipfsHash - IPFS hash to retrieve
   * @returns Promise resolving to data or null if not found
   */
  retrieveData(ipfsHash: string): Promise<string | null>;

  /**
   * Stores a document through validator
   * @param content - Document content
   * @param metadata - Document metadata
   * @returns Promise resolving to storage result
   */
  storeDocument(content: string, metadata: Record<string, unknown>): Promise<DocumentStorageResult>;

  /**
   * Retrieves a document through validator
   * @param documentId - Document ID to retrieve
   * @returns Promise resolving to document or null if not found
   */
  retrieveDocument(documentId: string): Promise<DocumentRetrievalResult | null>;

  /**
   * Creates a forum post through validator
   * @param author - Author address
   * @param title - Post title
   * @param content - Post content
   * @param category - Post category
   * @returns Promise resolving to post ID
   */
  createForumPost(
    author: string,
    title: string,
    content: string,
    category: string,
  ): Promise<string>;

  /**
   * Looks up username for address
   * @param address - Address to look up
   * @returns Promise resolving to username or null if not found
   */
  lookupAddress(address: string): Promise<string | null>;
}

/**
 * WebSocket event emitter for real-time updates
 */
interface WebSocketEventEmitter {
  /** Event handlers map */
  handlers: Map<string, Set<(data: unknown) => void>>;
  /** WebSocket instance */
  ws: WebSocket | null;
}

/**
 * Validator client implementation
 */
class ValidatorClient implements OmniValidatorClient {
  public config: OmniValidatorClientConfig;
  private wsEmitter: WebSocketEventEmitter = {
    handlers: new Map(),
    ws: null,
  };

  /**
   * Creates a new validator client
   * @param config - Client configuration
   */
  constructor(config: OmniValidatorClientConfig) {
    this.config = config;
  }

  /**
   * Makes an HTTP request to the validator API
   * @param method - HTTP method
   * @param path - API endpoint path
   * @param data - Request data
   * @param params - Query parameters
   * @returns Promise resolving to validator response
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ): Promise<ValidatorResponse<T>> {
    try {
      const url = new URL(path, this.config.validatorEndpoint);
      
      // Add query parameters
      if (params !== undefined) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey !== undefined) {
        headers['X-API-Key'] = this.config.apiKey;
      }

      const options: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      };

      if (data !== undefined && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url.toString(), options);
      const responseData = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        return {
          success: false,
          error: (responseData.error as string | undefined) ?? `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: responseData as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<ValidatorResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  async post<T = unknown>(path: string, data?: unknown): Promise<ValidatorResponse<T>> {
    return this.request<T>('POST', path, data);
  }

  async put<T = unknown>(path: string, data?: unknown): Promise<ValidatorResponse<T>> {
    return this.request<T>('PUT', path, data);
  }

  async delete<T = unknown>(path: string): Promise<ValidatorResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  async connect(): Promise<void> {
    if (this.config.wsEndpoint === undefined) {
      return;
    }

    const wsEndpoint = this.config.wsEndpoint;
    return new Promise((resolve, reject) => {
      try {
        this.wsEmitter.ws = new WebSocket(wsEndpoint);

        this.wsEmitter.ws.onopen = () => resolve();
        this.wsEmitter.ws.onerror = (error) => reject(error);
        
        this.wsEmitter.ws.onmessage = (event) => {
          try {
            const messageData = String(event.data);
            const data = JSON.parse(messageData) as { event?: string; data?: unknown };
            const eventName = data.event ?? 'message';
            const handlers = this.wsEmitter.handlers.get(eventName);
            
            if (handlers !== undefined) {
              handlers.forEach(handler => handler(data.data ?? data));
            }
          } catch {
            // Invalid JSON, ignore
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.wsEmitter.ws !== null) {
      this.wsEmitter.ws.close();
      this.wsEmitter.ws = null;
    }
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.wsEmitter.handlers.has(event)) {
      this.wsEmitter.handlers.set(event, new Set());
    }
    this.wsEmitter.handlers.get(event)?.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.wsEmitter.handlers.get(event);
    handlers?.delete(handler);
  }

  async getHealth(): Promise<ValidatorHealth> {
    const response = await this.get<ValidatorHealth>('/health');
    return response.data ?? { healthy: false, services: {} };
  }

  async storeData(data: string, metadata?: Record<string, unknown>): Promise<string> {
    const response = await this.post<{ ipfsHash: string }>('/ipfs/store', {
      data,
      metadata,
    });
    
    if (!response.success || response.data === undefined) {
      throw new Error(response.error ?? 'Failed to store data');
    }
    
    return response.data.ipfsHash;
  }

  async retrieveData(ipfsHash: string): Promise<string | null> {
    const response = await this.get<{ data: string }>(`/ipfs/retrieve/${ipfsHash}`);
    return response.success && response.data !== undefined ? response.data.data : null;
  }

  async storeDocument(
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<DocumentStorageResult> {
    const response = await this.post<DocumentStorageResult>('/documents/store', {
      content,
      metadata,
    });
    
    if (!response.success || response.data === undefined) {
      throw new Error(response.error ?? 'Failed to store document');
    }
    
    return response.data;
  }

  async retrieveDocument(documentId: string): Promise<DocumentRetrievalResult | null> {
    const response = await this.get<DocumentRetrievalResult>(`/documents/${documentId}`);
    return response.success && response.data !== undefined ? response.data : null;
  }

  async createForumPost(
    author: string,
    title: string,
    content: string,
    category: string,
  ): Promise<string> {
    const response = await this.post<{ postId: string }>('/forum/posts', {
      author,
      title,
      content,
      category,
    });
    
    if (!response.success || response.data === undefined) {
      throw new Error(response.error ?? 'Failed to create forum post');
    }
    
    return response.data.postId;
  }

  async lookupAddress(address: string): Promise<string | null> {
    const response = await this.get<{ username: string }>(`/ens/lookup/${address}`);
    return response.success && response.data !== undefined ? response.data.username : null;
  }
}

/**
 * Factory function to create OmniValidator client
 * @param config - Client configuration options
 * @returns OmniValidator client instance
 */
export function createOmniValidatorClient(config: OmniValidatorClientConfig): OmniValidatorClient {
  return new ValidatorClient(config);
}
