/**
 * Frontend Usage Example
 *
 * This example demonstrates how to use the Documents module's frontend API
 * client in a real application. It shows common patterns and best practices.
 *
 * @example
 */

import { DocumentsAPIClient } from '../src/frontend';
import type {
  Document,
  ForumThread,
  SupportSession
} from '../src/frontend';

// Initialize the API client
const documentsAPI = new DocumentsAPIClient('http://localhost:3000');

// Example user addresses (in a real app, these would come from wallet connection)
const USER_ADDRESS = '0x1234567890123456789012345678901234567890';
const VALIDATOR_ADDRESS = '0x0987654321098765432109876543210987654321';

/**
 * Documentation Examples
 */
async function documentationExamples() {
  console.log('=== Documentation Examples ===');

  // 1. Search for documents
  try {
    const searchResults = await documentsAPI.searchDocuments({
      query: 'installation guide',
      page: 1,
      pageSize: 10,
      filters: {
        category: 'tutorials',
        language: 'en'
      }
    });

    console.log(`Found ${searchResults.total} documents`);
    searchResults.items.forEach(doc => {
      console.log(`- ${doc.title} (${doc.category})`);
    });
  } catch (error) {
    console.error('Search failed:', error);
  }

  // 2. Create a new document
  try {
    const newDoc = await documentsAPI.createDocument({
      title: 'Getting Started with OmniBazaar',
      description: 'A comprehensive guide for new users',
      content: '# Getting Started\\n\\nWelcome to OmniBazaar...',
      category: 'tutorials',
      language: 'en',
      authorAddress: USER_ADDRESS,
      tags: ['beginner', 'guide', 'setup'],
      isOfficial: false,
      metadata: {
        readingTime: '10 minutes',
        difficulty: 'beginner'
      }
    });

    console.log(`Created document: ${newDoc.id}`);
  } catch (error) {
    console.error('Create failed:', error);
  }

  // 3. Update a document
  try {
    const documentId = 'doc-123';
    const updated = await documentsAPI.updateDocument(
      documentId,
      {
        title: 'Updated Title',
        tags: ['updated', 'v2']
      },
      USER_ADDRESS
    );

    console.log(`Updated document version: ${updated.version}`);
  } catch (error) {
    console.error('Update failed:', error);
  }

  // 4. Vote on a document (validators only)
  try {
    await documentsAPI.voteOnDocument('doc-123', true, VALIDATOR_ADDRESS);
    console.log('Vote submitted successfully');
  } catch (error) {
    console.error('Vote failed:', error);
  }
}

/**
 * Forum Examples
 */
async function forumExamples() {
  console.log('\\n=== Forum Examples ===');

  // 1. Get recent threads
  try {
    const threads = await documentsAPI.getRecentForumThreads(10, 1, 'support');
    console.log(`Recent support threads:`);
    threads.forEach(thread => {
      console.log(`- ${thread.title} (${thread.replyCount} replies)`);
    });
  } catch (error) {
    console.error('Failed to get threads:', error);
  }

  // 2. Create a new thread
  try {
    const thread = await documentsAPI.createForumThread({
      title: 'How to stake XOM tokens?',
      content: 'I want to start staking my XOM tokens but I\\'m not sure how to begin...',
      category: 'support',
      authorAddress: USER_ADDRESS,
      tags: ['staking', 'xom', 'help']
    });

    console.log(`Created thread: ${thread.id}`);

    // 3. Reply to the thread
    const reply = await documentsAPI.createForumPost({
      threadId: thread.id,
      content: 'To stake XOM tokens, you need to...',
      authorAddress: VALIDATOR_ADDRESS
    });

    console.log(`Posted reply: ${reply.id}`);
  } catch (error) {
    console.error('Forum operation failed:', error);
  }

  // 4. Search forum
  try {
    const searchResults = await documentsAPI.searchForum({
      query: 'staking rewards',
      category: 'defi',
      sortBy: 'relevance'
    });

    console.log(`Found ${searchResults.threads.length} matching threads`);
  } catch (error) {
    console.error('Forum search failed:', error);
  }

  // 5. Vote on a post
  try {
    await documentsAPI.voteOnPost('post-123', true, USER_ADDRESS);
    console.log('Upvoted post');
  } catch (error) {
    console.error('Vote failed:', error);
  }
}

/**
 * Support Examples
 */
