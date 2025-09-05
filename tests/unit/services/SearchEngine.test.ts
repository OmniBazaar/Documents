/**
 * SearchEngine Unit Tests
 * 
 * Tests the search functionality including:
 * - Full-text search
 * - Filtering and faceting
 * - Relevance ranking
 * - Search suggestions
 * - Index management
 */

import { SearchEngine } from '@/services/search/SearchEngine';
import { 
  setupTestServices, 
  teardownTestServices, 
  generateTestDocument,
  TEST_USERS,
} from '@tests/setup/testSetup';

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  let services: any;

  beforeAll(async () => {
    services = await setupTestServices();
    searchEngine = services.search;
    
    // Index test documents
    const documents = [
      {
        id: 'doc-1',
        title: 'Getting Started with OmniBazaar',
        content: 'A comprehensive guide to using the OmniBazaar marketplace platform.',
        category: 'guides',
        tags: ['beginner', 'tutorial', 'marketplace'],
        author: TEST_USERS.admin,
      },
      {
        id: 'doc-2', 
        title: 'Advanced Trading Strategies',
        content: 'Learn advanced techniques for trading on the decentralized exchange.',
        category: 'trading',
        tags: ['advanced', 'trading', 'dex'],
        author: TEST_USERS.admin,
      },
      {
        id: 'doc-3',
        title: 'Blockchain Technology Explained',
        content: 'Understanding the blockchain technology that powers OmniBazaar.',
        category: 'technical',
        tags: ['blockchain', 'technology', 'technical'],
        author: TEST_USERS.admin,
      },
      {
        id: 'doc-4',
        title: 'Security Best Practices',
        content: 'Keep your assets safe with these security recommendations.',
        category: 'security',
        tags: ['security', 'safety', 'best-practices'],
        author: TEST_USERS.admin,
      },
    ];
    
    for (const doc of documents) {
      await searchEngine.indexDocument(doc);
    }
  });

  afterAll(async () => {
    await searchEngine.clearIndex();
    await teardownTestServices();
  });

  describe('Basic Search', () => {
    test('should find documents by title keyword', async () => {
      const results = await searchEngine.search('blockchain');
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.hits.some(hit => 
        hit.title.toLowerCase().includes('blockchain')
      )).toBe(true);
    });

    test('should find documents by content keyword', async () => {
      const results = await searchEngine.search('marketplace');
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.hits[0].highlights).toBeDefined();
    });

    test('should handle multi-word queries', async () => {
      const results = await searchEngine.search('trading strategies');
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.hits[0].title).toContain('Trading');
    });

    test('should return empty results for non-existent terms', async () => {
      const results = await searchEngine.search('nonexistentterm123');
      
      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });
  });

  describe('Advanced Search Features', () => {
    test('should support phrase search', async () => {
      const results = await searchEngine.search('"blockchain technology"');
      
      expect(results.hits.every(hit => 
        hit.content.includes('blockchain technology') ||
        hit.title.includes('Blockchain Technology')
      )).toBe(true);
    });

    test('should support wildcard search', async () => {
      const results = await searchEngine.search('block*');
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.hits.some(hit => 
        hit.content.toLowerCase().includes('blockchain')
      )).toBe(true);
    });

    test('should support fuzzy search', async () => {
      const results = await searchEngine.search('blokchain~'); // Misspelled
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.hits.some(hit => 
        hit.content.toLowerCase().includes('blockchain')
      )).toBe(true);
    });

    test('should support boolean operators', async () => {
      const results = await searchEngine.search('trading AND advanced');
      
      expect(results.hits.every(hit => 
        hit.content.includes('trading') && hit.content.includes('advanced')
      )).toBe(true);
    });
  });

  describe('Filtering', () => {
    test('should filter by category', async () => {
      const results = await searchEngine.search('*', {
        filters: { category: 'guides' }
      });
      
      expect(results.hits.every(hit => hit.category === 'guides')).toBe(true);
    });

    test('should filter by tags', async () => {
      const results = await searchEngine.search('*', {
        filters: { tags: ['security'] }
      });
      
      expect(results.hits.every(hit => 
        hit.tags.includes('security')
      )).toBe(true);
    });

    test('should filter by author', async () => {
      const results = await searchEngine.search('*', {
        filters: { author: TEST_USERS.admin }
      });
      
      expect(results.hits.every(hit => hit.author === TEST_USERS.admin)).toBe(true);
    });

    test('should support multiple filters', async () => {
      const results = await searchEngine.search('*', {
        filters: {
          category: 'guides',
          tags: ['tutorial']
        }
      });
      
      expect(results.hits.every(hit => 
        hit.category === 'guides' && hit.tags.includes('tutorial')
      )).toBe(true);
    });
  });

  describe('Faceting', () => {
    test('should return category facets', async () => {
      const results = await searchEngine.search('*', {
        facets: ['category']
      });
      
      expect(results.facets).toBeDefined();
      expect(results.facets.category).toBeDefined();
      expect(Object.keys(results.facets.category).length).toBeGreaterThan(0);
    });

    test('should return tag facets', async () => {
      const results = await searchEngine.search('*', {
        facets: ['tags']
      });
      
      expect(results.facets.tags).toBeDefined();
      expect(results.facets.tags['tutorial']).toBeGreaterThan(0);
    });

    test('should calculate facet counts correctly', async () => {
      const results = await searchEngine.search('*', {
        facets: ['category']
      });
      
      const totalFromFacets = Object.values(results.facets.category)
        .reduce((sum: number, count: any) => sum + count, 0);
      
      expect(totalFromFacets).toBe(results.total);
    });
  });

  describe('Relevance Ranking', () => {
    test('should rank title matches higher than content matches', async () => {
      // Index documents where one has keyword in title, other in content
      await searchEngine.indexDocument({
        id: 'title-match',
        title: 'Unique Keyword Test',
        content: 'Some other content',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
      });
      
      await searchEngine.indexDocument({
        id: 'content-match',
        title: 'Another Document',
        content: 'This has the unique keyword in content',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
      });
      
      const results = await searchEngine.search('unique keyword');
      
      const titleMatchIndex = results.hits.findIndex(hit => hit.id === 'title-match');
      const contentMatchIndex = results.hits.findIndex(hit => hit.id === 'content-match');
      
      expect(titleMatchIndex).toBeLessThan(contentMatchIndex);
    });

    test('should boost recent documents', async () => {
      const oldDoc = {
        id: 'old-doc',
        title: 'Boost Test Document',
        content: 'Testing relevance boosting',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
        createdAt: new Date('2023-01-01'),
      };
      
      const newDoc = {
        id: 'new-doc',
        title: 'Boost Test Document',
        content: 'Testing relevance boosting',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
        createdAt: new Date(),
      };
      
      await searchEngine.indexDocument(oldDoc);
      await searchEngine.indexDocument(newDoc);
      
      const results = await searchEngine.search('boost test');
      
      const newDocIndex = results.hits.findIndex(hit => hit.id === 'new-doc');
      const oldDocIndex = results.hits.findIndex(hit => hit.id === 'old-doc');
      
      expect(newDocIndex).toBeLessThan(oldDocIndex);
    });
  });

  describe('Search Suggestions', () => {
    test('should provide search suggestions', async () => {
      const suggestions = await searchEngine.getSuggestions('block');
      
      expect(suggestions).toContain('blockchain');
    });

    test('should handle typos in suggestions', async () => {
      const suggestions = await searchEngine.getSuggestions('secrity'); // Typo
      
      expect(suggestions).toContain('security');
    });

    test('should limit number of suggestions', async () => {
      const suggestions = await searchEngine.getSuggestions('t', { limit: 3 });
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Highlighting', () => {
    test('should highlight search terms in results', async () => {
      const results = await searchEngine.search('blockchain', {
        highlight: true
      });
      
      const hit = results.hits.find(h => h.content.includes('blockchain'));
      expect(hit?.highlights).toBeDefined();
      expect(hit?.highlights.content).toContain('<mark>');
    });

    test('should highlight multiple terms', async () => {
      const results = await searchEngine.search('trading marketplace', {
        highlight: true
      });
      
      if (results.total > 0) {
        const highlights = results.hits[0].highlights;
        expect(
          highlights.content?.includes('<mark>trading</mark>') ||
          highlights.content?.includes('<mark>marketplace</mark>')
        ).toBe(true);
      }
    });
  });

  describe('Pagination', () => {
    test('should paginate results', async () => {
      const page1 = await searchEngine.search('*', {
        page: 1,
        pageSize: 2
      });
      
      const page2 = await searchEngine.search('*', {
        page: 2,
        pageSize: 2
      });
      
      expect(page1.hits.length).toBeLessThanOrEqual(2);
      expect(page2.hits.length).toBeLessThanOrEqual(2);
      expect(page1.hits[0].id).not.toBe(page2.hits[0]?.id);
    });

    test('should calculate total pages correctly', async () => {
      const results = await searchEngine.search('*', {
        page: 1,
        pageSize: 2
      });
      
      expect(results.totalPages).toBe(Math.ceil(results.total / 2));
    });
  });

  describe('Index Management', () => {
    test('should update existing documents', async () => {
      const docId = 'update-test';
      
      await searchEngine.indexDocument({
        id: docId,
        title: 'Original Title',
        content: 'Original content',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
      });
      
      await searchEngine.updateDocument(docId, {
        title: 'Updated Title',
        content: 'Updated content',
      });
      
      const results = await searchEngine.search('Updated Title');
      
      expect(results.hits[0].title).toBe('Updated Title');
    });

    test('should remove documents from index', async () => {
      const docId = 'delete-test';
      
      await searchEngine.indexDocument({
        id: docId,
        title: 'Document to Delete',
        content: 'This will be deleted',
        category: 'test',
        tags: [],
        author: TEST_USERS.admin,
      });
      
      await searchEngine.removeDocument(docId);
      
      const results = await searchEngine.search('Document to Delete');
      
      expect(results.total).toBe(0);
    });

    test('should handle batch indexing', async () => {
      const documents = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-${i}`,
        title: `Batch Document ${i}`,
        content: 'Batch indexing test',
        category: 'batch-test',
        tags: [],
        author: TEST_USERS.admin,
      }));
      
      await searchEngine.batchIndex(documents);
      
      const results = await searchEngine.search('*', {
        filters: { category: 'batch-test' }
      });
      
      expect(results.total).toBe(10);
    });
  });

  describe('Performance', () => {
    test('should handle large result sets efficiently', async () => {
      // Index many documents
      const docs = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-${i}`,
        title: `Performance Test ${i}`,
        content: 'Testing search performance with many documents',
        category: 'performance',
        tags: ['test', 'performance'],
        author: TEST_USERS.admin,
      }));
      
      await searchEngine.batchIndex(docs);
      
      const start = Date.now();
      const results = await searchEngine.search('performance', {
        pageSize: 50
      });
      const duration = Date.now() - start;
      
      expect(results.total).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should cache frequent searches', async () => {
      const query = 'cached search test';
      
      // First search - uncached
      const start1 = Date.now();
      await searchEngine.search(query);
      const duration1 = Date.now() - start1;
      
      // Second search - should be cached
      const start2 = Date.now();
      await searchEngine.search(query);
      const duration2 = Date.now() - start2;
      
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid queries gracefully', async () => {
      const invalidQueries = [
        '(((', // Unbalanced parentheses
        '""',  // Empty phrase
        'AND', // Standalone operator
        '*',   // Wildcard only
      ];
      
      for (const query of invalidQueries) {
        const results = await searchEngine.search(query);
        expect(results).toBeDefined();
        expect(results.hits).toBeDefined();
      }
    });

    test('should handle missing index gracefully', async () => {
      const tempEngine = new SearchEngine('nonexistent-index');
      const results = await tempEngine.search('test');
      
      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });
  });
});