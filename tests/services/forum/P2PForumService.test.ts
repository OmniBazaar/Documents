/**
 * Tests for P2PForumService
 * 
 * @module services/forum/P2PForumService.test
 */

import { Database } from '../../../../Validator/src/database/Database';
import { ParticipationScoreService } from '../../../../Validator/src/services/ParticipationScoreService';
import { P2PForumService } from './P2PForumService';
import { ForumThread, ForumPost, ForumVote } from './ForumTypes';

describe('P2PForumService', () => {
  let db: Database;
  let participationService: ParticipationScoreService;
  let forumService: P2PForumService;
  
  const testUserId = 'test-user-123';
  const testUserId2 = 'test-user-456';
  const validatorEndpoint = 'http://localhost:8080';

  beforeEach(async () => {
    // Initialize services with real implementations
    db = new Database();
    participationService = new ParticipationScoreService(validatorEndpoint);
    forumService = new P2PForumService(db, participationService);
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM forum_threads WHERE author_id IN ($1, $2)', [testUserId, testUserId2]);
    await db.query('DELETE FROM forum_posts WHERE author_id IN ($1, $2)', [testUserId, testUserId2]);
    await db.query('DELETE FROM forum_votes WHERE user_id IN ($1, $2)', [testUserId, testUserId2]);
  });

  describe('Thread Management', () => {
    test('should create a new thread', async () => {
      const thread = await forumService.createThread({
        title: 'Test Thread',
        content: 'This is a test thread content',
        category: 'general',
        tags: ['test', 'automated'],
        authorId: testUserId
      });

      expect(thread).toBeDefined();
      expect(thread.title).toBe('Test Thread');
      expect(thread.content).toBe('This is a test thread content');
      expect(thread.category).toBe('general');
      expect(thread.tags).toEqual(['test', 'automated']);
      expect(thread.authorId).toBe(testUserId);
      expect(thread.score).toBe(0);
      expect(thread.replyCount).toBe(0);
      expect(thread.status).toBe('active');
    });

    test('should reject thread with inappropriate content', async () => {
      await expect(
        forumService.createThread({
          title: 'Buy cheap viagra here',
          content: 'Click this link for amazing deals',
          category: 'general',
          tags: ['spam'],
          authorId: testUserId
        })
      ).rejects.toThrow('Content flagged as spam');
    });

    test('should retrieve threads by category', async () => {
      // Create test threads
      await forumService.createThread({
        title: 'Technical Question',
        content: 'How do I integrate the API?',
        category: 'technical',
        tags: ['api', 'integration'],
        authorId: testUserId
      });

      await forumService.createThread({
        title: 'Another Technical Question',
        content: 'What is the rate limit?',
        category: 'technical',
        tags: ['api', 'limits'],
        authorId: testUserId2
      });

      const threads = await forumService.getThreads({
        category: 'technical',
        limit: 10,
        offset: 0
      });

      expect(threads).toHaveLength(2);
      expect(threads[0].category).toBe('technical');
      expect(threads[1].category).toBe('technical');
    });

    test('should pin and unpin threads', async () => {
      const thread = await forumService.createThread({
        title: 'Important Announcement',
        content: 'This is important',
        category: 'announcements',
        tags: ['important'],
        authorId: testUserId
      });

      // Pin the thread
      await forumService.pinThread(thread.id, testUserId);
      const pinnedThread = await forumService.getThread(thread.id);
      expect(pinnedThread?.isPinned).toBe(true);

      // Unpin the thread
      await forumService.unpinThread(thread.id, testUserId);
      const unpinnedThread = await forumService.getThread(thread.id);
      expect(unpinnedThread?.isPinned).toBe(false);
    });
  });

  describe('Post Management', () => {
    let threadId: string;

    beforeEach(async () => {
      const thread = await forumService.createThread({
        title: 'Test Thread for Posts',
        content: 'Thread for testing posts',
        category: 'general',
        tags: ['test'],
        authorId: testUserId
      });
      threadId = thread.id;
    });

    test('should create a post in a thread', async () => {
      const post = await forumService.createPost({
        threadId,
        content: 'This is a reply to the thread',
        authorId: testUserId2,
        parentId: undefined
      });

      expect(post).toBeDefined();
      expect(post.threadId).toBe(threadId);
      expect(post.content).toBe('This is a reply to the thread');
      expect(post.authorId).toBe(testUserId2);
      expect(post.score).toBe(0);
      expect(post.status).toBe('active');

      // Check reply count increased
      const thread = await forumService.getThread(threadId);
      expect(thread?.replyCount).toBe(1);
    });

    test('should create nested replies', async () => {
      const parentPost = await forumService.createPost({
        threadId,
        content: 'Parent post',
        authorId: testUserId2,
        parentId: undefined
      });

      const childPost = await forumService.createPost({
        threadId,
        content: 'Reply to parent post',
        authorId: testUserId,
        parentId: parentPost.id
      });

      expect(childPost.parentId).toBe(parentPost.id);
    });

    test('should retrieve posts for a thread', async () => {
      // Create multiple posts
      await forumService.createPost({
        threadId,
        content: 'First post',
        authorId: testUserId
      });

      await forumService.createPost({
        threadId,
        content: 'Second post',
        authorId: testUserId2
      });

      const posts = await forumService.getPosts(threadId, { limit: 10, offset: 0 });

      expect(posts).toHaveLength(2);
      expect(posts[0].content).toBe('First post');
      expect(posts[1].content).toBe('Second post');
    });

    test('should handle post edits', async () => {
      const post = await forumService.createPost({
        threadId,
        content: 'Original content',
        authorId: testUserId
      });

      await forumService.editPost(post.id, testUserId, 'Edited content');

      const editedPost = await forumService['getPost'](post.id);
      expect(editedPost?.content).toBe('Edited content');
      expect(editedPost?.isEdited).toBe(true);
      expect(editedPost?.editedAt).toBeDefined();
    });
  });

  describe('Voting System', () => {
    let threadId: string;
    let postId: string;

    beforeEach(async () => {
      const thread = await forumService.createThread({
        title: 'Voting Test Thread',
        content: 'Thread for testing voting',
        category: 'general',
        tags: ['test'],
        authorId: testUserId
      });
      threadId = thread.id;

      const post = await forumService.createPost({
        threadId,
        content: 'Post to vote on',
        authorId: testUserId2
      });
      postId = post.id;
    });

    test('should upvote a post', async () => {
      const result = await forumService.voteOnPost(postId, testUserId, 'up');

      expect(result).toBeDefined();
      expect(result.newScore).toBe(1);
      expect(result.userVote).toBe('up');

      // Check participation points awarded
      const score = await participationService.getUserScore(testUserId);
      expect(score.forum_activity).toBeGreaterThan(0);
    });

    test('should downvote a post', async () => {
      const result = await forumService.voteOnPost(postId, testUserId, 'down');

      expect(result).toBeDefined();
      expect(result.newScore).toBe(-1);
      expect(result.userVote).toBe('down');
    });

    test('should change vote', async () => {
      // First upvote
      await forumService.voteOnPost(postId, testUserId, 'up');
      
      // Change to downvote
      const result = await forumService.voteOnPost(postId, testUserId, 'down');
      
      expect(result.newScore).toBe(-1);
      expect(result.userVote).toBe('down');
    });

    test('should remove vote', async () => {
      // First upvote
      await forumService.voteOnPost(postId, testUserId, 'up');
      
      // Remove vote
      const result = await forumService.voteOnPost(postId, testUserId, 'up');
      
      expect(result.newScore).toBe(0);
      expect(result.userVote).toBe(null);
    });

    test('should prevent self-voting', async () => {
      await expect(
        forumService.voteOnPost(postId, testUserId2, 'up')
      ).rejects.toThrow('Cannot vote on your own post');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Create test data
      await forumService.createThread({
        title: 'How to stake XOM tokens',
        content: 'I want to learn about staking XOM tokens for rewards',
        category: 'staking',
        tags: ['xom', 'staking', 'rewards'],
        authorId: testUserId
      });

      await forumService.createThread({
        title: 'Validator setup guide',
        content: 'Complete guide for setting up a validator node',
        category: 'technical',
        tags: ['validator', 'setup', 'guide'],
        authorId: testUserId2
      });

      await forumService.createThread({
        title: 'XOM price discussion',
        content: 'What do you think about XOM price movements?',
        category: 'trading',
        tags: ['xom', 'price', 'trading'],
        authorId: testUserId
      });
    });

    test('should search threads by query', async () => {
      const results = await forumService.search({
        query: 'XOM',
        limit: 10,
        offset: 0
      });

      expect(results.threads).toHaveLength(2);
      expect(results.threads[0].title).toContain('XOM');
      expect(results.total).toBe(2);
    });

    test('should search with category filter', async () => {
      const results = await forumService.search({
        query: 'guide',
        category: 'technical',
        limit: 10,
        offset: 0
      });

      expect(results.threads).toHaveLength(1);
      expect(results.threads[0].category).toBe('technical');
    });

    test('should search by tags', async () => {
      const results = await forumService.search({
        tags: ['xom'],
        limit: 10,
        offset: 0
      });

      expect(results.threads).toHaveLength(2);
      results.threads.forEach(thread => {
        expect(thread.tags).toContain('xom');
      });
    });

    test('should search by author', async () => {
      const results = await forumService.search({
        authorId: testUserId,
        limit: 10,
        offset: 0
      });

      expect(results.threads).toHaveLength(2);
      results.threads.forEach(thread => {
        expect(thread.authorId).toBe(testUserId);
      });
    });
  });

  describe('Spam Detection', () => {
    test('should detect spam patterns', async () => {
      const spamPatterns = [
        'Buy cheap products here!!!',
        'CLICK HERE TO WIN $$$',
        'Visit my website: bit.ly/spam123',
        'Make money fast! Call 1-800-SPAM'
      ];

      for (const pattern of spamPatterns) {
        await expect(
          forumService.createThread({
            title: pattern,
            content: 'Spam content',
            category: 'general',
            tags: [],
            authorId: testUserId
          })
        ).rejects.toThrow('spam');
      }
    });

    test('should detect rapid posting', async () => {
      // Create first post
      await forumService.createThread({
        title: 'First Post',
        content: 'Normal content',
        category: 'general',
        tags: [],
        authorId: testUserId
      });

      // Try to create multiple posts rapidly
      const promises = Array(5).fill(null).map((_, i) => 
        forumService.createThread({
          title: `Rapid Post ${i}`,
          content: 'Content',
          category: 'general',
          tags: [],
          authorId: testUserId
        })
      );

      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThan(0);
    });

    test('should track user reputation for spam detection', async () => {
      // Simulate multiple spam attempts
      const spamAttempts = Array(3).fill(null).map(async (_, i) => {
        try {
          await forumService.createThread({
            title: `SPAM TITLE ${i}!!!`,
            content: 'Buy now!!!',
            category: 'general',
            tags: [],
            authorId: testUserId
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await Promise.all(spamAttempts);

      // Check if user reputation is affected
      const userScore = await participationService.getUserScore(testUserId);
      expect(userScore.trust_score).toBeLessThan(50); // Trust should be reduced
    });
  });

  describe('Moderation and Consensus', () => {
    let threadId: string;
    let postId: string;

    beforeEach(async () => {
      const thread = await forumService.createThread({
        title: 'Potentially Problematic Thread',
        content: 'This content might be problematic',
        category: 'general',
        tags: [],
        authorId: testUserId
      });
      threadId = thread.id;

      const post = await forumService.createPost({
        threadId,
        content: 'Potentially offensive content',
        authorId: testUserId2
      });
      postId = post.id;
    });

    test('should allow reporting content', async () => {
      const report = await forumService['reportContent'](postId, testUserId, 'offensive', 'This is offensive');
      
      expect(report).toBeDefined();
      expect(report.contentId).toBe(postId);
      expect(report.reporterId).toBe(testUserId);
      expect(report.reason).toBe('offensive');
    });

    test('should hide content after threshold reports', async () => {
      // Create multiple reports from different users
      const reporters = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      for (const reporter of reporters) {
        await forumService['reportContent'](postId, reporter, 'offensive', 'Offensive content');
      }

      // Check if post is hidden
      const post = await forumService['getPost'](postId);
      expect(post?.status).toBe('hidden');
    });

    test('should track moderator actions', async () => {
      // Simulate moderator action
      await forumService['moderateContent'](postId, testUserId, 'hide', 'Violates community guidelines');
      
      const post = await forumService['getPost'](postId);
      expect(post?.status).toBe('hidden');
      
      // Check moderation log
      const log = await db.query(
        'SELECT * FROM moderation_log WHERE content_id = $1',
        [postId]
      );
      expect(log.rows).toHaveLength(1);
      expect(log.rows[0].action).toBe('hide');
    });
  });

  describe('Performance and Pagination', () => {
    test('should handle large number of threads efficiently', async () => {
      // Create 100 threads
      const createPromises = Array(100).fill(null).map((_, i) => 
        forumService.createThread({
          title: `Performance Test Thread ${i}`,
          content: `Content for thread ${i}`,
          category: 'general',
          tags: [`tag${i % 10}`],
          authorId: i % 2 === 0 ? testUserId : testUserId2
        })
      );

      await Promise.all(createPromises);

      // Test pagination
      const startTime = Date.now();
      const page1 = await forumService.getThreads({ limit: 20, offset: 0 });
      const page2 = await forumService.getThreads({ limit: 20, offset: 20 });
      const endTime = Date.now();

      expect(page1).toHaveLength(20);
      expect(page2).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should efficiently search through large dataset', async () => {
      const startTime = Date.now();
      const results = await forumService.search({
        query: 'Performance Test',
        limit: 50,
        offset: 0
      });
      const endTime = Date.now();

      expect(results.threads.length).toBeLessThanOrEqual(50);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Integration with Participation Score', () => {
    test('should award points for quality contributions', async () => {
      const initialScore = await participationService.getUserScore(testUserId);
      const initialForumPoints = initialScore.forum_activity;

      // Create a thread
      const thread = await forumService.createThread({
        title: 'Quality Discussion Thread',
        content: 'This is a high-quality discussion about improving OmniBazaar',
        category: 'suggestions',
        tags: ['improvement', 'discussion'],
        authorId: testUserId
      });

      // Get upvotes from other users
      const voters = ['voter1', 'voter2', 'voter3'];
      for (const voter of voters) {
        const post = await forumService.createPost({
          threadId: thread.id,
          content: `Great idea from ${voter}!`,
          authorId: voter
        });
        
        // Vote on the original thread's first post
        await forumService.voteOnPost(thread.id, voter, 'up');
      }

      // Check updated score
      const updatedScore = await participationService.getUserScore(testUserId);
      expect(updatedScore.forum_activity).toBeGreaterThan(initialForumPoints);
    });

    test('should penalize spam behavior', async () => {
      const initialScore = await participationService.getUserScore(testUserId);
      const initialTrustScore = initialScore.trust_score;

      // Attempt multiple spam posts
      const spamAttempts = 5;
      for (let i = 0; i < spamAttempts; i++) {
        try {
          await forumService.createThread({
            title: 'BUY NOW!!! SPAM!!!',
            content: 'Click here for amazing deals!!!',
            category: 'general',
            tags: [],
            authorId: testUserId
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Check trust score decreased
      const updatedScore = await participationService.getUserScore(testUserId);
      expect(updatedScore.trust_score).toBeLessThan(initialTrustScore);
    });
  });
});