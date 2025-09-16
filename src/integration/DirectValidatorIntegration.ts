/**
 * Direct Validator Integration Service
 *
 * Provides direct service-to-service integration within the unified
 * Validator application. Replaces API-based communication with direct
 * method calls and shared memory access.
 *
 * @module integration/DirectValidatorIntegration
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import type {
  DocumentationService,
  Document,
  DocumentSearchParams,
} from '../services/documentation/DocumentationService';
import type { P2PForumService, ForumThread, ForumPost } from '../services/forum';
import type { VolunteerSupportService, SupportRequest } from '../services/support';
import type { ParticipationScoreService } from '../services/participation/ParticipationScoreService';
import type { SearchEngine } from '../services/search/SearchEngine';
import type { ValidationService } from '../services/validation/ValidationService';

/**
 * Document services interface
 */
export interface DocumentServices {
  /** Documentation service instance */
  documentation: DocumentationService;
  /** Forum service instance */
  forum: P2PForumService;
  /** Support service instance */
  support: VolunteerSupportService;
  /** Search engine instance */
  search: SearchEngine;
  /** Participation score service instance */
  participation: ParticipationScoreService;
  /** Validation service instance */
  validation: ValidationService;
}

/**
 * Validator services interface (injected from Validator module)
 */
export interface ValidatorServices {
  /** Database service */
  database: {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  };
  /** Participation score service */
  participationScore: {
    getUserScore(userId: string): Promise<number>;
    updateScore(userId: string, delta: number): Promise<void>;
  };
  /** Blockchain service */
  blockchain?: {
    getBlockHeight(): Promise<number>;
    submitTransaction(tx: unknown): Promise<string>;
  };
  /** IPFS service */
  ipfs?: {
    add(content: string | Buffer): Promise<string>;
    get(hash: string): Promise<Buffer>;
  };
}

/**
 * Integration configuration
 */
export interface DirectIntegrationConfig {
  /** Whether to enable event bridging */
  enableEventBridge?: boolean;
  /** Whether to enable lazy loading */
  enableLazyLoading?: boolean;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  /** Service name */
  name: string;
  /** Health status */
  healthy: boolean;
  /** Optional status message */
  message?: string;
  /** Last check timestamp */
  lastCheck: Date;
}

/**
 * Direct Validator Integration Service
 *
 * @example
 * ```typescript
 * const integration = new DirectValidatorIntegration(documentServices, {
 *   enableEventBridge: true,
 *   enableLazyLoading: true
 * });
 *
 * // Inject validator services
 * integration.setValidatorServices(validatorServices);
 *
 * // Access services directly
 * const docs = integration.getDocumentsServices();
 * const validator = integration.getValidatorServices();
 * ```
 */
export class DirectValidatorIntegration extends EventEmitter {
  private documentServices: DocumentServices;
  private validatorServices?: ValidatorServices;
  private config: DirectIntegrationConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private serviceHealthMap: Map<string, ServiceHealth> = new Map();

  /**
   * Creates a new Direct Validator Integration instance
   *
   * @param services - Document services to integrate
   * @param config - Integration configuration
   */
  constructor(services: DocumentServices, config: DirectIntegrationConfig = {}) {
    super();
    this.documentServices = services;
    this.config = {
      enableEventBridge: true,
      enableLazyLoading: true,
      ...config
    };

    // Initialize health tracking
    this.initializeHealthTracking();

    // Set up event bridges if enabled
    if (this.config.enableEventBridge) {
      this.setupEventBridges();
    }
  }

  /**
   * Sets the validator services for direct integration
   *
   * @param validatorServices - Services from the Validator module
   */
  setValidatorServices(validatorServices: ValidatorServices): void {
    this.validatorServices = validatorServices;
    logger.info('Validator services injected successfully');

    // Emit event for service availability
    this.emit('validator:connected', validatorServices);
  }

  /**
   * Gets the document services
   *
   * @returns Document services instance
   */
  getDocumentsServices(): DocumentServices {
    return this.documentServices;
  }

  /**
   * Gets the validator services
   *
   * @returns Validator services instance
   * @throws {Error} If validator services not set
   */
  getValidatorServices(): ValidatorServices {
    if (this.validatorServices === undefined) {
      throw new Error('Validator services not set. Call setValidatorServices() first.');
    }
    return this.validatorServices;
  }

  /**
   * Checks if validator services are available
   *
   * @returns True if validator services are set
   */
  hasValidatorServices(): boolean {
    return this.validatorServices !== undefined;
  }

  /**
   * Direct access to database through validator
   *
   * @returns Database service
   * @throws {Error} If validator services not available
   */
  getDatabase(): ValidatorServices['database'] {
    const validator = this.getValidatorServices();
    return validator.database;
  }

  /**
   * Direct access to participation scoring
   *
   * @returns Participation score service
   * @throws {Error} If validator services not available
   */
  getParticipationScore(): ValidatorServices['participationScore'] {
    const validator = this.getValidatorServices();
    return validator.participationScore;
  }

  /**
   * Gets the health status of all services
   *
   * @returns Array of service health statuses
   */
  getHealthStatus(): ServiceHealth[] {
    return Array.from(this.serviceHealthMap.values());
  }

