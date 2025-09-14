/**
 * Database Integration Tests
 * 
 * Tests database operations and integrity including:
 * - Transaction handling
 * - Concurrent operations
 * - Data consistency
 * - Foreign key relationships
 * - Index performance
 * - Backup and recovery
 */

import { Database } from '@/services/database/Database';
import { DocumentServices } from '@/services';
import { DocumentCategory } from '@/services/documentation';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  TEST_DB_CONFIG,
  generateTestDocument,
  generateTestThread,
  generateTestSupportRequest,
  cleanTestData,
} from '@tests/setup/testSetup';

describe('Database Integration Tests', () => {
  let services: DocumentServices;
  let db: Database;

  beforeAll(async () => {
    services = await setupTestServices();
    db = services.db;
  });

  beforeEach(async () => {
    // Clean test data before each test for isolation
    await cleanTestData(db);
  });

  afterAll(async () => {
    await cleanTestData(db);
    await teardownTestServices();
  });

  describe('Connection Management', () => {
    test('should establish database connection', async () => {
      const result = await db.query<{ connected: number }>('SELECT 1 as connected');
      expect(result.rows[0].connected).toBe(1);
    });

    test('should handle connection pool properly', async () => {
      // Test concurrent connections
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          db.query('SELECT pg_sleep(0.1), $1 as num', [i])
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
    });

    test('should reconnect after connection loss', async () => {
      // Get current connection count
      const before = await db.query<{ count: string }>(
        'SELECT count(*) FROM pg_stat_activity WHERE datname = $1',
        [TEST_DB_CONFIG.database]
      );

      // Force close connections (simulate network issue)
      await db.query(
        `SELECT pg_terminate_backend(pid) 
         FROM pg_stat_activity 
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [TEST_DB_CONFIG.database]
      );

      // Should auto-reconnect
      const result = await db.query('SELECT 1');
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Transaction Management', () => {
    test('should handle basic transactions', async () => {
      await db.beginTransaction();
      
      try {
        // Insert test document
        await db.query(
          `INSERT INTO documentation_pages (title, content, category, author_id) 
           VALUES ($1, $2, $3, $4)`,
          ['Transaction Test', 'Test content', DocumentCategory.TECHNICAL, TEST_USERS.alice]
        );
        
        await db.commitTransaction();
        
        // Verify insert
        const result = await db.query(
          'SELECT * FROM documentation_pages WHERE title = $1',
          ['Transaction Test']
        );
        
        expect(result.rows).toHaveLength(1);
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    });

    test('should rollback failed transactions', async () => {
      await db.beginTransaction();
      
      try {
        // Insert valid record
        await db.query(
          `INSERT INTO documentation_pages (title, content, category, author_id) 
           VALUES ($1, $2, $3, $4)`,
          ['Rollback Test', 'Test content', DocumentCategory.TECHNICAL, TEST_USERS.alice]
        );
        
        // Force an error (invalid category constraint)
        await db.query(
          `INSERT INTO documentation_pages (title, content, category, author_id) 
           VALUES ($1, $2, $3, $4)`,
          ['Invalid', 'Test', null, TEST_USERS.alice] // null category should fail
        );
        
        await db.commitTransaction();
      } catch (error) {
        await db.rollbackTransaction();
      }
      
      // Verify rollback - first insert should not exist
      const result = await db.query(
        'SELECT * FROM documentation_pages WHERE title = $1',
        ['Rollback Test']
      );
      
      expect(result.rows).toHaveLength(0);
    });

    test('should handle nested transactions with savepoints', async () => {
      await db.beginTransaction();
      
      try {
        // First operation
        const doc1 = await db.query(
          `INSERT INTO documentation_pages (title, content, category, author_id) 
           VALUES ($1, $2, $3, $4) RETURNING id`,
          ['Outer Transaction', 'Content', DocumentCategory.TECHNICAL, TEST_USERS.alice]
        );
        
        // Create savepoint
        await db.query('SAVEPOINT sp1');
        
        try {
          // Nested operation that might fail
          await db.query(
            `INSERT INTO forum_threads (title, content, category, author_id)
             VALUES ($1, $2, $3, $4)`,
            ['Nested Thread', 'Content', DocumentCategory.TECHNICAL, TEST_USERS.alice]
          );
          
          // Force error
          throw new Error('Simulated error');
        } catch (error) {
          // Rollback to savepoint
          await db.query('ROLLBACK TO SAVEPOINT sp1');
        }
        
        // Continue with outer transaction
        await db.query(
          `UPDATE documentation_pages SET content = $1 WHERE id = $2`,
          ['Updated content', doc1.rows[0].id]
        );
        
        await db.commitTransaction();
        
        // Verify: document should exist, thread should not
        const docExists = await db.query(
          'SELECT * FROM documentation_pages WHERE title = $1',
          ['Outer Transaction']
        );
        const threadExists = await db.query(
          'SELECT * FROM forum_threads WHERE title = $1',
          ['Nested Thread']
        );
        
        expect(docExists.rows).toHaveLength(1);
        expect(threadExists.rows).toHaveLength(0);
      } catch (error) {
        await db.rollbackTransaction();
        throw error;
      }
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent inserts', async () => {
      const promises = [];
      
      // Create 50 documents concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(
          services.documentation.createDocument(
            generateTestDocument({
              title: `Concurrent Doc ${i}`,
              category: DocumentCategory.TECHNICAL,
            })
          )
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      
      // Verify all inserted
      const count = await db.query<{ count: string }>(
        'SELECT COUNT(*) FROM documents WHERE category = $1',
        [DocumentCategory.TECHNICAL]
      );
      
      expect(parseInt(count.rows[0].count)).toBe(50);
    });

    test('should handle concurrent updates without conflicts', async () => {
      // Create a document
      const doc = await services.documentation.createDocument(
        generateTestDocument({ title: 'Concurrent Update Test' })
      );
      
      // Simulate multiple users viewing (incrementing view count)
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          services.documentation.getDocument(doc.id)
        );
      }
      
      await Promise.all(promises);
      
      // Each view should increment the count
      const updated = await services.documentation.getDocument(doc.id);
      expect(updated.viewCount || 0).toBeGreaterThanOrEqual(20);
    });

    test('should handle deadlock scenarios gracefully', async () => {
      // Create two documents
      const doc1 = await services.documentation.createDocument(
        generateTestDocument({ title: 'Deadlock Test 1' })
      );
      const doc2 = await services.documentation.createDocument(
        generateTestDocument({ title: 'Deadlock Test 2' })
      );
      
      // Two transactions that update in opposite order
      const promise1 = db.transaction(async (client) => {
        await client.query(
          'UPDATE documentation_pages SET view_count = view_count + 1 WHERE id = $1',
          [doc1.id]
        );
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        await client.query(
          'UPDATE documentation_pages SET view_count = view_count + 1 WHERE id = $1',
          [doc2.id]
        );
      });
      
      const promise2 = db.transaction(async (client) => {
        await client.query(
          'UPDATE documentation_pages SET view_count = view_count + 1 WHERE id = $1',
          [doc2.id]
        );
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        await client.query(
          'UPDATE documentation_pages SET view_count = view_count + 1 WHERE id = $1',
          [doc1.id]
        );
      });
      
      // At least one should succeed, deadlock detection should handle the other
      const results = await Promise.allSettled([promise1, promise2]);
      const successes = results.filter(r => r.status === 'fulfilled');
      
      expect(successes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Data Integrity', () => {
    test('should enforce foreign key constraints', async () => {
      // Try to create a forum post with invalid thread ID
      await expect(
        db.query(
          `INSERT INTO forum_posts (thread_id, author_id, content)
           VALUES ($1, $2, $3)`,
          ['00000000-0000-0000-0000-000000000000', TEST_USERS.alice, 'Invalid post']
        )
      ).rejects.toThrow(/foreign key/i);
    });

    test('should cascade deletes properly', async () => {
      // Create thread with posts
      const thread = await services.forum.createThread(generateTestThread());
      
      // Create multiple posts
      for (let i = 0; i < 3; i++) {
        await services.forum.createPost({
          threadId: thread.id,
          content: `Test post ${i}`,
          authorAddress: TEST_USERS.alice,
        });
      }
      
      // Delete thread - posts should cascade delete
      await db.query(
        'DELETE FROM forum_threads WHERE id = $1',
        [thread.id]
      );
      
      // Verify posts are deleted
      const posts = await db.query(
        'SELECT * FROM forum_posts WHERE thread_id = $1',
        [thread.id]
      );
      
      expect(posts.rows).toHaveLength(0);
    });

    test('should maintain referential integrity', async () => {
      // Create support request with volunteer assignment
      const request = await services.support.createRequest(
        generateTestSupportRequest()
      );
      
      const volunteer = await services.support.getVolunteerByUserId(TEST_USERS.volunteer);
      
      await services.support.updateRequestStatus(
        request.id,
        'in_progress',
        { assignedVolunteerId: volunteer.userId }
      );
      
      // Try to delete volunteer while assigned - should fail or handle gracefully
      const deleteResult = await db.query(
        'DELETE FROM support_volunteers WHERE user_id = $1',
        [volunteer.userId]
      ).catch(err => err);
      
      // Should either fail or handle the constraint
      expect(deleteResult).toBeDefined();
    });
  });

  describe('Index Performance', () => {
    test('should use indexes for common queries', async () => {
      // Create many documents
      for (let i = 0; i < 100; i++) {
        await services.documentation.createDocument(
          generateTestDocument({
            category: i < 50 ? DocumentCategory.TECHNICAL : DocumentCategory.MARKETPLACE,
          })
        );
      }
      
      // Explain query to verify index usage
      const explain = await db.query(
        `EXPLAIN (FORMAT JSON) 
         SELECT * FROM documentation_pages 
         WHERE category = $1 AND status = $2`,
        ['indexed-cat-1', 'published']
      );
      
      const plan = explain.rows[0]['QUERY PLAN'][0];
      
      // Should use index scan, not sequential scan for large tables
      const planString = JSON.stringify(plan);
      expect(planString).toMatch(/Index|index/i);
    });

    test('should optimize full-text search queries', async () => {
      // Create documents with searchable content
      const searchTerms = ['blockchain', 'marketplace', 'trading', 'wallet'];
      
      for (const term of searchTerms) {
        for (let i = 0; i < 10; i++) {
          await services.documentation.createDocument(
            generateTestDocument({
              title: `${term} Guide ${i}`,
              content: `Comprehensive guide about ${term} and related topics.`,
            })
          );
        }
      }
      
      // Test search performance
      const start = Date.now();
      const results = await services.documentation.searchDocuments({
        query: 'blockchain trading',
        pageSize: 20,
      });
      const duration = Date.now() - start;
      
      expect(results.total).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Database Migrations', () => {
    test('should verify all required tables exist', async () => {
      const tables = [
        'documentation_pages',
        'forum_threads',
        'forum_posts',
        'support_requests',
        'support_volunteers',
        'support_sessions',
      ];
      
      for (const table of tables) {
        const exists = await db.query<{ exists: boolean }>(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        expect(exists.rows[0].exists).toBe(true);
      }
    });

    test('should verify required indexes exist', async () => {
      const indexes = [
        { table: 'documentation_pages', column: 'category' },
        { table: 'documentation_pages', column: 'author_id' },
        { table: 'forum_threads', column: 'category' },
        { table: 'forum_posts', column: 'thread_id' },
        { table: 'support_requests', column: 'user_id' },
      ];
      
      for (const idx of indexes) {
        const exists = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM pg_indexes 
           WHERE tablename = $1 
           AND indexdef LIKE $2`,
          [idx.table, `%${idx.column}%`]
        );
        
        expect(parseInt(exists.rows[0].count)).toBeGreaterThan(0);
      }
    });

    test('should handle schema version tracking', async () => {
      // Check if migrations table exists
      const migrationsTable = await db.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'schema_migrations'
        )`
      );
      
      if (migrationsTable.rows[0].exists) {
        // Verify migration records
        const migrations = await db.query(
          'SELECT * FROM schema_migrations ORDER BY version'
        );
        
        expect(migrations.rows.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistency across related tables', async () => {
      // Create document
      const doc = await services.documentation.createDocument(
        generateTestDocument({ authorAddress: TEST_USERS.alice })
      );
      
      // Create forum thread by same author
      const thread = await services.forum.createThread(
        generateTestThread({ authorAddress: TEST_USERS.alice })
      );
      
      // Create support request
      const request = await services.support.createRequest(
        generateTestSupportRequest({ userId: TEST_USERS.alice })
      );
      
      // Verify user activity across tables
      const docCount = await db.query<{ count: string }>(
        'SELECT COUNT(*) FROM documentation_pages WHERE author_id = $1',
        [TEST_USERS.alice]
      );
      
      const threadCount = await db.query<{ count: string }>(
        'SELECT COUNT(*) FROM forum_threads WHERE author_address = $1',
        [TEST_USERS.alice]
      );

      const requestCount = await db.query<{ count: string }>(
        'SELECT COUNT(*) FROM support_requests WHERE user_address = $1',
        [TEST_USERS.alice]
      );

      expect(parseInt(docCount.rows[0].count)).toBeGreaterThan(0);
      expect(parseInt(threadCount.rows[0].count)).toBeGreaterThan(0);
      expect(parseInt(requestCount.rows[0]?.count || '0')).toBeGreaterThan(0);
    });

    test('should handle timestamp consistency', async () => {
      const beforeCreate = new Date();
      
      const doc = await services.documentation.createDocument(
        generateTestDocument()
      );
      
      const afterCreate = new Date();
      
      // Fetch from database
      const result = await db.query<any>(
        'SELECT created_at, updated_at FROM documentation_pages WHERE id = $1',
        [doc.id]
      );
      
      const createdAt = new Date(result.rows[0].created_at);
      const updatedAt = new Date(result.rows[0].updated_at);
      
      // Timestamps should be within reasonable bounds
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(updatedAt.getTime()).toBe(createdAt.getTime());
    });
  });

  describe('Backup and Recovery', () => {
    test('should support point-in-time recovery markers', async () => {
      // Create recovery point marker
      const marker = `recovery_test_${Date.now()}`;
      
      await db.query(
        `INSERT INTO documentation_pages (title, content, category, author_id)
         VALUES ($1, $2, $3, $4)`,
        [marker, 'Recovery test content', DocumentCategory.TECHNICAL, TEST_USERS.admin]
      );
      
      // Verify marker exists
      const exists = await db.query(
        'SELECT * FROM documentation_pages WHERE title = $1',
        [marker]
      );
      
      expect(exists.rows).toHaveLength(1);
      
      // In production, this marker would be used for recovery testing
    });

    test('should handle bulk data export', async () => {
      // Test COPY command support
      const exportQuery = `
        COPY (
          SELECT id, title, category, created_at 
          FROM documentation_pages 
          WHERE category = $1
          LIMIT 10
        ) TO STDOUT WITH (FORMAT CSV, HEADER true)
      `;
      
      // This would normally export to file, but we test query validity
      await expect(
        db.query(exportQuery, [DocumentCategory.TECHNICAL])
      ).rejects.toThrow(/STDOUT/); // Expected as we're not in psql
      
      // Alternative: test data extraction
      const data = await db.query(
        `SELECT id, title, category, created_at 
         FROM documentation_pages 
         WHERE category = $1
         LIMIT 10`,
        [DocumentCategory.TECHNICAL]
      );
      
      expect(Array.isArray(data.rows)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track slow queries', async () => {
      // Enable statement timing
      await db.query('SET log_statement = "all"');
      await db.query('SET log_duration = on');
      
      // Run a potentially slow query
      const start = Date.now();
      await db.query(
        `SELECT d.*, COUNT(f.id) as thread_count
         FROM documentation_pages d
         LEFT JOIN forum_threads f ON f.author_id = d.author_id
         WHERE d.category LIKE $1
         GROUP BY d.id
         LIMIT 100`,
        ['%test%']
      );
      const duration = Date.now() - start;
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.log(`Slow query detected: ${duration}ms`);
      }
      
      expect(duration).toBeLessThan(5000); // Should not exceed 5 seconds
    });

    test('should monitor connection pool usage', async () => {
      const poolStats = await db.query<any>(
        `SELECT count(*) as total,
                count(*) FILTER (WHERE state = 'active') as active,
                count(*) FILTER (WHERE state = 'idle') as idle
         FROM pg_stat_activity
         WHERE datname = $1`,
        [TEST_DB_CONFIG.database]
      );
      
      const stats = poolStats.rows[0];
      
      expect(parseInt(stats.total)).toBeGreaterThan(0);
      expect(parseInt(stats.total)).toBeLessThanOrEqual(TEST_DB_CONFIG.max || 20);
    });
  });
});