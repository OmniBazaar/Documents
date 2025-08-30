/**
 * Tests for DocumentationService
 * 
 * @module services/documentation/DocumentationService.test
 */

import { Database } from '../../../../Validator/src/database/Database';
import { ParticipationScoreService } from '../../../../Validator/src/services/ParticipationScoreService';
import { DocumentationService } from './DocumentationService';
import { DocumentationSearchService } from './DocumentationSearchService';
import { DocumentationValidationService } from './DocumentationValidationService';
import { DocumentationPage, DocumentationVersion, DocumentationCategory } from './DocumentationTypes';

describe('DocumentationService', () => {
  let db: Database;
  let searchService: DocumentationSearchService;
  let participationService: ParticipationScoreService;
  let validationService: DocumentationValidationService;
  let docService: DocumentationService;
  
  const testUserId = 'doc-user-123';
  const testUserId2 = 'doc-user-456';
  const validatorEndpoint = 'http://localhost:8080';

  beforeEach(async () => {
    // Initialize services
    db = new Database();
    searchService = new DocumentationSearchService(db);
    participationService = new ParticipationScoreService(validatorEndpoint);
    validationService = new DocumentationValidationService();
    docService = new DocumentationService(db, searchService, participationService, validationService);
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM documentation_pages WHERE author_id IN ($1, $2)', [testUserId, testUserId2]);
    await db.query('DELETE FROM documentation_versions WHERE author_id IN ($1, $2)', [testUserId, testUserId2]);
    await db.query('DELETE FROM documentation_ratings WHERE user_id IN ($1, $2)', [testUserId, testUserId2]);
  });

  describe('Document Creation and Management', () => {
    test('should create a new documentation page', async () => {
      const page = await docService.createDocumentationPage({
        title: 'Getting Started with OmniBazaar',
        content: '# Getting Started\n\nThis guide will help you get started with OmniBazaar.',
        category: 'getting-started',
        tags: ['beginner', 'tutorial'],
        authorId: testUserId,
        language: 'en'
      });

      expect(page).toBeDefined();
      expect(page.title).toBe('Getting Started with OmniBazaar');
      expect(page.slug).toBe('getting-started-with-omnibazaar');
      expect(page.category).toBe('getting-started');
      expect(page.authorId).toBe(testUserId);
      expect(page.language).toBe('en');
      expect(page.version).toBe(1);
      expect(page.status).toBe('draft');
      expect(page.views).toBe(0);
      expect(page.rating).toBe(0);
    });

    test('should generate unique slugs', async () => {
      const page1 = await docService.createDocumentationPage({
        title: 'API Reference',
        content: 'API documentation',
        category: 'api',
        tags: ['api'],
        authorId: testUserId,
        language: 'en'
      });

      const page2 = await docService.createDocumentationPage({
        title: 'API Reference', // Same title
        content: 'Another API documentation',
        category: 'api',
        tags: ['api'],
        authorId: testUserId2,
        language: 'en'
      });

      expect(page1.slug).toBe('api-reference');
      expect(page2.slug).toBe('api-reference-1');
    });

    test('should update documentation page', async () => {
      const page = await docService.createDocumentationPage({
        title: 'Original Title',
        content: 'Original content',
        category: 'guides',
        tags: ['guide'],
        authorId: testUserId,
        language: 'en'
      });

      const updated = await docService.updateDocumentationPage(page.id, {
        title: 'Updated Title',
        content: 'Updated content with more details',
        tags: ['guide', 'updated']
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content with more details');
      expect(updated.tags).toEqual(['guide', 'updated']);
      expect(updated.version).toBe(2); // Version should increment
    });

    test('should publish documentation', async () => {
      const page = await docService.createDocumentationPage({
        title: 'Draft Document',
        content: 'This is a draft',
        category: 'guides',
        tags: ['draft'],
        authorId: testUserId,
        language: 'en'
      });

      expect(page.status).toBe('draft');

      const published = await docService.publishDocumentation(page.id, testUserId);
      
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();
    });

    test('should archive documentation', async () => {
      const page = await docService.createDocumentationPage({
        title: 'To Be Archived',
        content: 'This will be archived',
        category: 'guides',
        tags: ['archive'],
        authorId: testUserId,
        language: 'en'
      });

      const archived = await docService.archiveDocumentation(page.id, testUserId);
      
      expect(archived.status).toBe('archived');
    });
  });

  describe('Version Control', () => {
    let pageId: string;

    beforeEach(async () => {
      const page = await docService.createDocumentationPage({
        title: 'Versioned Document',
        content: 'Version 1 content',
        category: 'guides',
        tags: ['version'],
        authorId: testUserId,
        language: 'en'
      });
      pageId = page.id;
    });

    test('should track version history', async () => {
      // Make multiple updates
      await docService.updateDocumentationPage(pageId, {
        content: 'Version 2 content'
      });

      await docService.updateDocumentationPage(pageId, {
        content: 'Version 3 content',
        title: 'Updated Title'
      });

      const history = await docService.getVersionHistory(pageId);
      
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(3);
    });

    test('should restore previous version', async () => {
      await docService.updateDocumentationPage(pageId, {
        content: 'Version 2 content'
      });

      await docService.updateDocumentationPage(pageId, {
        content: 'Version 3 content'
      });

      // Restore to version 1
      const restored = await docService.restoreVersion(pageId, 1, testUserId);
      
      expect(restored.content).toBe('Version 1 content');
      expect(restored.version).toBe(4); // New version created
    });

    test('should compare versions', async () => {
      await docService.updateDocumentationPage(pageId, {
        content: 'Version 2 content with changes'
      });

      const diff = await docService.compareVersions(pageId, 1, 2);
      
      expect(diff.added).toContain('with changes');
      expect(diff.removed).toBeDefined();
      expect(diff.version1).toBe(1);
      expect(diff.version2).toBe(2);
    });
  });

  describe('Multi-language Support', () => {
    test('should create translations', async () => {
      const originalPage = await docService.createDocumentationPage({
        title: 'English Guide',
        content: 'This is an English guide',
        category: 'guides',
        tags: ['english'],
        authorId: testUserId,
        language: 'en'
      });

      const spanishTranslation = await docService.createTranslation(originalPage.id, {
        title: 'Guía en Español',
        content: 'Esta es una guía en español',
        language: 'es',
        authorId: testUserId2
      });

      expect(spanishTranslation.language).toBe('es');
      expect(spanishTranslation.parentId).toBe(originalPage.id);
      expect(spanishTranslation.title).toBe('Guía en Español');
    });

    test('should get available languages', async () => {
      const page = await docService.createDocumentationPage({
        title: 'Multi-language Doc',
        content: 'Original content',
        category: 'guides',
        tags: ['multilang'],
        authorId: testUserId,
        language: 'en'
      });

      await docService.createTranslation(page.id, {
        title: 'Document Multi-langue',
        content: 'Contenu français',
        language: 'fr',
        authorId: testUserId
      });

      await docService.createTranslation(page.id, {
        title: 'Mehrsprachiges Dokument',
        content: 'Deutscher Inhalt',
        language: 'de',
        authorId: testUserId2
      });

      const languages = await docService.getAvailableLanguages(page.id);
      
      expect(languages).toEqual(['en', 'fr', 'de']);
    });

    test('should get documentation in preferred language', async () => {
      const englishPage = await docService.createDocumentationPage({
        title: 'English Title',
        content: 'English content',
        category: 'guides',
        tags: ['test'],
        authorId: testUserId,
        language: 'en'
      });

      await docService.createTranslation(englishPage.id, {
        title: 'Título Español',
        content: 'Contenido español',
        language: 'es',
        authorId: testUserId2
      });

      const spanishDoc = await docService.getDocumentationBySlug(
        'english-title',
        { language: 'es' }
      );

      expect(spanishDoc?.title).toBe('Título Español');
      expect(spanishDoc?.language).toBe('es');
    });
  });

  describe('Search and Discovery', () => {
    beforeEach(async () => {
      // Create test documents
      await docService.createDocumentationPage({
        title: 'XOM Staking Guide',
        content: 'Learn how to stake XOM tokens for rewards',
        category: 'staking',
        tags: ['xom', 'staking', 'rewards'],
        authorId: testUserId,
        language: 'en'
      });

      await docService.createDocumentationPage({
        title: 'API Authentication',
        content: 'How to authenticate with the OmniBazaar API using XOM',
        category: 'api',
        tags: ['api', 'authentication', 'xom'],
        authorId: testUserId2,
        language: 'en'
      });

      await docService.createDocumentationPage({
        title: 'Marketplace Tutorial',
        content: 'Getting started with the OmniBazaar marketplace',
        category: 'tutorials',
        tags: ['marketplace', 'tutorial', 'beginner'],
        authorId: testUserId,
        language: 'en'
      });

      // Publish documents for search
      const docs = await db.query('SELECT id FROM documentation_pages WHERE author_id IN ($1, $2)', [testUserId, testUserId2]);
      for (const doc of docs.rows) {
        await docService.publishDocumentation(doc.id, testUserId);
      }
    });

    test('should search documentation by query', async () => {
      const results = await docService.searchDocumentation({
        query: 'XOM',
        limit: 10,
        offset: 0
      });

      expect(results.total).toBe(2);
      expect(results.results).toHaveLength(2);
      expect(results.results[0].title).toContain('XOM');
    });

    test('should filter by category', async () => {
      const results = await docService.searchDocumentation({
        category: 'api',
        limit: 10,
        offset: 0
      });

      expect(results.total).toBe(1);
      expect(results.results[0].category).toBe('api');
    });

    test('should filter by tags', async () => {
      const results = await docService.searchDocumentation({
        tags: ['xom'],
        limit: 10,
        offset: 0
      });

      expect(results.total).toBe(2);
      results.results.forEach(doc => {
        expect(doc.tags).toContain('xom');
      });
    });

    test('should filter by language', async () => {
      // Create a Spanish document
      await docService.createDocumentationPage({
        title: 'Guía de XOM',
        content: 'Cómo usar XOM',
        category: 'guides',
        tags: ['xom', 'español'],
        authorId: testUserId,
        language: 'es'
      });

      const spanishResults = await docService.searchDocumentation({
        language: 'es',
        limit: 10,
        offset: 0
      });

      expect(spanishResults.total).toBe(1);
      expect(spanishResults.results[0].language).toBe('es');
    });

    test('should get popular documentation', async () => {
      // Simulate views
      const docs = await db.query('SELECT id FROM documentation_pages WHERE status = $1', ['published']);
      
      // Add views to first document
      await db.query(
        'UPDATE documentation_pages SET views = views + 100 WHERE id = $1',
        [docs.rows[0].id]
      );

      const popular = await docService.getPopularDocumentation({ limit: 5 });
      
      expect(popular.length).toBeGreaterThan(0);
      expect(popular[0].views).toBeGreaterThan(0);
    });

    test('should get recent documentation', async () => {
      const recent = await docService.getRecentDocumentation({ limit: 5 });
      
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].publishedAt).toBeDefined();
      
      // Check order
      if (recent.length > 1) {
        const firstDate = new Date(recent[0].publishedAt!).getTime();
        const secondDate = new Date(recent[1].publishedAt!).getTime();
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });
  });

  describe('Rating and Feedback', () => {
    let pageId: string;

    beforeEach(async () => {
      const page = await docService.createDocumentationPage({
        title: 'Rateable Document',
        content: 'This document can be rated',
        category: 'guides',
        tags: ['rating'],
        authorId: testUserId,
        language: 'en'
      });
      pageId = page.id;
      
      // Publish it
      await docService.publishDocumentation(pageId, testUserId);
    });

    test('should rate documentation', async () => {
      const rating = await docService.rateDocumentation(pageId, testUserId2, 5, 'Very helpful!');
      
      expect(rating.rating).toBe(5);
      expect(rating.comment).toBe('Very helpful!');

      // Check document rating updated
      const doc = await docService.getDocumentationById(pageId);
      expect(doc?.rating).toBe(5);
      expect(doc?.ratingCount).toBe(1);
    });

    test('should calculate average rating', async () => {
      await docService.rateDocumentation(pageId, 'user1', 5);
      await docService.rateDocumentation(pageId, 'user2', 4);
      await docService.rateDocumentation(pageId, 'user3', 5);

      const doc = await docService.getDocumentationById(pageId);
      expect(doc?.rating).toBeCloseTo(4.67, 1);
      expect(doc?.ratingCount).toBe(3);
    });

    test('should prevent duplicate ratings', async () => {
      await docService.rateDocumentation(pageId, testUserId2, 5);

      await expect(
        docService.rateDocumentation(pageId, testUserId2, 4)
      ).rejects.toThrow('already rated');
    });

    test('should prevent self-rating', async () => {
      await expect(
        docService.rateDocumentation(pageId, testUserId, 5)
      ).rejects.toThrow('cannot rate your own');
    });

    test('should mark documentation as helpful', async () => {
      const result = await docService.markAsHelpful(pageId, testUserId2);
      
      expect(result.isHelpful).toBe(true);
      expect(result.helpfulCount).toBe(1);

      // Toggle off
      const result2 = await docService.markAsHelpful(pageId, testUserId2);
      expect(result2.isHelpful).toBe(false);
      expect(result2.helpfulCount).toBe(0);
    });
  });

  describe('Collaboration Features', () => {
    let pageId: string;

    beforeEach(async () => {
      const page = await docService.createDocumentationPage({
        title: 'Collaborative Document',
        content: 'This document supports collaboration',
        category: 'guides',
        tags: ['collaboration'],
        authorId: testUserId,
        language: 'en'
      });
      pageId = page.id;
    });

    test('should suggest edits', async () => {
      const suggestion = await docService.suggestEdit(pageId, {
        userId: testUserId2,
        content: 'This document supports enhanced collaboration features',
        comment: 'Added "enhanced" and "features" for clarity'
      });

      expect(suggestion).toBeDefined();
      expect(suggestion.userId).toBe(testUserId2);
      expect(suggestion.status).toBe('pending');
      expect(suggestion.content).toContain('enhanced');
    });

    test('should approve edit suggestions', async () => {
      const suggestion = await docService.suggestEdit(pageId, {
        userId: testUserId2,
        content: 'Updated content',
        comment: 'Improvement'
      });

      const result = await docService.reviewEditSuggestion(
        suggestion.id,
        testUserId, // Original author
        'approve',
        'Good suggestion!'
      );

      expect(result.status).toBe('approved');
      expect(result.reviewComment).toBe('Good suggestion!');

      // Check document updated
      const doc = await docService.getDocumentationById(pageId);
      expect(doc?.content).toBe('Updated content');
    });

    test('should reject edit suggestions', async () => {
      const suggestion = await docService.suggestEdit(pageId, {
        userId: testUserId2,
        content: 'Bad content',
        comment: 'Not helpful'
      });

      const result = await docService.reviewEditSuggestion(
        suggestion.id,
        testUserId,
        'reject',
        'Does not improve clarity'
      );

      expect(result.status).toBe('rejected');
      
      // Check document not updated
      const doc = await docService.getDocumentationById(pageId);
      expect(doc?.content).not.toBe('Bad content');
    });

    test('should track contributors', async () => {
      // Multiple users contribute
      await docService.suggestEdit(pageId, {
        userId: 'contributor1',
        content: 'Improved content 1',
        comment: 'Fix 1'
      });

      const suggestion1 = await db.query(
        'SELECT id FROM edit_suggestions WHERE page_id = $1 AND user_id = $2',
        [pageId, 'contributor1']
      );

      await docService.reviewEditSuggestion(suggestion1.rows[0].id, testUserId, 'approve');

      await docService.suggestEdit(pageId, {
        userId: 'contributor2',
        content: 'Improved content 2',
        comment: 'Fix 2'
      });

      const suggestion2 = await db.query(
        'SELECT id FROM edit_suggestions WHERE page_id = $1 AND user_id = $2',
        [pageId, 'contributor2']
      );

      await docService.reviewEditSuggestion(suggestion2.rows[0].id, testUserId, 'approve');

      const contributors = await docService.getContributors(pageId);
      
      expect(contributors).toHaveLength(3); // Original author + 2 contributors
      expect(contributors.some(c => c.userId === testUserId)).toBe(true);
      expect(contributors.some(c => c.userId === 'contributor1')).toBe(true);
      expect(contributors.some(c => c.userId === 'contributor2')).toBe(true);
    });
  });

  describe('Analytics and Metrics', () => {
    let pageId: string;

    beforeEach(async () => {
      const page = await docService.createDocumentationPage({
        title: 'Analytics Test Document',
        content: 'Document for testing analytics',
        category: 'guides',
        tags: ['analytics'],
        authorId: testUserId,
        language: 'en'
      });
      pageId = page.id;
      
      await docService.publishDocumentation(pageId, testUserId);
    });

    test('should track page views', async () => {
      await docService.trackPageView(pageId, 'viewer1');
      await docService.trackPageView(pageId, 'viewer2');
      await docService.trackPageView(pageId, 'viewer1'); // Same user again

      const doc = await docService.getDocumentationById(pageId);
      expect(doc?.views).toBe(3);

      // Check unique views
      const analytics = await docService.getDocumentationAnalytics(pageId);
      expect(analytics.uniqueViews).toBe(2);
    });

    test('should track reading time', async () => {
      await docService.trackReadingTime(pageId, 'reader1', 120); // 2 minutes
      await docService.trackReadingTime(pageId, 'reader2', 180); // 3 minutes

      const analytics = await docService.getDocumentationAnalytics(pageId);
      expect(analytics.averageReadingTime).toBe(150); // 2.5 minutes average
    });

    test('should get author statistics', async () => {
      // Create more documents
      await docService.createDocumentationPage({
        title: 'Second Document',
        content: 'Another doc',
        category: 'api',
        tags: ['test'],
        authorId: testUserId,
        language: 'en'
      });

      // Add ratings
      await docService.rateDocumentation(pageId, 'rater1', 5);
      await docService.rateDocumentation(pageId, 'rater2', 4);

      const stats = await docService.getAuthorStatistics(testUserId);
      
      expect(stats.totalDocuments).toBe(2);
      expect(stats.publishedDocuments).toBe(1);
      expect(stats.totalViews).toBe(0);
      expect(stats.averageRating).toBe(4.5);
    });
  });

  describe('Integration with Participation Score', () => {
    test('should award points for creating documentation', async () => {
      const initialScore = await participationService.getUserScore(testUserId);

      await docService.createDocumentationPage({
        title: 'New Guide',
        content: 'Helpful content for the community',
        category: 'guides',
        tags: ['helpful'],
        authorId: testUserId,
        language: 'en'
      });

      const updatedScore = await participationService.getUserScore(testUserId);
      expect(updatedScore.documentation_contributions).toBeGreaterThan(
        initialScore.documentation_contributions
      );
    });

    test('should award points for quality documentation', async () => {
      const page = await docService.createDocumentationPage({
        title: 'High Quality Guide',
        content: 'Very detailed and helpful content',
        category: 'guides',
        tags: ['quality'],
        authorId: testUserId,
        language: 'en'
      });

      await docService.publishDocumentation(page.id, testUserId);

      // Get high ratings
      await docService.rateDocumentation(page.id, 'user1', 5);
      await docService.rateDocumentation(page.id, 'user2', 5);
      await docService.rateDocumentation(page.id, 'user3', 5);

      const score = await participationService.getUserScore(testUserId);
      expect(score.documentation_contributions).toBeGreaterThan(0);
      expect(score.trust_score).toBeGreaterThan(50);
    });

    test('should award points for helpful edits', async () => {
      const page = await docService.createDocumentationPage({
        title: 'Document to Edit',
        content: 'Original content',
        category: 'guides',
        tags: ['edit'],
        authorId: testUserId,
        language: 'en'
      });

      const initialScore = await participationService.getUserScore(testUserId2);

      const suggestion = await docService.suggestEdit(page.id, {
        userId: testUserId2,
        content: 'Significantly improved content with better explanations',
        comment: 'Added clarity and examples'
      });

      await docService.reviewEditSuggestion(suggestion.id, testUserId, 'approve');

      const updatedScore = await participationService.getUserScore(testUserId2);
      expect(updatedScore.documentation_contributions).toBeGreaterThan(
        initialScore.documentation_contributions
      );
    });
  });

  describe('Content Validation', () => {
    test('should validate markdown content', async () => {
      const validContent = '# Title\n\nParagraph with **bold** and *italic*\n\n- List item';
      const validation = validationService.validateContent(validContent, 'markdown');
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid markdown', async () => {
      const invalidContent = '# Title\n\n[Invalid link](javascript:alert(1))';
      const validation = validationService.validateContent(invalidContent, 'markdown');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid link protocol');
    });

    test('should enforce content length limits', async () => {
      const tooLongContent = 'x'.repeat(100001); // Over 100k characters
      
      await expect(
        docService.createDocumentationPage({
          title: 'Too Long',
          content: tooLongContent,
          category: 'guides',
          tags: [],
          authorId: testUserId,
          language: 'en'
        })
      ).rejects.toThrow('Content too long');
    });

    test('should sanitize HTML in content', async () => {
      const unsafeContent = '<script>alert("XSS")</script><p>Safe content</p>';
      const page = await docService.createDocumentationPage({
        title: 'HTML Test',
        content: unsafeContent,
        category: 'guides',
        tags: [],
        authorId: testUserId,
        language: 'en',
        format: 'html'
      });

      expect(page.content).not.toContain('<script>');
      expect(page.content).toContain('<p>Safe content</p>');
    });
  });
});