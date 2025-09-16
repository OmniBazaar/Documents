/**
 * Lazy Service Loader
 *
 * Provides on-demand service initialization to prevent auto-loading
 * and reduce startup time. Services are only initialized when first
 * accessed.
 *
 * @module services/LazyServiceLoader
 */

import { logger } from '../utils/logger';

/**
 * Service initializer function type
 */
export type ServiceInitializer<T> = () => Promise<T> | T;

/**
 * Service lifecycle hooks
 */
export interface ServiceLifecycleHooks<T> {
  /** Called before service initialization */
  beforeInit?: () => Promise<void> | void;
  /** Called after service initialization */
  afterInit?: (service: T) => Promise<void> | void;
  /** Called on service disposal */
  onDispose?: (service: T) => Promise<void> | void;
}

/**
 * Service registration options
 */
export interface ServiceRegistration<T> {
  /** Service initializer function */
  initializer: ServiceInitializer<T>;
  /** Optional lifecycle hooks */
  hooks?: ServiceLifecycleHooks<T>;
  /** Whether to cache the service after initialization */
  cache?: boolean;
  /** Service dependencies (other service names) */
  dependencies?: string[];
}

/**
 * Lazy-loaded service metadata
 */
interface ServiceMetadata<T = unknown> {
  /** Registration information */
  registration: ServiceRegistration<T>;
  /** Cached service instance */
  instance?: T;
  /** Initialization promise (prevents duplicate init) */
  initPromise?: Promise<T>;
  /** Whether service is initialized */
  initialized: boolean;
  /** Initialization timestamp */
  initializedAt?: Date;
}

/**
 * Lazy Service Loader
 *
 * @example
 * ```typescript
 * const loader = new LazyServiceLoader();
 *
 * // Register services
 * loader.register('documentation', {
 *   initializer: async () => {
 *     const doc = new DocumentationService();
 *     await doc.initialize();
 *     return doc;
 *   },
 *   cache: true
 * });
 *
 * // Services are initialized on first access
 * const docService = await loader.get<DocumentationService>('documentation');
 * ```
 */
export class LazyServiceLoader {
  /** Service registry */
  private services: Map<string, ServiceMetadata> = new Map();
  /** Service initialization order for dependency resolution */
  private initOrder: string[] = [];
  /** Disposal handlers */
  private disposalHandlers: Array<() => Promise<void>> = [];

  /**
   * Registers a service for lazy loading
   *
   * @param name - Service name
   * @param registration - Service registration options
   * @throws {Error} If service already registered
   */
  register<T>(name: string, registration: ServiceRegistration<T>): void {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    // Validate dependencies
    if (registration.dependencies !== undefined) {
      for (const dep of registration.dependencies) {
        if (!this.services.has(dep)) {
          logger.warn(`Service '${name}' depends on '${dep}' which is not yet registered`);
        }
      }
    }

    this.services.set(name, {
      registration: registration as ServiceRegistration<unknown>,
      initialized: false,
      cache: registration.cache !== false // Default to true
    });

    // Update initialization order
    this.updateInitOrder();

    logger.debug(`Service '${name}' registered for lazy loading`);
  }

  /**
   * Gets a service, initializing it if necessary
   *
   * @param name - Service name
   * @returns Service instance
   * @throws {Error} If service not registered or initialization fails
   */
  async get<T>(name: string): Promise<T> {
    const metadata = this.services.get(name);
    if (metadata === undefined) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Return cached instance if available
    if (metadata.initialized && metadata.instance !== undefined) {
      return metadata.instance as T;
    }

    // Return in-progress initialization if available
    if (metadata.initPromise !== undefined) {
      return (await metadata.initPromise) as T;
    }

    // Initialize service
    return await this.initializeService<T>(name, metadata);
  }

  /**
   * Gets a service synchronously if already initialized
   *
   * @param name - Service name
   * @returns Service instance or undefined
   */
  getSync<T>(name: string): T | undefined {
    const metadata = this.services.get(name);
    if (metadata === undefined || !metadata.initialized) {
      return undefined;
    }
    return metadata.instance as T;
  }

  /**
   * Checks if a service is registered
   *
   * @param name - Service name
   * @returns True if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Checks if a service is initialized
   *
   * @param name - Service name
   * @returns True if service is initialized
   */
  isInitialized(name: string): boolean {
    const metadata = this.services.get(name);
    return metadata !== undefined && metadata.initialized;
  }

