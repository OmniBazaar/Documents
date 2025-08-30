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
 * Factory function to create OmniValidator client
 * @param config - Client configuration options
 * @returns OmniValidator client instance
 */
export function createOmniValidatorClient(config: OmniValidatorClientConfig): OmniValidatorClient {
  // In production, this would be imported from the Validator module
  // For now, create a mock implementation
  return {
    config,
    get<T = unknown>(
      _path: string,
      _params?: Record<string, unknown>,
    ): Promise<ValidatorResponse<T>> {
      // Mock implementation - return resolved promise
      return Promise.resolve({ success: true, data: {} as T });
    },
    post<T = unknown>(_path: string, _data?: unknown): Promise<ValidatorResponse<T>> {
      // Mock implementation - return resolved promise
      return Promise.resolve({ success: true, data: {} as T });
    },
    put<T = unknown>(_path: string, _data?: unknown): Promise<ValidatorResponse<T>> {
      // Mock implementation - return resolved promise
      return Promise.resolve({ success: true, data: {} as T });
    },
    delete<T = unknown>(_path: string): Promise<ValidatorResponse<T>> {
      // Mock implementation - return resolved promise
      return Promise.resolve({ success: true, data: {} as T });
    },
    async connect(): Promise<void> {
      // Mock implementation
      await Promise.resolve();
    },
    disconnect(): void {
      // Mock implementation
    },
    on(_event: string, _handler: (data: unknown) => void): void {
      // Mock implementation
    },
    off(_event: string, _handler: (data: unknown) => void): void {
      // Mock implementation
    },
    getHealth(): Promise<ValidatorHealth> {
      // Mock implementation
      return Promise.resolve({
        healthy: true,
        services: {
          storage: true,
          forum: true,
          documents: true,
        },
      });
    },
    storeData(_data: string, _metadata?: Record<string, unknown>): Promise<string> {
      // Mock implementation
      return Promise.resolve(`ipfs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    },
    retrieveData(_ipfsHash: string): Promise<string | null> {
      // Mock implementation
      return Promise.resolve('mock content');
    },
    storeDocument(
      _content: string,
      _metadata: Record<string, unknown>,
    ): Promise<DocumentStorageResult> {
      // Mock implementation
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return Promise.resolve({
        documentId,
        ipfsHash: `ipfs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      });
    },
    retrieveDocument(_documentId: string): Promise<DocumentRetrievalResult | null> {
      // Mock implementation
      return Promise.resolve({
        content: '{}',
        metadata: {},
      });
    },
    createForumPost(
      _author: string,
      _title: string,
      _content: string,
      _category: string,
    ): Promise<string> {
      // Mock implementation
      return Promise.resolve(`post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    },
    lookupAddress(_address: string): Promise<string | null> {
      // Mock implementation
      return Promise.resolve(null);
    },
  };
}