async function supportExamples() {
  console.log('\\n=== Support Examples ===');

  // 1. Request support
  let session: SupportSession | null = null;
  try {
    session = await documentsAPI.requestSupport({
      userAddress: USER_ADDRESS,
      category: 'wallet_setup',
      priority: 'high',
      initialMessage: 'I cannot connect my wallet to the marketplace',
      language: 'en',
      userScore: 75,
      metadata: {
        browser: 'Chrome 120',
        os: 'Windows 11',
        walletType: 'MetaMask'
      }
    });

    console.log(`Support session created: ${session.sessionId}`);
  } catch (error) {
    console.error('Support request failed:', error);
  }

  // 2. Register as a volunteer
  try {
    await documentsAPI.registerVolunteer({
      address: VALIDATOR_ADDRESS,
      displayName: 'Helpful Validator',
      status: 'available',
      languages: ['en', 'es'],
      expertiseCategories: ['wallet_setup', 'technical_issue'],
      participationScore: 85,
      maxConcurrentSessions: 3,
      hoursPerWeek: 10,
      experienceLevel: 'expert'
    });

    console.log('Registered as support volunteer');
  } catch (error) {
    console.error('Volunteer registration failed:', error);
  }

  // 3. Send a message in support session
  if (session) {
    try {
      await documentsAPI.sendSupportMessage(
        session.sessionId,
        'Can you tell me which version of MetaMask you are using?',
        VALIDATOR_ADDRESS
      );

      console.log('Support message sent');
    } catch (error) {
      console.error('Message send failed:', error);
    }
  }

  // 4. Get support statistics
  try {
    const stats = await documentsAPI.getSupportStats();
    console.log('Support system stats:', {
      activeVolunteers: stats.activeVolunteers,
      waitingSessions: stats.waitingSessions,
      avgWaitTime: stats.avgWaitTime
    });
  } catch (error) {
    console.error('Failed to get support stats:', error);
  }
}

/**
 * Unified Search Example
 */
async function unifiedSearchExample() {
  console.log('\\n=== Unified Search Example ===');

  try {
    const results = await documentsAPI.unifiedSearch('wallet security');

    if (results.documents) {
      console.log(`Documents: ${results.documents.items.length} results`);
    }

    if (results.forum) {
      console.log(`Forum threads: ${results.forum.threads.length} results`);
      console.log(`Forum posts: ${results.forum.posts.length} results`);
    }
  } catch (error) {
    console.error('Unified search failed:', error);
  }
}

/**
 * Error Handling Example
 */
async function errorHandlingExample() {
  console.log('\\n=== Error Handling Example ===');

  // Handle 404 errors
  try {
    const doc = await documentsAPI.getDocument('non-existent-id');
    if (!doc) {
      console.log('Document not found');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      console.log('Document not found (404)');
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // Handle validation errors
  try {
    await documentsAPI.createDocument({
      title: '', // Invalid: empty title
      content: 'Test',
      category: 'tutorials',
      authorAddress: USER_ADDRESS
    } as any);
  } catch (error) {
    console.log('Validation error:', error.message);
  }
}

/**
 * Real-world React Hook Example
 */
function useDocumentSearch() {
  // This would be a React hook in a real application
  const cache = new Map<string, any>();

  async function searchWithCache(query: string) {
    const cacheKey = `search:${query}`;

    if (cache.has(cacheKey)) {
      console.log('Returning cached results');
      return cache.get(cacheKey);
    }

    const results = await documentsAPI.searchDocuments({ query });
    cache.set(cacheKey, results);

    // Clear cache after 5 minutes
    setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);

    return results;
  }

  return { searchWithCache };
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('Running Documents Module Frontend Examples\\n');

  await documentationExamples();
  await forumExamples();
  await supportExamples();
  await unifiedSearchExample();
  await errorHandlingExample();

  // Check user's participation score
  try {
    const score = await documentsAPI.getUserScore(USER_ADDRESS);
    console.log(`\\nYour participation score: ${score}/100`);
  } catch (error) {
    console.error('Failed to get participation score:', error);
  }

  // Health check
  try {
    const health = await documentsAPI.getHealthStatus();
    console.log('\\nSystem health:', health.status);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  documentationExamples,
  forumExamples,
  supportExamples,
  unifiedSearchExample,
  errorHandlingExample,
  useDocumentSearch
};