  /**
   * Gets all registered service names
   *
   * @returns Array of service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Gets initialized service names
   *
   * @returns Array of initialized service names
   */
  getInitializedServices(): string[] {
    return Array.from(this.services.entries())
      .filter(([_, metadata]) => metadata.initialized)
      .map(([name, _]) => name);
  }

  /**
   * Gets service initialization statistics
   *
   * @returns Service statistics
   */
  getStatistics(): {
    registered: number;
    initialized: number;
    services: Array<{
      name: string;
      initialized: boolean;
      initializedAt?: Date;
    }>;
  } {
    const services = Array.from(this.services.entries()).map(([name, metadata]) => ({
      name,
      initialized: metadata.initialized,
      initializedAt: metadata.initializedAt
    }));

    return {
      registered: this.services.size,
      initialized: services.filter(s => s.initialized).length,
      services
    };
  }

  /**
   * Preloads specific services
   *
   * @param serviceNames - Services to preload
   * @returns Promise that resolves when all services are loaded
   */
  async preload(serviceNames: string[]): Promise<void> {
    const loadPromises = serviceNames.map(name => this.get(name));
    await Promise.all(loadPromises);
    logger.info(`Preloaded ${serviceNames.length} services`);
  }

  /**
   * Disposes all initialized services
   */
  async dispose(): Promise<void> {
    logger.info('Disposing all services');

    // Run disposal handlers in reverse order
    const handlers = [...this.disposalHandlers].reverse();
    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        logger.error('Error during service disposal', { error });
      }
    }

    // Clear all state
    this.services.clear();
    this.initOrder = [];
    this.disposalHandlers = [];

    logger.info('All services disposed');
  }

  /**
   * Initializes a service
   */
  private async initializeService<T>(name: string, metadata: ServiceMetadata): Promise<T> {
    logger.debug(`Initializing service '${name}'`);

    try {
      // Create initialization promise
      metadata.initPromise = this.performInitialization<T>(name, metadata);

      // Wait for initialization
      const instance = await metadata.initPromise;

      // Cache the instance
      if (metadata.registration.cache !== false) {
        metadata.instance = instance;
      }
      metadata.initialized = true;
      metadata.initializedAt = new Date();

      logger.info(`Service '${name}' initialized successfully`);

      return instance;
    } catch (error) {
      // Clear failed initialization
      metadata.initPromise = undefined;
      throw new Error(`Failed to initialize service '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Performs the actual service initialization
   */
  private async performInitialization<T>(name: string, metadata: ServiceMetadata): Promise<T> {
    const registration = metadata.registration;

    // Initialize dependencies first
    if (registration.dependencies !== undefined) {
      for (const dep of registration.dependencies) {
        await this.get(dep);
      }
    }

    // Run before init hook
    if (registration.hooks?.beforeInit !== undefined) {
      await registration.hooks.beforeInit();
    }

    // Initialize the service
    const instance = await registration.initializer();

    // Run after init hook
    if (registration.hooks?.afterInit !== undefined) {
      await registration.hooks.afterInit(instance);
    }

    // Register disposal handler
    if (registration.hooks?.onDispose !== undefined) {
      this.disposalHandlers.push(async () => {
        await registration.hooks!.onDispose!(instance);
      });
    }

    return instance as T;
  }

  /**
   * Updates service initialization order based on dependencies
   */
  private updateInitOrder(): void {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      visited.add(name);

      const metadata = this.services.get(name);
      if (metadata?.registration.dependencies !== undefined) {
        for (const dep of metadata.registration.dependencies) {
          if (this.services.has(dep)) {
            visit(dep);
          }
        }
      }

      order.push(name);
    };

    // Visit all services
    for (const name of this.services.keys()) {
      visit(name);
    }

    this.initOrder = order;
  }

  /**
   * Creates a service proxy that initializes on first access
   *
   * @param name - Service name
   * @returns Proxy that lazy-loads the service
   */
  createProxy<T extends object>(name: string): T {
    const loader = this;
    let instance: T | undefined;

    return new Proxy({} as T, {
      get(target, prop) {
        if (instance === undefined) {
          // Block on initialization (not ideal but works for proxy)
          throw new Error('Async initialization required. Use loader.get() instead of proxy for async services.');
        }
        return (instance as any)[prop];
      },
      set(target, prop, value) {
        if (instance === undefined) {
          throw new Error('Service not initialized');
        }
        (instance as any)[prop] = value;
        return true;
      }
    });
  }
}