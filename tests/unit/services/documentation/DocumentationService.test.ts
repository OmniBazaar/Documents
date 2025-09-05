/**
 * DocumentationService Unit Tests
 * 
 * Tests the core documentation management functionality including:
 * - CRUD operations
 * - Version control
 * - Multilingual support
 * - Search functionality
 * - Consensus validation
 * - IPFS integration
 */

import { DocumentationService } from '@/services/documentation/DocumentationService';
import { Database } from '@/services/database/Database';
import { SearchEngine } from '@/services/search/SearchEngine';
import { ParticipationScoreService } from '@/services/participation/ParticipationScoreService';
import { ValidationService } from '@/services/validation/ValidationService';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  generateTestDocument,
  testHelpers,
  cleanTestData,
} from '@tests/setup/testSetup';

describe('DocumentationService', () => {
  let services: any;
  let docService: DocumentationService;
  let db: Database;

  beforeAll(async () => {
    services = await setupTestServices();
    docService = services.documentation;
    db = services.db;
  });

  afterAll(async () => {
    await cleanTestData(db);
    await teardownTestServices();
  });

  describe('Document CRUD Operations', () => {
    test('should create a new document', async () => {
      const docData = generateTestDocument();
      const doc = await docService.createDocument(docData);

      testHelpers.assertDocument(doc);
      expect(doc.title).toBe(docData.title);
      expect(doc.content).toBe(docData.content);
      expect(doc.authorId).toBe(docData.authorId);
      expect(doc.version).toBe(1);
      expect(doc.status).toBe('draft');
    });

    test('should retrieve a document by ID', async () => {
      const created = await docService.createDocument(generateTestDocument());
      const retrieved = await docService.getDocument(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe(created.title);
    });

    test('should update a document', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      const updates = {
        title: 'Updated Title',
        content: 'Updated content with more details',
        tags: ['updated', 'test', 'documentation'],
      };

      const updated = await docService.updateDocument(doc.id, updates, doc.authorId);

      expect(updated.title).toBe(updates.title);
      expect(updated.content).toBe(updates.content);
      expect(updated.tags).toEqual(updates.tags);
      expect(updated.version).toBe(2); // Version should increment
    });

    test('should delete a document', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      const result = await docService.deleteDocument(doc.id, doc.authorId);

      expect(result).toBe(true);

      // Verify deletion
      await expect(docService.getDocument(doc.id)).rejects.toThrow();
    });

    test('should prevent unauthorized updates', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      
      await expect(
        docService.updateDocument(doc.id, { title: 'Hacked' }, TEST_USERS.bob)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Document Versioning', () => {
    test('should track document versions', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      
      // Make multiple updates
      await docService.updateDocument(doc.id, { title: 'Version 2' }, doc.authorId);
      await docService.updateDocument(doc.id, { title: 'Version 3' }, doc.authorId);
      
      const versions = await docService.getDocumentVersions(doc.id);
      
      expect(versions.length).toBe(3);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(3);
    });

    test('should retrieve specific version', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      await docService.updateDocument(doc.id, { title: 'Version 2' }, doc.authorId);
      
      const v1 = await docService.getDocumentVersion(doc.id, 1);
      const v2 = await docService.getDocumentVersion(doc.id, 2);
      
      expect(v1.title).toBe(doc.title);
      expect(v2.title).toBe('Version 2');
    });

    test('should restore previous version', async () => {
      const originalTitle = 'Original Title';
      const doc = await docService.createDocument(generateTestDocument({ title: originalTitle }));
      
      // Update to new version
      await docService.updateDocument(doc.id, { title: 'New Title' }, doc.authorId);
      
      // Restore version 1
      const restored = await docService.restoreVersion(doc.id, 1, doc.authorId);
      
      expect(restored.title).toBe(originalTitle);
      expect(restored.version).toBe(3); // New version created from restore
    });
  });

  describe('Multilingual Support', () => {
    test('should create documents in different languages', async () => {
      const enDoc = await docService.createDocument(generateTestDocument({ language: 'en' }));
      const esDoc = await docService.createDocument(generateTestDocument({ language: 'es' }));
      const frDoc = await docService.createDocument(generateTestDocument({ language: 'fr' }));
      
      expect(enDoc.language).toBe('en');
      expect(esDoc.language).toBe('es');
      expect(frDoc.language).toBe('fr');
    });

    test('should filter documents by language', async () => {
      // Create docs in different languages
      await docService.createDocument(generateTestDocument({ 
        language: 'en',
        category: 'multilang-test' 
      }));
      await docService.createDocument(generateTestDocument({ 
        language: 'es',
        category: 'multilang-test' 
      }));
      
      const englishDocs = await docService.getDocumentsByLanguage('en', {
        category: 'multilang-test'
      });
      
      expect(englishDocs.items.length).toBeGreaterThan(0);
      expect(englishDocs.items.every(d => d.language === 'en')).toBe(true);
    });

    test('should link translations', async () => {
      const enDoc = await docService.createDocument(generateTestDocument({ 
        language: 'en',
        title: 'English Guide'
      }));
      
      const esDoc = await docService.createDocument(generateTestDocument({ 
        language: 'es',
        title: 'Guía en Español',
        translationOf: enDoc.id
      }));
      
      const translations = await docService.getTranslations(enDoc.id);
      
      expect(translations).toHaveLength(1);
      expect(translations[0].id).toBe(esDoc.id);
      expect(translations[0].language).toBe('es');
    });
  });

  describe('Search Functionality', () => {
    test('should search documents by keyword', async () => {
      await docService.createDocument(generateTestDocument({
        title: 'Blockchain Basics',
        content: 'Learn about blockchain technology and cryptocurrencies',
        tags: ['blockchain', 'crypto', 'tutorial']
      }));
      
      const results = await docService.searchDocuments({
        query: 'blockchain',
        pageSize: 10
      });
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.items.some(d => d.title.includes('Blockchain'))).toBe(true);
    });

    test('should filter search by category', async () => {
      await docService.createDocument(generateTestDocument({
        category: 'tutorials',
        title: 'Search Test Tutorial'
      }));
      
      const results = await docService.searchDocuments({
        query: 'test',
        category: 'tutorials',
        pageSize: 10
      });
      
      expect(results.items.every(d => d.category === 'tutorials')).toBe(true);
    });

    test('should filter search by tags', async () => {
      await docService.createDocument(generateTestDocument({
        tags: ['advanced', 'security', 'test-search']
      }));
      
      const results = await docService.searchDocuments({
        query: '',
        tags: ['test-search'],
        pageSize: 10
      });
      
      expect(results.items.some(d => d.tags.includes('test-search'))).toBe(true);
    });

    test('should paginate search results', async () => {
      // Create multiple documents
      for (let i = 0; i < 15; i++) {
        await docService.createDocument(generateTestDocument({
          title: `Pagination Test ${i}`,
          category: 'pagination-test'
        }));
      }
      
      const page1 = await docService.searchDocuments({
        query: '',
        category: 'pagination-test',
        page: 1,
        pageSize: 10
      });
      
      const page2 = await docService.searchDocuments({
        query: '',
        category: 'pagination-test',
        page: 2,
        pageSize: 10
      });
      
      expect(page1.items.length).toBe(10);
      expect(page2.items.length).toBe(5);
      expect(page1.totalPages).toBe(2);
    });
  });

  describe('Document Publishing and Status', () => {
    test('should publish a draft document', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      expect(doc.status).toBe('draft');
      
      const published = await docService.publishDocument(doc.id, doc.authorId);
      
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();
    });

    test('should unpublish a document', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      await docService.publishDocument(doc.id, doc.authorId);
      
      const unpublished = await docService.unpublishDocument(doc.id, doc.authorId);
      
      expect(unpublished.status).toBe('draft');
    });

    test('should archive a document', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      
      const archived = await docService.archiveDocument(doc.id, doc.authorId);
      
      expect(archived.status).toBe('archived');
    });

    test('should filter by status', async () => {
      const draft = await docService.createDocument(generateTestDocument({
        category: 'status-test'
      }));
      
      const published = await docService.createDocument(generateTestDocument({
        category: 'status-test'
      }));
      await docService.publishDocument(published.id, published.authorId);
      
      const publishedDocs = await docService.searchDocuments({
        query: '',
        category: 'status-test',
        status: 'published'
      });
      
      expect(publishedDocs.items.every(d => d.status === 'published')).toBe(true);
      expect(publishedDocs.items.some(d => d.id === draft.id)).toBe(false);
    });
  });

  describe('Categories and Organization', () => {
    test('should list all categories', async () => {
      // Create docs in various categories
      await docService.createDocument(generateTestDocument({ category: 'guides' }));
      await docService.createDocument(generateTestDocument({ category: 'tutorials' }));
      await docService.createDocument(generateTestDocument({ category: 'references' }));
      
      const categories = await docService.getCategories();
      
      expect(categories).toContain('guides');
      expect(categories).toContain('tutorials');
      expect(categories).toContain('references');
    });

    test('should get category statistics', async () => {
      const testCategory = 'stats-test-' + Date.now();
      
      // Create multiple docs in category
      for (let i = 0; i < 5; i++) {
        await docService.createDocument(generateTestDocument({ 
          category: testCategory 
        }));
      }
      
      const stats = await docService.getCategoryStats(testCategory);
      
      expect(stats.totalDocuments).toBe(5);
      expect(stats.category).toBe(testCategory);
    });

    test('should validate category names', async () => {
      await expect(
        docService.createDocument(generateTestDocument({ 
          category: 'invalid category!' // Contains invalid characters
        }))
      ).rejects.toThrow('Invalid category');
    });
  });

  describe('Consensus Validation', () => {
    test('should request consensus validation', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      
      const result = await docService.requestConsensusValidation(doc.id, doc.authorId);
      
      expect(result.documentId).toBe(doc.id);
      expect(result.status).toBeDefined();
      expect(['pending', 'approved', 'rejected']).toContain(result.status);
    });

    test('should get consensus status', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      await docService.requestConsensusValidation(doc.id, doc.authorId);
      
      const status = await docService.getConsensusStatus(doc.id);
      
      expect(status).toBeDefined();
      expect(status.documentId).toBe(doc.id);
    });
  });

  describe('Participation Score Integration', () => {
    test('should award points for document creation', async () => {
      const initialScore = await services.participation.getUserScore(TEST_USERS.alice);
      
      await docService.createDocument(generateTestDocument({
        authorId: TEST_USERS.alice
      }));
      
      const newScore = await services.participation.getUserScore(TEST_USERS.alice);
      
      expect(newScore.total).toBeGreaterThan(initialScore.total);
      expect(newScore.components.documentation).toBeGreaterThan(
        initialScore.components.documentation
      );
    });

    test('should award points for helpful documents', async () => {
      const doc = await docService.createDocument(generateTestDocument({
        authorId: TEST_USERS.bob
      }));
      
      // Simulate document being marked as helpful
      await docService.markDocumentHelpful(doc.id, TEST_USERS.alice);
      
      const authorScore = await services.participation.getUserScore(TEST_USERS.bob);
      expect(authorScore.components.documentation).toBeGreaterThan(0);
    });
  });

  describe('IPFS Integration', () => {
    test('should store document content in IPFS', async () => {
      const doc = await docService.createDocument(generateTestDocument({
        content: 'This content should be stored in IPFS'
      }));
      
      // Publish to trigger IPFS storage
      const published = await docService.publishDocument(doc.id, doc.authorId);
      
      expect(published.ipfsHash).toBeDefined();
      expect(published.ipfsHash).toMatch(/^Qm[a-zA-Z0-9]{44}$/); // IPFS hash format
    });

    test('should retrieve document from IPFS', async () => {
      const originalContent = 'Content for IPFS retrieval test';
      const doc = await docService.createDocument(generateTestDocument({
        content: originalContent
      }));
      
      const published = await docService.publishDocument(doc.id, doc.authorId);
      
      // Retrieve from IPFS
      const retrieved = await docService.getDocumentFromIPFS(published.ipfsHash!);
      
      expect(retrieved.content).toBe(originalContent);
    });
  });

  describe('Error Handling', () => {
    test('should handle document not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      await expect(docService.getDocument(fakeId)).rejects.toThrow('Document not found');
    });

    test('should handle invalid document data', async () => {
      await expect(
        docService.createDocument({
          title: '', // Empty title
          content: generateTestDocument().content,
          category: 'test',
          authorId: TEST_USERS.alice,
        } as any)
      ).rejects.toThrow();
    });

    test('should handle database errors gracefully', async () => {
      // Temporarily break database connection
      const originalQuery = db.query.bind(db);
      db.query = jest.fn().mockRejectedValue(new Error('Database connection lost'));
      
      await expect(
        docService.createDocument(generateTestDocument())
      ).rejects.toThrow('Database');
      
      // Restore
      db.query = originalQuery;
    });
  });

  describe('Performance', () => {
    test('should handle bulk operations efficiently', async () => {
      const start = Date.now();
      const promises = [];
      
      // Create 100 documents in parallel
      for (let i = 0; i < 100; i++) {
        promises.push(
          docService.createDocument(generateTestDocument({
            title: `Bulk Test ${i}`,
            category: 'performance-test'
          }))
        );
      }
      
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);
      
      // Verify all created
      const results = await docService.searchDocuments({
        query: '',
        category: 'performance-test',
        pageSize: 200
      });
      
      expect(results.total).toBeGreaterThanOrEqual(100);
    });

    test('should cache frequently accessed documents', async () => {
      const doc = await docService.createDocument(generateTestDocument());
      
      // First access - from database
      const start1 = Date.now();
      await docService.getDocument(doc.id);
      const duration1 = Date.now() - start1;
      
      // Second access - from cache (should be faster)
      const start2 = Date.now();
      await docService.getDocument(doc.id);
      const duration2 = Date.now() - start2;
      
      expect(duration2).toBeLessThan(duration1);
    });
  });
});