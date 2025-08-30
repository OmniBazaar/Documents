/**
 * Validator Integration Service
 *
 * Provides a unified interface for the Validator module to interact with
 * Documentation, Forum, and Support services. Handles all cross-module
 * communication and data synchronization.
 *
 * @module ValidatorIntegration
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
  DocumentationService,
  P2PForumService,
  VolunteerSupportService,
  initializeDocumentServices,
} from '../services';
import { DatabaseConfig } from '../services/database/Database';
import type {
  Document,
  DocumentSearchParams,
} from '../services/documentation/DocumentationService';
import type { ForumThread, ForumPost, ForumSearchOptions } from '../services/forum/ForumTypes';
import type { SupportRequest, SupportVolunteer } from '../services/support/SupportTypes';

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** Database configuration */
  database: DatabaseConfig;
  /** Validator API endpoint */
  validatorEndpoint?: string;
  /** Service ports */
  ports?: {
    /** HTTP API port */
    http?: number;
    /** WebSocket port */
    websocket?: number;
  };
}

/**
 * Health status for a service
 */
export interface ServiceHealth {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Service statistics */
  stats?: Record<string, unknown>;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  /** Whether all services are healthy */
  healthy: boolean;
  /** Individual service health */
  services: Record<string, ServiceHealth | { error: string }>;
}

/**
 * Support session type
 */
export interface SupportSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Volunteer ID */
  volunteerId?: string;
  /** Session status */
  status: 'waiting' | 'active' | 'closed';
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Validator message type
 */
export interface ValidatorMessage {
  /** Message type */
  type: string;
  /** Action to perform */
  action: string;
  /** Message data */
  data: Record<string, unknown>;
}

/**
 * Validator response type
 */
export interface ValidatorResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Integration event types
 */
export interface IntegrationEvents {
  /** New document created */
  'document:created': (document: Document) => void;
  /** Document updated */
  'document:updated': (document: Document) => void;
  /** Forum thread created */
  'forum:thread': (thread: ForumThread) => void;
  /** Forum post created */
  'forum:post': (post: ForumPost) => void;
  /** Support session started */
  'support:session': (session: SupportSession) => void;
  /** Service health changed */
  'health:changed': (health: HealthStatus) => void;
}

/**
 * Validator Integration Service
 *
 * @example
 * ```typescript
 * const integration = new ValidatorIntegration({
 *   database: { host, port, database, user, password },
 *   validatorEndpoint: 'http://localhost:8080'
 * });
 *
 * await integration.start();
 *
 * // Listen for events
 * integration.on('document:created', (doc) => {
 *   console.log('New document:', doc);
 * });
 *
 * // Get services
 * const { documentation, forum, support } = integration.getServices();
 * ```
 */
export class ValidatorIntegration extends EventEmitter {
  private config: IntegrationConfig;
  private services?: {
    documentation: DocumentationService;
    forum: P2PForumService;
    support: VolunteerSupportService;
  };
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private isRunning = false;

  /**
   * Creates a new Validator Integration instance
   *
   * @param config - Integration configuration
   */
  constructor(config: IntegrationConfig) {
    super();
    this.config = config;
  }

  /**
   * Starts the integration service
   *
   * @returns Promise that resolves when service is started
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Validator integration already running');
      return;
    }

    try {
      logger.info('Starting Validator integration service');

      // Initialize services
      const allServices = await initializeDocumentServices({
        database: this.config.database,
      });

      // Type-safe service assignment
      this.services = {
        documentation: allServices.documentation,
        forum: allServices.forum,
        support: allServices.support,
      };

      // Set up event handlers
      this.setupEventHandlers();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start HTTP/WebSocket servers if ports configured
      if (this.config.ports?.http !== undefined) {
        this.startHttpServer(this.config.ports.http);
      }

      if (this.config.ports?.websocket !== undefined) {
        this.startWebSocketServer(this.config.ports.websocket);
      }

      this.isRunning = true;
      logger.info('Validator integration service started successfully');
    } catch (error) {
      logger.error('Failed to start Validator integration:', error);
      throw error;
    }
  }

  /**
   * Stops the integration service
   *
   * @returns Promise that resolves when service is stopped
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Validator integration service');

    // Stop health monitoring
    if (this.healthCheckInterval !== undefined) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Remove event handlers
    this.removeAllListeners();

    this.isRunning = false;
    logger.info('Validator integration service stopped');
  }

  /**
   * Gets the initialized services
   *
   * @returns Services object
   * @throws {Error} If services not initialized
   */
  getServices(): {
    documentation: DocumentationService;
    forum: P2PForumService;
    support: VolunteerSupportService;
  } {
    if (this.services === undefined) {
      throw new Error('Services not initialized. Call start() first.');
    }
    return this.services;
  }