  /**
   * Performs a health check on all services
   *
   * @returns Overall health status
   */
  async performHealthCheck(): Promise<boolean> {
    const checks: Promise<void>[] = [];

    // Check document services
    checks.push(this.checkDocumentationHealth());
    checks.push(this.checkForumHealth());
    checks.push(this.checkSupportHealth());

    // Check validator services if available
    if (this.hasValidatorServices()) {
      checks.push(this.checkValidatorHealth());
    }

    await Promise.allSettled(checks);

    // Return overall health
    const allHealthy = Array.from(this.serviceHealthMap.values())
      .every(health => health.healthy);

    // Emit health status
    this.emit('health:status', {
      healthy: allHealthy,
      services: this.getHealthStatus()
    });

    return allHealthy;
  }

  /**
   * Initializes health tracking
   */
  private initializeHealthTracking(): void {
    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      void this.performHealthCheck();
    }, 30000); // Every 30 seconds

    // Perform initial health check
    void this.performHealthCheck();
  }

  /**
   * Checks documentation service health
   */
  private async checkDocumentationHealth(): Promise<void> {
    try {
      // Try a simple search to verify service is responsive
      await this.documentServices.documentation.searchDocuments({
        query: '',
        pageSize: 1
      });

      this.serviceHealthMap.set('documentation', {
        name: 'documentation',
        healthy: true,
        message: 'Service operational',
        lastCheck: new Date()
      });
    } catch (error) {
      this.serviceHealthMap.set('documentation', {
        name: 'documentation',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Checks forum service health
   */
  private async checkForumHealth(): Promise<void> {
    try {
      // Get stats to verify service is responsive
      await this.documentServices.forum.getStats();

      this.serviceHealthMap.set('forum', {
        name: 'forum',
        healthy: true,
        message: 'Service operational',
        lastCheck: new Date()
      });
    } catch (error) {
      this.serviceHealthMap.set('forum', {
        name: 'forum',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Checks support service health
   */
  private async checkSupportHealth(): Promise<void> {
    try {
      // Get stats to verify service is responsive
      await this.documentServices.support.getSystemStats();

      this.serviceHealthMap.set('support', {
        name: 'support',
        healthy: true,
        message: 'Service operational',
        lastCheck: new Date()
      });
    } catch (error) {
      this.serviceHealthMap.set('support', {
        name: 'support',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Checks validator services health
   */
  private async checkValidatorHealth(): Promise<void> {
    try {
      if (this.validatorServices === undefined) {
        throw new Error('Validator services not available');
      }

      // Try a simple database query
      await this.validatorServices.database.query('SELECT 1');

      this.serviceHealthMap.set('validator', {
        name: 'validator',
        healthy: true,
        message: 'Services operational',
        lastCheck: new Date()
      });
    } catch (error) {
      this.serviceHealthMap.set('validator', {
        name: 'validator',
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Sets up event bridges between services
   */
  private setupEventBridges(): void {
    // Bridge documentation events
    const docService = this.documentServices.documentation as unknown as EventEmitter;
    if (docService.on !== undefined) {
      docService.on('documentCreated', (doc: Document) => {
        this.emit('document:created', doc);
      });

      docService.on('documentUpdated', (doc: Document) => {
        this.emit('document:updated', doc);
      });

      docService.on('documentPublished', (doc: Document) => {
        this.emit('document:published', doc);
      });
    }

    // Bridge forum events
    const forumService = this.documentServices.forum as unknown as EventEmitter;
    if (forumService.on !== undefined) {
      forumService.on('thread:created', (thread: ForumThread) => {
        this.emit('forum:thread:created', thread);
      });

      forumService.on('post:created', (post: ForumPost) => {
        this.emit('forum:post:created', post);
      });
    }

    // Bridge support events
    const supportService = this.documentServices.support as unknown as EventEmitter;
    if (supportService.on !== undefined) {
      supportService.on('support:request:created', (request: SupportRequest) => {
        this.emit('support:request:created', request);
      });

      supportService.on('volunteer:assigned', (data: { sessionId: string; volunteerId: string }) => {
        this.emit('support:volunteer:assigned', data);
      });
    }

    logger.info('Event bridges configured successfully');
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    // Stop health checks
    if (this.healthCheckInterval !== undefined) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Remove all listeners
    this.removeAllListeners();

    // Clear health map
    this.serviceHealthMap.clear();

    logger.info('Direct integration disposed');
  }

  /**
   * Helper methods for common operations
   */

  /**
   * Creates a document with participation score update
   *
   * @param document - Document to create
   * @param authorAddress - Author's address for score update
   * @returns Created document
   */
  async createDocumentWithScoring(document: Document, authorAddress: string): Promise<Document> {
    // Create document
    const created = await this.documentServices.documentation.createDocument(document);

    // Update participation score if validator services available
    if (this.hasValidatorServices()) {
      try {
        await this.validatorServices!.participationScore.updateScore(authorAddress, 10);
      } catch (error) {
        logger.error('Failed to update participation score', { error, authorAddress });
      }
    }

    return created;
  }

  /**
   * Searches across multiple services
   *
   * @param query - Search query
   * @returns Combined search results
   */
  async unifiedSearch(query: string): Promise<{
    documents: unknown[];
    threads: ForumThread[];
  }> {
    const [documentResults, forumResults] = await Promise.all([
      this.documentServices.documentation.searchDocuments({ query, pageSize: 10 }),
      this.documentServices.forum.search({ query })
    ]);

    return {
      documents: documentResults.items,
      threads: forumResults.threads ?? []
    };
  }
}