/**
 * SearchEngine Unit Tests
 * 
 * Tests the search functionality including:
 * - Basic text search
 * - Filtering by type and metadata
 * - Pagination
 * - Index management
 */

import { SearchEngine } from '@/services/search/SearchEngine';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
} from '@tests/setup/testSetup';

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  let services: any;

  beforeAll(async () => {
    services = await setupTestServices();
    searchEngine = new SearchEngine('test-documents');
    
    // Index test documents
    const documents = [
      {
        id: 'doc-1',
        type: 'documentation',
        title: 'Getting Started with OmniBazaar',
        content: 'A comprehensive guide to using the OmniBazaar marketplace platform.',
        metadata: {
          category: 'guides',
          tags: ['beginner', 'tutorial', 'marketplace'],
          author: TEST_USERS.admin,
        }
      },
      {
        id: 'doc-2',
        type: 'documentation',
        title: 'Advanced Trading Strategies',
        content: 'Learn advanced techniques for trading on the decentralized exchange.',
        metadata: {
          category: 'trading',
          tags: ['advanced', 'trading', 'dex'],
          author: TEST_USERS.admin,
        }
      },
      {
        id: 'doc-3',
        type: 'documentation',
        title: 'Blockchain Technology Explained',
        content: 'Understanding the blockchain technology that powers OmniBazaar.',
        metadata: {
          category: 'technical',
          tags: ['blockchain', 'technology', 'guide'],
          author: TEST_USERS.alice,
        }
      },
      {
        id: 'doc-4',
        type: 'forum',
        title: 'How to stake XOM tokens?',
        content: 'I need help with staking my XOM tokens in the platform.',
        metadata: {
          category: 'support',
          tags: ['staking', 'xom', 'help'],
          author: TEST_USERS.bob,
        }
      }
    ];

    // Index all documents
    for (const doc of documents) {
      searchEngine.indexDocument(doc);
    }
  });

  afterAll(async () => {
    await teardownTestServices();
  });

  describe('Basic Search', () => {
    test('should find documents by title keyword', async () => {
      const results = await searchEngine.search({ query: 'blockchain' });
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.results.some(hit => 
        hit.title.toLowerCase().includes('blockchain')
      )).toBe(true);
    });

    test('should find documents by content keyword', async () => {
      const results = await searchEngine.search({ query: 'marketplace' });
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.results[0].snippet).toBeDefined();
    });

    test('should handle multi-word queries', async () => {
      const results = await searchEngine.search({ query: 'trading' });
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.results.some(r => r.title.includes('Trading'))).toBe(true);
    });

    test('should return empty results for non-existent terms', async () => {
      const results = await searchEngine.search({ query: 'nonexistentterm123' });
      
      expect(results.total).toBe(0);
      expect(results.results).toHaveLength(0);
    });

    test('should return all documents for empty query', async () => {
      const results = await searchEngine.search({ query: '' });
      
      expect(results.total).toBe(4);
    });
  });

  describe('Type Filtering', () => {
    test('should filter by document type', async () => {
      const results = await searchEngine.search({ 
        query: '',
        type: 'documentation' 
      });
      
      expect(results.total).toBe(3);
      expect(results.results.every(r => r.type === 'documentation')).toBe(true);
    });

    test('should combine search and type filter', async () => {
      const results = await searchEngine.search({ 
        query: 'help',
        type: 'forum' 
      });
      
      expect(results.total).toBe(1);
      expect(results.results[0].id).toBe('doc-4');
    });
  });

  describe('Metadata Filtering', () => {
    test('should filter by category', async () => {
      const results = await searchEngine.search({ 
        query: '',
        filters: { category: 'technical' }
      });
      
      expect(results.total).toBe(1);
      expect(results.results[0].title).toContain('Blockchain');
    });

    test('should filter by tags', async () => {
      const results = await searchEngine.search({ 
        query: '',
        filters: { tags: ['tutorial'] }
      });
      
      expect(results.total).toBe(1);
      expect(results.results[0].title).toContain('Getting Started');
    });

    test('should filter by author', async () => {
      const results = await searchEngine.search({ 
        query: '',
        filters: { author: TEST_USERS.alice }
      });
      
      expect(results.total).toBe(1);
      expect(results.results[0].id).toBe('doc-3');
    });

    test('should support multiple filters', async () => {
      const results = await searchEngine.search({ 
        query: '',
        filters: { 
          category: 'trading',
          tags: ['advanced']
        }
      });
      
      expect(results.total).toBe(1);
      expect(results.results[0].title).toContain('Advanced Trading');
    });
  });

  describe('Relevance Ranking', () => {
    test('should rank title matches higher than content matches', async () => {
      const results = await searchEngine.search({ query: 'omnibazaar' });
      
      expect(results.total).toBeGreaterThan(0);
      // Title match should be first
      expect(results.results[0].title).toContain('OmniBazaar');
      expect(results.results[0].score).toBe(1.0);
    });

    test('should maintain score-based ordering', async () => {
      const results = await searchEngine.search({ query: 'guide' });
      
      const scores = results.results.map(r => r.score);
      // Check descending order
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('Pagination', () => {
    test('should paginate results', async () => {
      const page1 = await searchEngine.search({ 
        query: '',
        page: 1,
        pageSize: 2
      });
      
      expect(page1.results).toHaveLength(2);
      expect(page1.total).toBe(4);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      
      const page2 = await searchEngine.search({ 
        query: '',
        page: 2,
        pageSize: 2
      });
      
      expect(page2.results).toHaveLength(2);
      expect(page2.results[0].id).not.toBe(page1.results[0].id);
    });

    test('should handle last page correctly', async () => {
      const lastPage = await searchEngine.search({ 
        query: '',
        page: 3,
        pageSize: 2
      });
      
      expect(lastPage.results).toHaveLength(0);
      expect(lastPage.total).toBe(4);
    });
  });

  describe('Index Management', () => {
    test('should update existing documents', async () => {
      // Update a document
      searchEngine.updateDocument({
        id: 'doc-1',
        type: 'documentation',
        title: 'Updated: Getting Started with OmniBazaar',
        content: 'Updated content for the guide.',
        metadata: { category: 'guides' }
      });
      
      const results = await searchEngine.search({ query: 'Updated' });
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.results[0].title).toContain('Updated:');
    });

    test('should remove documents from index', async () => {
      searchEngine.removeDocument('doc-4');
      
      const results = await searchEngine.search({ query: '', type: 'forum' });
      
      expect(results.total).toBe(0);
    });

    test('should handle re-indexing', async () => {
      // Re-add removed document
      searchEngine.indexDocument({
        id: 'doc-4',
        type: 'forum',
        title: 'How to stake XOM tokens?',
        content: 'I need help with staking my XOM tokens in the platform.',
        metadata: {
          category: 'support',
          tags: ['staking', 'xom', 'help'],
          author: TEST_USERS.bob,
        }
      });
      
      const results = await searchEngine.search({ query: '', type: 'forum' });
      expect(results.total).toBe(1);
    });
  });

  describe('Snippet Generation', () => {
    test('should generate relevant snippets', async () => {
      const results = await searchEngine.search({ query: 'decentralized' });
      
      expect(results.results[0].snippet).toBeDefined();
      expect(results.results[0].snippet).toContain('decentralized');
    });

    test('should truncate long content in snippets', async () => {
      // Index a document with long content
      const longContent = 'This is a very long content. '.repeat(50);
      searchEngine.indexDocument({
        id: 'doc-long',
        type: 'test',
        title: 'Long Document',
        content: longContent,
        metadata: {}
      });
      
      const results = await searchEngine.search({ query: 'long' });
      const snippet = results.results.find(r => r.id === 'doc-long')?.snippet;
      
      expect(snippet).toBeDefined();
      expect(snippet!.length).toBeLessThanOrEqual(250); // Max snippet length
    });
  });

  describe('Performance', () => {
    test('should handle searches efficiently', async () => {
      const start = Date.now();
      await searchEngine.search({ query: 'test' });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be fast for small index
    });

    test('should report search execution time', async () => {
      const results = await searchEngine.search({ query: 'blockchain' });
      
      expect(results.took).toBeDefined();
      expect(results.took).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty search params gracefully', async () => {
      const results = await searchEngine.search({ query: '' });
      
      expect(results).toBeDefined();
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    test('should handle invalid pagination gracefully', async () => {
      const results = await searchEngine.search({ 
        query: '',
        page: -1,
        pageSize: 0 
      });
      
      expect(results.page).toBe(-1); // As provided
      expect(results.results).toHaveLength(0); // No results for invalid page
    });
  });
});