  /**
   * Gets current health status of all services
   *
   * @returns Promise resolving to health status
   */
  async getHealth(): Promise<HealthStatus> {
    if (this.services === undefined) {
      return {
        healthy: false,
        services: {
          documentation: { healthy: false, error: 'Services not initialized' },
          forum: { healthy: false, error: 'Services not initialized' },
          support: { healthy: false, error: 'Services not initialized' },
        },
      };
    }

    try {
      // Get forum stats
      const forumStats = await this.services.forum.getStats();

      // Get support stats
      const supportStats = await this.services.support.getSystemStats();

      const health: HealthStatus = {
        healthy: true,
        services: {
          documentation: {
            healthy: true,
            // Documentation service doesn't have getStats method yet
            stats: { available: true },
          },
          forum: {
            healthy: true,
            stats: forumStats as unknown as Record<string, unknown>,
          },
          support: {
            healthy: true,
            stats: supportStats as unknown as Record<string, unknown>,
          },
        },
      };

      return health;
    } catch (error) {
      logger.error('Health check failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        services: {
          documentation: { healthy: false, error: errorMessage },
          forum: { healthy: false, error: errorMessage },
          support: { healthy: false, error: errorMessage },
        },
      };
    }
  }

  /**
   * API endpoint handlers for Validator module
   */
  public readonly api = {
    /**
     * Documentation endpoints
     */
    documentation: {
      /**
       * Creates a new document
       *
       * @param document - Document to create
       * @returns Promise resolving to created document
       */
      create: async (document: Document) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.documentation.createDocument(document);
      },

      /**
       * Gets a document by ID
       *
       * @param id - Document ID
       * @returns Promise resolving to document
       */
      get: async (id: string) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.documentation.getDocument(id);
      },

      /**
       * Searches documents
       *
       * @param query - Search query
       * @param options - Search options
       * @returns Promise resolving to search results
       */
      search: async (query: string, options?: DocumentSearchParams) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        const searchParams: DocumentSearchParams = {
          query,
          ...options,
        };
        return await this.services.documentation.searchDocuments(searchParams);
      },
    },

    /**
     * Forum endpoints
     */
    forum: {
      /**
       * Creates a new thread
       *
       * @param thread - Thread to create
       * @returns Promise resolving to created thread
       */
      createThread: async (thread: ForumThread) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.forum.createThread(thread);
      },

      /**
       * Creates a new post
       *
       * @param post - Post to create
       * @returns Promise resolving to created post
       */
      createPost: async (post: ForumPost) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.forum.createPost(post);
      },

      /**
       * Searches forum threads
       *
       * @param options - Search options
       * @returns Promise resolving to search results
       */
      search: async (options?: Record<string, unknown>) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        const searchOptions = options as ForumSearchOptions | undefined;
        const result = await this.services.forum.search(searchOptions ?? {});
        return result as unknown;
      },
    },

    /**
     * Support endpoints
     */
    support: {
      /**
       * Requests support
       *
       * @param request - Support request
       * @returns Promise resolving to support session
       */
      requestSupport: async (request: SupportRequest) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        const result = await this.services.support.requestSupport(request);
        return result as unknown;
      },

      /**
       * Registers a volunteer
       *
       * @param volunteer - Volunteer registration data
       * @returns Promise resolving to registration result
       */
      registerVolunteer: async (volunteer: SupportVolunteer) => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.support.registerVolunteer(volunteer);
      },

      /**
       * Gets system stats
       *
       * @returns Promise resolving to system statistics
       */
      getStats: async () => {
        if (this.services === undefined) throw new Error('Services not initialized');
        return await this.services.support.getSystemStats();
      },
    },
  };

  /**
   * Sets up event handlers for service events
   * @private
   */
  private setupEventHandlers(): void {
    if (this.services === undefined) return;

    // Documentation events
    // Type assertion needed because EventEmitter doesn't have typed events
    const docService = this.services.documentation as unknown as EventEmitter;
    if ('on' in docService && typeof docService.on === 'function') {
      docService.on('document:created', (doc: Document) => {
        this.emit('document:created', doc);
      });

      docService.on('document:updated', (doc: Document) => {
        this.emit('document:updated', doc);
      });
    }

    // Forum events
    const forumService = this.services.forum as unknown as EventEmitter;
    if ('on' in forumService && typeof forumService.on === 'function') {
      forumService.on('thread:created', (thread: ForumThread) => {
        this.emit('forum:thread', thread);
      });

      forumService.on('post:created', (post: ForumPost) => {
        this.emit('forum:post', post);
      });
    }

    // Support events
    // Note: Support service doesn't extend EventEmitter yet,
    // but we can add it later if needed
  }

  /**
   * Starts health monitoring
   * @private
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    const checkHealth = async (): Promise<void> => {
      const health = await this.getHealth();
      this.emit('health:changed', health);

      if (health.healthy === false) {
        logger.warn('Service health check failed', health);
      }
    };

    this.healthCheckInterval = setInterval(() => {
      void checkHealth();
    }, 30 * 1000);
  }

  /**
   * Starts HTTP server for REST API
   * @private
   * @param port - Port number to start server on
   */
  private startHttpServer(port: number): void {
    // In production, this would start an Express server
    // For now, just log that we would start it
    logger.info(`Would start HTTP server on port ${port}`);

    // Example Express setup:
    // const app = express();
    // app.use('/api/docs', documentationRouter);
    // app.use('/api/forum', forumRouter);
    // app.use('/api/support', supportRouter);
    // app.listen(port);
  }

  /**
   * Starts WebSocket server for real-time updates
   * @private
   * @param port - Port number to start server on
   */
  private startWebSocketServer(port: number): void {
    // In production, this would start a WebSocket server
    // For now, just log that we would start it
    logger.info(`Would start WebSocket server on port ${port}`);

    // Example WebSocket setup:
    // const wss = new WebSocket.Server({ port });
    // wss.on('connection', (ws) => {
    //   // Handle WebSocket connections
    // });
  }

  /**
   * Handles incoming messages from Validator
   *
   * @param message - Message from validator
   * @returns Promise resolving to response to send back
   */
  async handleValidatorMessage(message: ValidatorMessage): Promise<ValidatorResponse> {
    try {
      switch (message.type) {
        case 'documentation':
          return await this.handleDocumentationMessage(message.action, message.data);

        case 'forum':
          return await this.handleForumMessage(message.action, message.data);

        case 'support':
          return await this.handleSupportMessage(message.action, message.data);

        case 'health':
          return { success: true, data: await this.getHealth() };

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling validator message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handles documentation-related messages
   * @private
   * @param action - Action to perform
   * @param data - Message data
   * @returns Promise resolving to action result
   */
  private async handleDocumentationMessage(
    action: string,
    data: Record<string, unknown>,
  ): Promise<ValidatorResponse> {
    switch (action) {
      case 'create': {
        const document = data as unknown as Document;
        const result = await this.api.documentation.create(document);
        return { success: true, data: result };
      }
      case 'get': {
        const id = data.id as string;
        const result = await this.api.documentation.get(id);
        return { success: true, data: result };
      }
      case 'search': {
        const query = data.query as string;
        const options = data.options as DocumentSearchParams | undefined;
        const result = await this.api.documentation.search(query, options);
        return { success: true, data: result };
      }
      default:
        throw new Error(`Unknown documentation action: ${action}`);
    }
  }

  /**
   * Handles forum-related messages
   * @private
   * @param action - Action to perform
   * @param data - Message data
   * @returns Promise resolving to action result
   */
  private async handleForumMessage(
    action: string,
    data: Record<string, unknown>,
  ): Promise<ValidatorResponse> {
    switch (action) {
      case 'createThread': {
        const thread = data as unknown as ForumThread;
        const result = await this.api.forum.createThread(thread);
        return { success: true, data: result };
      }
      case 'createPost': {
        const post = data as unknown as ForumPost;
        const result = await this.api.forum.createPost(post);
        return { success: true, data: result };
      }
      case 'search': {
        const options = Object.keys(data).length > 0 ? (data as unknown as ForumSearchOptions) : {};
        const result = await this.api.forum.search(options as Record<string, unknown>);
        return { success: true, data: result };
      }
      default:
        throw new Error(`Unknown forum action: ${action}`);
    }
  }

  /**
   * Handles support-related messages
   * @private
   * @param action - Action to perform
   * @param data - Message data
   * @returns Promise resolving to action result
   */
  private async handleSupportMessage(
    action: string,
    data: Record<string, unknown>,
  ): Promise<ValidatorResponse> {
    switch (action) {
      case 'requestSupport': {
        const request = data as unknown as SupportRequest;
        const result = await this.api.support.requestSupport(request);
        return { success: true, data: result };
      }
      case 'registerVolunteer': {
        const volunteer = data as unknown as SupportVolunteer;
        const result = await this.api.support.registerVolunteer(volunteer);
        return { success: true, data: result };
      }
      case 'getStats': {
        const result = await this.api.support.getStats();
        return { success: true, data: result };
      }
      default:
        throw new Error(`Unknown support action: ${action}`);
    }
  }
}
