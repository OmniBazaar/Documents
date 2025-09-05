/**
 * P2PForumService Unit Tests
 * 
 * Tests the peer-to-peer forum functionality including:
 * - Thread and post management
 * - Voting system
 * - Moderation features
 * - Spam detection
 * - Real-time updates
 * - Participation rewards
 */

import { P2PForumService } from '@/services/forum/P2PForumService';
import { ForumConsensus } from '@/services/forum/ForumConsensus';
import { ForumIncentives } from '@/services/forum/ForumIncentives';
import { ForumModerationService } from '@/services/forum/ForumModerationService';
import { Database } from '@/services/database/Database';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  generateTestThread,
  testHelpers,
  cleanTestData,
} from '@tests/setup/testSetup';

describe('P2PForumService', () => {
  let services: any;
  let forumService: P2PForumService;
  let db: Database;

  beforeAll(async () => {
    services = await setupTestServices();
    forumService = services.forum;
    db = services.db;
  });

  afterAll(async () => {
    await cleanTestData(db);
    await teardownTestServices();
  });

  beforeEach(async () => {
    // Clean up any test threads between tests
    await db.query(`
      DELETE FROM forum_threads 
      WHERE category LIKE 'test-%' 
      OR title LIKE 'Test Thread%'
    `);
  });

  describe('Thread Management', () => {
    test('should create a new thread', async () => {
      const threadData = generateTestThread();
      const thread = await forumService.createThread(threadData);

      testHelpers.assertThread(thread);
      expect(thread.title).toBe(threadData.title);
      expect(thread.content).toBe(threadData.content);
      expect(thread.authorId).toBe(threadData.authorId);
      expect(thread.replyCount).toBe(0);
      expect(thread.viewCount).toBe(0);
    });

    test('should retrieve thread by ID', async () => {
      const created = await forumService.createThread(generateTestThread());
      const retrieved = await forumService.getThread(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.viewCount).toBe(1); // View count should increment
    });

    test('should update thread', async () => {
      const thread = await forumService.createThread(generateTestThread());
      const updates = {
        title: 'Updated Thread Title',
        content: 'Updated thread content with more information',
      };

      const updated = await forumService.updateThread(
        thread.id, 
        updates, 
        thread.authorId
      );

      expect(updated.title).toBe(updates.title);
      expect(updated.content).toBe(updates.content);
      expect(updated.updatedAt).not.toBe(thread.updatedAt);
    });

    test('should delete thread', async () => {
      const thread = await forumService.createThread(generateTestThread());
      const result = await forumService.deleteThread(thread.id, thread.authorId);

      expect(result).toBe(true);

      // Verify deletion
      await expect(forumService.getThread(thread.id)).rejects.toThrow();
    });

    test('should list threads with pagination', async () => {
      // Create multiple threads
      const testCategory = 'test-pagination-' + Date.now();
      for (let i = 0; i < 15; i++) {
        await forumService.createThread(generateTestThread({
          title: `Thread ${i}`,
          category: testCategory,
        }));
      }

      const page1 = await forumService.listThreads({
        category: testCategory,
        page: 1,
        pageSize: 10,
      });

      expect(page1.items).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.totalPages).toBe(2);
    });

    test('should pin/unpin threads', async () => {
      const thread = await forumService.createThread(generateTestThread());
      
      // Pin thread (requires moderator permissions)
      const pinned = await forumService.pinThread(thread.id, TEST_USERS.moderator);
      expect(pinned.isPinned).toBe(true);

      // Unpin thread
      const unpinned = await forumService.unpinThread(thread.id, TEST_USERS.moderator);
      expect(unpinned.isPinned).toBe(false);
    });

    test('should lock/unlock threads', async () => {
      const thread = await forumService.createThread(generateTestThread());
      
      // Lock thread
      const locked = await forumService.lockThread(thread.id, TEST_USERS.moderator);
      expect(locked.isLocked).toBe(true);

      // Attempt to post in locked thread should fail
      await expect(
        forumService.createPost({
          threadId: thread.id,
          content: 'This should fail',
          authorId: TEST_USERS.alice,
        })
      ).rejects.toThrow('locked');

      // Unlock thread
      const unlocked = await forumService.unlockThread(thread.id, TEST_USERS.moderator);
      expect(unlocked.isLocked).toBe(false);
    });
  });

  describe('Post Management', () => {
    let thread: any;

    beforeEach(async () => {
      thread = await forumService.createThread(generateTestThread());
    });

    test('should create a post in thread', async () => {
      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'This is a test post',
        authorId: TEST_USERS.alice,
      });

      expect(post.threadId).toBe(thread.id);
      expect(post.content).toBe('This is a test post');
      expect(post.authorId).toBe(TEST_USERS.alice);
      expect(post.upvotes).toBe(0);
      expect(post.downvotes).toBe(0);
    });

    test('should create nested replies', async () => {
      const parentPost = await forumService.createPost({
        threadId: thread.id,
        content: 'Parent post',
        authorId: TEST_USERS.alice,
      });

      const reply = await forumService.createPost({
        threadId: thread.id,
        content: 'This is a reply',
        authorId: TEST_USERS.bob,
        parentId: parentPost.id,
      });

      expect(reply.parentId).toBe(parentPost.id);
    });

    test('should update post', async () => {
      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'Original content',
        authorId: TEST_USERS.alice,
      });

      const updated = await forumService.updatePost(
        post.id,
        { content: 'Updated content' },
        post.authorId
      );

      expect(updated.content).toBe('Updated content');
      expect(updated.editedAt).toBeDefined();
    });

    test('should delete post', async () => {
      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'To be deleted',
        authorId: TEST_USERS.alice,
      });

      const result = await forumService.deletePost(post.id, post.authorId);
      expect(result).toBe(true);

      // Post should be soft deleted (marked as deleted, not removed)
      const deleted = await forumService.getPost(post.id);
      expect(deleted.status).toBe('deleted');
    });

    test('should get posts for thread', async () => {
      // Create multiple posts
      for (let i = 0; i < 5; i++) {
        await forumService.createPost({
          threadId: thread.id,
          content: `Post ${i}`,
          authorId: TEST_USERS.alice,
        });
      }

      const posts = await forumService.getThreadPosts(thread.id, {
        page: 1,
        pageSize: 10,
      });

      expect(posts.items).toHaveLength(5);
      expect(posts.items[0].threadId).toBe(thread.id);
    });

    test('should mark post as solution', async () => {
      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'This is the solution',
        authorId: TEST_USERS.bob,
      });

      // Thread author can mark as solution
      const marked = await forumService.markAsSolution(
        post.id,
        thread.authorId
      );

      expect(marked.isSolution).toBe(true);

      // Should award bonus points to solution author
      const score = await services.participation.getUserScore(TEST_USERS.bob);
      expect(score.components.forum).toBeGreaterThan(0);
    });
  });

  describe('Voting System', () => {
    let thread: any;
    let post: any;

    beforeEach(async () => {
      thread = await forumService.createThread(generateTestThread());
      post = await forumService.createPost({
        threadId: thread.id,
        content: 'Vote on this post',
        authorId: TEST_USERS.alice,
      });
    });

    test('should upvote post', async () => {
      const result = await forumService.votePost(post.id, TEST_USERS.bob, 'up');
      
      expect(result.success).toBe(true);
      expect(result.upvotes).toBe(1);
      expect(result.downvotes).toBe(0);
    });

    test('should downvote post', async () => {
      const result = await forumService.votePost(post.id, TEST_USERS.bob, 'down');
      
      expect(result.success).toBe(true);
      expect(result.upvotes).toBe(0);
      expect(result.downvotes).toBe(1);
    });

    test('should prevent duplicate votes', async () => {
      await forumService.votePost(post.id, TEST_USERS.bob, 'up');
      
      // Second vote should fail
      await expect(
        forumService.votePost(post.id, TEST_USERS.bob, 'up')
      ).rejects.toThrow('already voted');
    });

    test('should allow vote changes', async () => {
      // First upvote
      await forumService.votePost(post.id, TEST_USERS.bob, 'up');
      
      // Change to downvote
      const changed = await forumService.changeVote(post.id, TEST_USERS.bob, 'down');
      
      expect(changed.upvotes).toBe(0);
      expect(changed.downvotes).toBe(1);
    });

    test('should remove vote', async () => {
      await forumService.votePost(post.id, TEST_USERS.bob, 'up');
      
      const removed = await forumService.removeVote(post.id, TEST_USERS.bob);
      
      expect(removed.upvotes).toBe(0);
      expect(removed.downvotes).toBe(0);
    });

    test('should calculate post score', async () => {
      // Multiple users vote
      await forumService.votePost(post.id, TEST_USERS.alice, 'up');
      await forumService.votePost(post.id, TEST_USERS.bob, 'up');
      await forumService.votePost(post.id, TEST_USERS.charlie, 'down');
      
      const postWithScore = await forumService.getPost(post.id);
      
      expect(postWithScore.score).toBe(1); // 2 up - 1 down = 1
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      // Create test data
      await forumService.createThread(generateTestThread({
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript basics',
        tags: ['javascript', 'tutorial'],
        category: 'programming',
      }));

      await forumService.createThread(generateTestThread({
        title: 'Python Guide',
        content: 'Python programming guide',
        tags: ['python', 'tutorial'],
        category: 'programming',
      }));

      await forumService.createThread(generateTestThread({
        title: 'Marketplace FAQ',
        content: 'Frequently asked questions',
        tags: ['faq', 'help'],
        category: 'support',
      }));
    });

    test('should search threads by keyword', async () => {
      const results = await forumService.searchThreads({
        query: 'JavaScript',
        page: 1,
        pageSize: 10,
      });

      expect(results.total).toBeGreaterThan(0);
      expect(results.items.some(t => t.title.includes('JavaScript'))).toBe(true);
    });

    test('should filter by category', async () => {
      const results = await forumService.listThreads({
        category: 'programming',
        page: 1,
        pageSize: 10,
      });

      expect(results.items.every(t => t.category === 'programming')).toBe(true);
    });

    test('should filter by tags', async () => {
      const results = await forumService.searchThreads({
        tags: ['tutorial'],
        page: 1,
        pageSize: 10,
      });

      expect(results.items.every(t => t.tags.includes('tutorial'))).toBe(true);
    });

    test('should sort by different criteria', async () => {
      // Sort by recent
      const recent = await forumService.listThreads({
        sortBy: 'recent',
        page: 1,
        pageSize: 10,
      });

      // Sort by popular (view count)
      const popular = await forumService.listThreads({
        sortBy: 'popular',
        page: 1,
        pageSize: 10,
      });

      // Sort by active (last reply)
      const active = await forumService.listThreads({
        sortBy: 'active',
        page: 1,
        pageSize: 10,
      });

      expect(recent.items).toBeDefined();
      expect(popular.items).toBeDefined();
      expect(active.items).toBeDefined();
    });
  });

  describe('Moderation Features', () => {
    let thread: any;
    let post: any;

    beforeEach(async () => {
      thread = await forumService.createThread(generateTestThread());
      post = await forumService.createPost({
        threadId: thread.id,
        content: 'This post may need moderation',
        authorId: TEST_USERS.alice,
      });
    });

    test('should report content', async () => {
      const report = await forumService.reportContent({
        contentType: 'post',
        contentId: post.id,
        reporterId: TEST_USERS.bob,
        reason: 'spam',
        details: 'This looks like spam',
      });

      expect(report.contentId).toBe(post.id);
      expect(report.reason).toBe('spam');
      expect(report.status).toBe('pending');
    });

    test('should moderate reported content', async () => {
      const report = await forumService.reportContent({
        contentType: 'post',
        contentId: post.id,
        reporterId: TEST_USERS.bob,
        reason: 'inappropriate',
      });

      // Moderator reviews and takes action
      const moderated = await forumService.moderateContent({
        reportId: report.id,
        moderatorId: TEST_USERS.moderator,
        action: 'remove',
        notes: 'Content violates guidelines',
      });

      expect(moderated.status).toBe('resolved');
      expect(moderated.action).toBe('remove');

      // Post should be hidden
      const hiddenPost = await forumService.getPost(post.id);
      expect(hiddenPost.status).toBe('removed');
    });

    test('should track moderation history', async () => {
      await forumService.reportContent({
        contentType: 'post',
        contentId: post.id,
        reporterId: TEST_USERS.bob,
        reason: 'spam',
      });

      const history = await forumService.getModerationHistory(post.id);
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].contentId).toBe(post.id);
    });

    test('should ban repeat offenders', async () => {
      // Create multiple posts by same user
      const posts = [];
      for (let i = 0; i < 5; i++) {
        const p = await forumService.createPost({
          threadId: thread.id,
          content: `Spam post ${i}`,
          authorId: TEST_USERS.charlie,
        });
        posts.push(p);
      }

      // Report all posts
      for (const p of posts) {
        const report = await forumService.reportContent({
          contentType: 'post',
          contentId: p.id,
          reporterId: TEST_USERS.alice,
          reason: 'spam',
        });

        await forumService.moderateContent({
          reportId: report.id,
          moderatorId: TEST_USERS.moderator,
          action: 'remove',
        });
      }

      // User should be auto-banned after multiple violations
      const userStatus = await forumService.getUserStatus(TEST_USERS.charlie);
      expect(userStatus.isBanned).toBe(true);
    });
  });

  describe('Spam Detection', () => {
    test('should detect spam patterns', async () => {
      const thread = await forumService.createThread(generateTestThread());

      // Attempt to create spam post
      const spamContent = 'BUY NOW!!! Click here >>> www.spam.com AMAZING DEAL!!!';
      
      await expect(
        forumService.createPost({
          threadId: thread.id,
          content: spamContent,
          authorId: TEST_USERS.charlie,
        })
      ).rejects.toThrow('spam');
    });

    test('should rate limit posts', async () => {
      const thread = await forumService.createThread(generateTestThread());

      // Create multiple posts rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          forumService.createPost({
            threadId: thread.id,
            content: `Rapid post ${i}`,
            authorId: TEST_USERS.charlie,
          })
        );
      }

      // Some should fail due to rate limiting
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(failures.length).toBeGreaterThan(0);
    });

    test('should detect duplicate content', async () => {
      const thread = await forumService.createThread(generateTestThread());
      const duplicateContent = 'This is duplicate content for testing';

      // First post should succeed
      await forumService.createPost({
        threadId: thread.id,
        content: duplicateContent,
        authorId: TEST_USERS.alice,
      });

      // Duplicate should fail
      await expect(
        forumService.createPost({
          threadId: thread.id,
          content: duplicateContent,
          authorId: TEST_USERS.alice,
        })
      ).rejects.toThrow('duplicate');
    });
  });

  describe('Real-time Updates', () => {
    test('should emit events for new threads', async () => {
      const events: any[] = [];
      
      // Subscribe to thread events
      forumService.on('thread:created', (event) => {
        events.push(event);
      });

      const thread = await forumService.createThread(generateTestThread());

      // Give event time to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toHaveLength(1);
      expect(events[0].threadId).toBe(thread.id);
    });

    test('should emit events for new posts', async () => {
      const thread = await forumService.createThread(generateTestThread());
      const events: any[] = [];
      
      // Subscribe to post events
      forumService.on('post:created', (event) => {
        events.push(event);
      });

      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'Test post',
        authorId: TEST_USERS.alice,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toHaveLength(1);
      expect(events[0].postId).toBe(post.id);
      expect(events[0].threadId).toBe(thread.id);
    });

    test('should notify thread participants', async () => {
      const thread = await forumService.createThread(generateTestThread({
        authorId: TEST_USERS.alice,
      }));

      // Bob participates in thread
      await forumService.createPost({
        threadId: thread.id,
        content: 'I am participating',
        authorId: TEST_USERS.bob,
      });

      // Subscribe Bob to notifications
      const notifications: any[] = [];
      forumService.on(`notification:${TEST_USERS.bob}`, (notif) => {
        notifications.push(notif);
      });

      // Charlie posts - Bob should be notified
      await forumService.createPost({
        threadId: thread.id,
        content: 'New reply',
        authorId: TEST_USERS.charlie,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('thread:reply');
    });
  });

  describe('Forum Statistics', () => {
    test('should get overall forum stats', async () => {
      const stats = await forumService.getStats();

      expect(stats).toHaveProperty('totalThreads');
      expect(stats).toHaveProperty('totalPosts');
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats.totalThreads).toBeGreaterThanOrEqual(0);
    });

    test('should get user statistics', async () => {
      // Create activity for user
      await forumService.createThread(generateTestThread({
        authorId: TEST_USERS.alice,
      }));

      const userStats = await forumService.getUserStats(TEST_USERS.alice);

      expect(userStats.threadsCreated).toBeGreaterThan(0);
      expect(userStats.postsCreated).toBeGreaterThanOrEqual(0);
      expect(userStats.reputation).toBeGreaterThanOrEqual(0);
    });

    test('should get trending topics', async () => {
      // Create threads with popular tags
      for (let i = 0; i < 5; i++) {
        await forumService.createThread(generateTestThread({
          tags: ['trending-test', 'popular'],
        }));
      }

      const trending = await forumService.getTrendingTopics();

      expect(trending).toBeDefined();
      expect(Array.isArray(trending)).toBe(true);
    });
  });

  describe('Participation Rewards', () => {
    test('should award points for creating threads', async () => {
      const initialScore = await services.participation.getUserScore(TEST_USERS.alice);
      
      await forumService.createThread(generateTestThread({
        authorId: TEST_USERS.alice,
      }));

      const newScore = await services.participation.getUserScore(TEST_USERS.alice);
      
      expect(newScore.components.forum).toBeGreaterThan(
        initialScore.components.forum
      );
    });

    test('should award points for helpful posts', async () => {
      const thread = await forumService.createThread(generateTestThread());
      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'Helpful answer',
        authorId: TEST_USERS.bob,
      });

      // Get upvotes
      await forumService.votePost(post.id, TEST_USERS.alice, 'up');
      await forumService.votePost(post.id, TEST_USERS.charlie, 'up');

      const score = await services.participation.getUserScore(TEST_USERS.bob);
      expect(score.components.forum).toBeGreaterThan(0);
    });

    test('should award bonus for accepted solutions', async () => {
      const thread = await forumService.createThread(generateTestThread({
        authorId: TEST_USERS.alice,
      }));

      const post = await forumService.createPost({
        threadId: thread.id,
        content: 'This is the solution',
        authorId: TEST_USERS.bob,
      });

      const initialScore = await services.participation.getUserScore(TEST_USERS.bob);
      
      await forumService.markAsSolution(post.id, thread.authorId);

      const newScore = await services.participation.getUserScore(TEST_USERS.bob);
      
      expect(newScore.components.forum).toBeGreaterThan(
        initialScore.components.forum
      );
    });
  });
});