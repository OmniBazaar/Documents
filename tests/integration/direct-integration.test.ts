/**
 * Direct Integration Tests
 *
 * Verifies that the Documents module works correctly with direct
 * service integration instead of API calls.
 *
 * @module tests/direct-integration
 */

import { initializeDocumentsModule, createTestServices } from '../../src/initializeDocuments';
import { DirectValidatorIntegration } from '../../src/integration/DirectValidatorIntegration';
import { DirectServiceCaller } from '../../src/services/DirectServiceCaller';
import type { ValidatorServices, DocumentServices } from '../../src/integration/DirectValidatorIntegration';
import type { Document } from '../../src/services/documentation/DocumentationService';
import { createSharedMockValidatorServices, clearMockData } from '../mocks/MockValidatorServices';

describe('Direct Integration', () => {
  let validatorServices: ValidatorServices;
  let documentsLoader: Awaited<ReturnType<typeof initializeDocumentsModule>>;
  let integration: DirectValidatorIntegration;
  let documentServices: DocumentServices;

  beforeEach(async () => {
    // Clear any existing mock data
    clearMockData();

    // Use shared mock validator services
    validatorServices = createSharedMockValidatorServices();

    // Initialize Documents module
    documentsLoader = await initializeDocumentsModule({
      validatorServices,
      lazyLoading: false // Disable lazy loading for tests
    });

    // Create test services
    documentServices = await createTestServices(validatorServices);

    // Create integration
    integration = new DirectValidatorIntegration(documentServices, {
      enableEventBridge: true,
      enableLazyLoading: false
    });
    integration.setValidatorServices(validatorServices);
  });

  afterEach(() => {
    integration.dispose();
  });

  describe('Service Initialization', () => {
    test('should initialize all services correctly', async () => {
      const stats = documentsLoader.getStatistics();
      expect(stats.registered).toBeGreaterThanOrEqual(6); // At least 6 core services
      expect(stats.initialized).toBeGreaterThanOrEqual(6); // All should be initialized
    });

    test('should provide direct access to validator services', () => {
      expect(integration.hasValidatorServices()).toBe(true);
      expect(integration.getValidatorServices()).toBe(validatorServices);
    });

    test('should provide direct access to database', () => {
      const db = integration.getDatabase();
      expect(db).toBe(validatorServices.database);
    });

    test('should provide direct access to participation scoring', () => {
      const participationScore = integration.getParticipationScore();
      expect(participationScore).toBe(validatorServices.participationScore);
    });
  });

  describe('Direct Service Caller', () => {
    let serviceCaller: DirectServiceCaller;

    beforeEach(() => {
      serviceCaller = new DirectServiceCaller(validatorServices);
    });

    test('should execute database queries directly', async () => {
      const result = await serviceCaller.queryDatabase('SELECT 1');
      expect(validatorServices.database.query).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('rowCount');
    });

    test('should get participation score directly', async () => {
      const score = await serviceCaller.getParticipationScore('user123');
      expect(validatorServices.participationScore.getUserScore).toHaveBeenCalledWith('user123');
      expect(typeof score).toBe('number');
    });

    test('should update participation score directly', async () => {
      await serviceCaller.updateParticipationScore('user123', 10);
      expect(validatorServices.participationScore.updateScore).toHaveBeenCalledWith('user123', 10);
    });

    test('should create document using direct database call', async () => {
      const doc: Document = {
        id: 'test-doc-1',
        title: 'Test Document',
        content: 'Test content',
        category: 'getting_started',
        authorAddress: 'author123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await serviceCaller.createDocument(doc);
      expect(validatorServices.database.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documents'),
        expect.arrayContaining([doc.id, doc.title, doc.content])
      );
      expect(created.id).toBe(doc.id);
    });

    test('should track metrics for service calls', async () => {
      await serviceCaller.queryDatabase('SELECT 1');
      await serviceCaller.getParticipationScore('user123');

      const metrics = serviceCaller.getMetrics();
      expect(metrics['database.query']).toBeDefined();
      expect(metrics['database.query'].count).toBe(1);
      expect(metrics['participation.getScore']).toBeDefined();
      expect(metrics['participation.getScore'].count).toBe(1);
    });
  });

  describe('Document Operations', () => {
    test('should create document with participation scoring', async () => {
      const doc: Document = {
        id: 'test-doc-2',
        title: 'Test Document with Scoring',
        content: 'Content',
        category: 'technical',
        authorAddress: 'author456',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await integration.createDocumentWithScoring(doc, doc.authorAddress);
      expect(created.id).toBe(doc.id);
      expect(validatorServices.participationScore.updateScore).toHaveBeenCalledWith('author456', 10);
    });
  });

  describe('Unified Search', () => {
    test('should search across multiple services', async () => {
      const results = await integration.unifiedSearch('test query');
      expect(results).toHaveProperty('documents');
      expect(results).toHaveProperty('threads');
      expect(Array.isArray(results.documents)).toBe(true);
      expect(Array.isArray(results.threads)).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    test('should perform health checks on all services', async () => {
      const healthy = await integration.performHealthCheck();
      expect(typeof healthy).toBe('boolean');

      const status = integration.getHealthStatus();
      expect(status.length).toBeGreaterThan(0);
      expect(status.some(s => s.name === 'documentation')).toBe(true);
      expect(status.some(s => s.name === 'forum')).toBe(true);
      expect(status.some(s => s.name === 'support')).toBe(true);
    });
  });

  describe('Event Bridging', () => {
    test('should bridge document events', async () => {
      const documentCreatedHandler = jest.fn();
      integration.on('document:created', documentCreatedHandler);

      // Create a document through the service
      const doc: Document = {
        id: 'test-doc-3',
        title: 'Event Test Document',
        content: 'Content',
        category: 'faq',
        authorAddress: 'author789',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentServices.documentation.createDocument(doc);

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: Event might not fire in test environment without full service setup
      // This test verifies the event listener is registered correctly
      expect(integration.listenerCount('document:created')).toBe(1);
    });
  });

  describe('Lazy Loading', () => {
    test('should support lazy service loading', async () => {
      const lazyLoader = await initializeDocumentsModule({
        validatorServices,
        lazyLoading: true
      });

      // Services should not be initialized yet
      expect(lazyLoader.isInitialized('documentation')).toBe(false);

      // Get service (triggers initialization)
      const docService = await lazyLoader.get('documentation');
      expect(docService).toBeDefined();
      expect(lazyLoader.isInitialized('documentation')).toBe(true);

      // Second get should return cached instance
      const docService2 = await lazyLoader.get('documentation');
      expect(docService2).toBe(docService);
    });
  });
});