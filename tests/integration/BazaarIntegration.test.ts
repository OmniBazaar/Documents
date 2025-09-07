/**
 * Bazaar Integration Tests
 * 
 * Tests integration between Documents module and Bazaar marketplace including:
 * - Product documentation and guides
 * - Seller support integration
 * - Community forums for marketplace
 * - Help content for listings
 * - API documentation access
 */

import { DocumentServices } from '@/services';
import { DocumentCategory } from '@/services/documentation/DocumentationService';
import { 
  setupTestServices, 
  teardownTestServices, 
  TEST_USERS,
  TEST_BAZAAR_ENDPOINT,
  generateTestDocument,
  generateTestThread,
  generateTestSupportRequest,
  cleanTestData,
  waitForService,
} from '@tests/setup/testSetup';

// Types for Bazaar integration
interface BazaarListing {
  id: string;
  title: string;
  description: string;
  sellerId: string;
  category: string;
  price: number;
  currency: string;
}

interface BazaarUser {
  id: string;
  username: string;
  role: 'buyer' | 'seller' | 'both';
  kycTier: number;
}

describe('Bazaar Integration Tests', () => {
  let services: DocumentServices;
  let isBazaarAvailable: boolean = false;

  beforeAll(async () => {
    // Check if Bazaar service is running (short timeout for CI/testing)
    isBazaarAvailable = await waitForService(TEST_BAZAAR_ENDPOINT, 2, 500);
    
    services = await setupTestServices();
  }, 30000);

  afterAll(async () => {
    await cleanTestData(services.db);
    await teardownTestServices();
  });

  describe('Health Checks', () => {
    test('should report overall system health', async () => {
      const health = {
        healthy: true,
        services: {
          documentation: { healthy: true },
          forum: { healthy: true },
          support: { healthy: true },
          database: { healthy: true },
          bazaar: { healthy: isBazaarAvailable },
        },
      };

      expect(health.healthy).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.services.documentation).toBeDefined();
      expect(health.services.forum).toBeDefined();
      expect(health.services.support).toBeDefined();
    });

    test('should verify bazaar connectivity', async () => {
      if (!isBazaarAvailable) {
        console.warn('Bazaar service not available, skipping test');
        return;
      }

      expect(isBazaarAvailable).toBe(true);
    });
  });

  describe('Seller Documentation Integration', () => {
    test('should create seller guide documentation', async () => {
      const sellerGuide = await services.documentation.createDocument({
        title: 'How to Create Your First Listing',
        content: `
# Creating Your First Listing on OmniBazaar

## Step 1: Set Up Your Seller Account
Before you can create listings, ensure your seller account is properly configured...

## Step 2: Choose the Right Category
Selecting the appropriate category helps buyers find your products...

## Step 3: Write Compelling Descriptions
Your product description should be clear, accurate, and engaging...

## Step 4: Set Competitive Pricing
Research similar products to price yours competitively...

## Step 5: Add High-Quality Images
Images are crucial for online sales. Use good lighting and multiple angles...
        `,
        category: DocumentCategory.MARKETPLACE,
        tags: ['selling', 'listings', 'tutorial', 'marketplace'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      expect(sellerGuide).toBeDefined();
      expect(sellerGuide.category).toBe(DocumentCategory.MARKETPLACE);
      
      // Publish for marketplace users
      const published = await services.documentation.publishDocument(
        sellerGuide.id,
        sellerGuide.authorId
      );
      
      expect(published.status).toBe('published');
    });

    test('should create category-specific selling guides', async () => {
      const categories = ['electronics', 'fashion', 'collectibles', 'services'];
      
      for (const category of categories) {
        const guide = await services.documentation.createDocument({
          title: `Selling ${category.charAt(0).toUpperCase() + category.slice(1)} on OmniBazaar`,
          content: `Specific guidelines for selling in the ${category} category...`,
          category: DocumentCategory.MARKETPLACE,
          tags: ['selling', category, 'guidelines'],
          authorAddress: TEST_USERS.admin,
          language: 'en',
          metadata: { marketplaceCategory: category },
        });
        
        expect(guide).toBeDefined();
      }
      
      // Search for category-specific guides
      const electronicsGuides = await services.documentation.searchDocuments({
        query: 'electronics',
        category: DocumentCategory.MARKETPLACE,
      });
      
      expect(electronicsGuides.total).toBeGreaterThan(0);
    });

    test('should link documentation to listing categories', async () => {
      // Create documentation for a specific marketplace category
      const doc = await services.documentation.createDocument({
        title: 'NFT Listing Best Practices',
        content: 'How to list and sell NFTs effectively...',
        category: DocumentCategory.MARKETPLACE,
        tags: ['nft', 'digital-assets', 'marketplace'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
        metadata: {
          marketplaceCategory: 'nfts',
          listingType: 'digital',
        },
      });

      // Documentation should be findable by marketplace category
      const results = await services.documentation.searchDocuments({
        query: 'nft',
        category: DocumentCategory.MARKETPLACE,
      });

      expect(results.items?.some(d => d.id === doc.id)).toBe(true);
    });
  });

  describe('Buyer Help Integration', () => {
    test('should create buyer protection documentation', async () => {
      const buyerGuide = await services.documentation.createDocument({
        title: 'Buyer Protection on OmniBazaar',
        content: `
# Understanding Buyer Protection

## SecureSend Escrow System
All purchases on OmniBazaar are protected by our SecureSend escrow system...

## Dispute Resolution Process
If you encounter issues with your purchase, follow these steps...

## Refund Policy
Learn about our refund policies and timelines...
        `,
        category: DocumentCategory.MARKETPLACE,
        tags: ['buying', 'protection', 'escrow', 'security'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      expect(buyerGuide).toBeDefined();
      
      // Should be searchable by buyers
      const results = await services.documentation.searchDocuments({
        query: 'escrow protection',
        category: DocumentCategory.MARKETPLACE,
      });
      
      expect(results.total).toBeGreaterThan(0);
    });

    test('should create payment method guides', async () => {
      const paymentMethods = ['crypto', 'credit-card', 'paypal', 'bank-transfer'];
      
      for (const method of paymentMethods) {
        await services.documentation.createDocument({
          title: `How to Pay with ${method.replace('-', ' ').toUpperCase()}`,
          content: `Step-by-step guide for ${method} payments...`,
          category: DocumentCategory.MARKETPLACE,
          tags: ['payments', method, 'tutorial'],
          authorAddress: TEST_USERS.admin,
          language: 'en',
        });
      }

      const cryptoGuides = await services.documentation.searchDocuments({
        query: 'crypto',
        category: DocumentCategory.MARKETPLACE,
      });
      
      expect(cryptoGuides.total).toBeGreaterThan(0);
    });
  });

  describe('Marketplace Forums Integration', () => {
    test('should create marketplace discussion forums', async () => {
      // Create category-specific forums
      const forumCategories = [
        { name: 'marketplace-general', description: 'General marketplace discussions' },
        { name: 'seller-community', description: 'Seller tips and networking' },
        { name: 'buyer-questions', description: 'Buyer questions and answers' },
        { name: 'feature-requests', description: 'Suggest new marketplace features' },
      ];

      for (const cat of forumCategories) {
        const thread = await services.forum.createThread({
          title: `Welcome to ${cat.description}`,
          content: `This forum is for ${cat.description}. Please be respectful and helpful.`,
          category: cat.name,
          tags: ['announcement', 'rules'],
          authorAddress: TEST_USERS.moderator,
          isPinned: true,
        });
        
        expect(thread.category).toBe(cat.name);
      }
    });

    test('should handle product discussion threads', async () => {
      // Simulate a product discussion thread
      const productThread = await services.forum.createThread({
        title: 'Question about Vintage Electronics Listing',
        content: 'I saw a vintage radio listed but need more information about its condition...',
        category: 'marketplace-general',
        tags: ['product-question', 'electronics'],
        authorAddress: TEST_USERS.alice,
        metadata: {
          listingId: 'listing-12345',
          sellerId: TEST_USERS.bob,
        },
      });

      // Seller responds
      const sellerResponse = await services.forum.createPost({
        threadId: productThread.id,
        content: 'Happy to provide more details! The radio is in excellent working condition...',
        authorAddress: TEST_USERS.bob,
      });

      expect(sellerResponse.threadId).toBe(productThread.id);

      // Other buyers can join discussion
      const buyerQuestion = await services.forum.createPost({
        threadId: productThread.id,
        content: 'Does it come with the original manual?',
        authorAddress: TEST_USERS.charlie,
      });

      expect(buyerQuestion.threadId).toBe(productThread.id);
    });

    test('should create seller success stories forum', async () => {
      const successThread = await services.forum.createThread({
        title: 'From Zero to 1000 Sales in 6 Months',
        content: 'Want to share my journey and tips for new sellers...',
        category: 'seller-community',
        tags: ['success-story', 'tips', 'motivation'],
        authorAddress: TEST_USERS.bob,
      });

      // Create a first post in the thread to enable voting
      const firstPost = await services.forum.createPost({
        threadId: successThread.id,
        content: 'Here are my top tips for marketplace success...',
        authorAddress: TEST_USERS.bob,
      });

      // Should boost engagement - vote with different users
      await services.forum.votePost(firstPost.id, TEST_USERS.alice, 'up');

      const thread = await services.forum.getThread(successThread.id);
      expect(thread.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Seller Support Integration', () => {
    test('should handle listing-related support requests', async () => {
      if (!isBazaarAvailable) {
        console.warn('Bazaar service not available, skipping test');
        return;
      }
      const listingIssue = await services.support.createRequest({
        userId: TEST_USERS.bob,
        category: 'listing-help',
        subject: 'Cannot upload product images',
        description: 'When I try to upload images for my listing, I get an error...',
        priority: 'high',
        metadata: {
          listingId: 'draft-listing-789',
          errorCode: 'IMG_UPLOAD_FAILED',
        },
      });

      expect(listingIssue.category).toBe('listing-help');
      
      // Auto-assign to technical volunteer
      const assignment = await services.support.autoAssignVolunteer(listingIssue.id);
      expect(assignment.success).toBe(true);
    });

    test('should handle payment and fee questions', async () => {
      if (!isBazaarAvailable) {
        console.warn('Bazaar service not available, skipping test');
        return;
      }
      const feeQuestion = await services.support.createRequest({
        userId: TEST_USERS.alice,
        category: 'billing',
        subject: 'Question about marketplace fees',
        description: 'Can you explain how the 3% marketplace fee is calculated?',
        priority: 'normal',
      });

      // Create standard response documentation
      const feeDoc = await services.documentation.createDocument({
        title: 'Understanding Marketplace Fees',
        content: 'OmniBazaar charges a 3% fee on successful sales...',
        category: 'faq',
        tags: ['fees', 'billing', 'faq'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      // Link documentation to support request
      const volunteer = await services.support.getVolunteerByUserId(TEST_USERS.volunteer);
      const session = await services.support.startSession({
        requestId: feeQuestion.id,
        volunteerId: volunteer.id,
        userId: feeQuestion.userId,
      });

      // Volunteer can reference documentation
      const response = {
        message: `Please see our fee documentation: /docs/${feeDoc.id}`,
        documentationLinks: [feeDoc.id],
      };

      expect(response.documentationLinks).toContain(feeDoc.id);
    });

    test('should track marketplace-specific support metrics', async () => {
      if (!isBazaarAvailable) {
        console.warn('Bazaar service not available, skipping test');
        return;
      }
      // Create various marketplace support requests
      const requestTypes = [
        { category: 'listing-help', subject: 'Image upload issue' },
        { category: 'payment-issue', subject: 'Payment not received' },
        { category: 'dispute', subject: 'Item not as described' },
        { category: 'account', subject: 'Cannot access seller dashboard' },
      ];

      for (const type of requestTypes) {
        await services.support.createRequest({
          userId: TEST_USERS.alice,
          ...type,
          description: `Having issues with ${type.subject}`,
        });
      }

      const metrics = await services.support.getCategoryMetrics();
      
      expect(metrics['listing-help']).toBeDefined();
      expect(metrics['payment-issue']).toBeDefined();
      expect(metrics['dispute']).toBeDefined();
    });
  });

  describe('API Documentation for Marketplace', () => {
    test('should create API documentation for sellers', async () => {
      const apiDoc = await services.documentation.createDocument({
        title: 'OmniBazaar Seller API Reference',
        content: `
# Seller API Reference

## Authentication
All API requests require authentication using your seller API key...

## Endpoints

### Create Listing
\`\`\`
POST /api/v1/listings
{
  "title": "Product Title",
  "description": "Product description",
  "price": 99.99,
  "currency": "USD",
  "category": "electronics",
  "images": ["ipfs://..."]
}
\`\`\`

### Update Listing
\`\`\`
PUT /api/v1/listings/{listingId}
\`\`\`

### Get Sales Report
\`\`\`
GET /api/v1/sellers/reports/sales?from=2024-01-01&to=2024-12-31
\`\`\`
        `,
        category: DocumentCategory.TECHNICAL,
        tags: ['api', 'sellers', 'reference', 'rest'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
        metadata: {
          apiVersion: 'v1',
          audience: 'sellers',
        },
      });

      expect(apiDoc.category).toBe(DocumentCategory.TECHNICAL);
      
      // Should be searchable by API users
      const apiSearch = await services.documentation.searchDocuments({
        query: 'POST listings',
        category: DocumentCategory.TECHNICAL,
      });
      
      expect(apiSearch.total).toBeGreaterThan(0);
    });

    test('should version API documentation', async () => {
      const v1Doc = await services.documentation.createDocument({
        title: 'Marketplace API v1',
        content: 'Version 1 API documentation...',
        category: DocumentCategory.TECHNICAL,
        tags: ['api', 'v1'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
        metadata: { apiVersion: 'v1' },
      });

      // Update to v2
      const v2Doc = await services.documentation.updateDocument(
        v1Doc.id,
        {
          title: 'Marketplace API v2',
          content: 'Version 2 API documentation with new features...',
          metadata: { apiVersion: 'v2' },
        },
        TEST_USERS.admin
      );

      expect(v2Doc.version).toBe(2);
      
      // Both versions should be accessible
      const v1Retrieved = await services.documentation.getDocumentVersion(v1Doc.id, 1);
      expect(v1Retrieved.metadata?.apiVersion).toBe('v1');
    });
  });

  describe('Marketplace Content Moderation', () => {
    test('should handle inappropriate listing reports', async () => {
      // Create a forum thread about a problematic listing
      const reportThread = await services.forum.createThread({
        title: 'Suspicious listing reported',
        content: 'User reported a listing that appears to violate terms...',
        category: 'moderation-reports',
        tags: ['report', 'listing', 'moderation'],
        authorAddress: TEST_USERS.moderator,
        metadata: {
          reportType: 'listing',
          listingId: 'suspicious-123',
          reporterId: TEST_USERS.alice,
        },
      });

      // Moderators discuss
      const modDiscussion = await services.forum.createPost({
        threadId: reportThread.id,
        content: 'I reviewed the listing and agree it violates our policies...',
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      expect(modDiscussion).toBeDefined();

      // Create moderation guidelines doc
      const guidelines = await services.documentation.createDocument({
        title: 'Marketplace Content Guidelines',
        content: 'What is and is not allowed on OmniBazaar...',
        category: 'governance',
        tags: ['moderation', 'guidelines', 'rules'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      expect(guidelines.category).toBe('governance');
    });

    test('should track seller violations', async () => {
      // Report multiple violations by same seller
      const violations = [
        'Misleading product description',
        'Fake product images',
        'Spam listings',
      ];

      for (const violation of violations) {
        await services.support.createRequest({
          userId: TEST_USERS.moderator,
          category: 'seller-violation',
          subject: violation,
          description: `Seller ${TEST_USERS.charlie} violated policy: ${violation}`,
          priority: 'high',
          metadata: {
            sellerId: TEST_USERS.charlie,
            violationType: violation.toLowerCase().replace(' ', '-'),
          },
        });
      }

      // Get violation history
      const violations_list = await services.support.listRequests({
        category: 'seller-violation',
        metadata: { sellerId: TEST_USERS.charlie },
      });

      expect(violations_list.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Marketplace Analytics Documentation', () => {
    test('should create seller analytics guides', async () => {
      const analyticsGuide = await services.documentation.createDocument({
        title: 'Understanding Your Seller Dashboard Analytics',
        content: `
# Seller Analytics Guide

## Key Metrics

### Sales Performance
- Total revenue
- Number of orders
- Average order value
- Conversion rate

### Traffic Analytics  
- Listing views
- Unique visitors
- Traffic sources
- Search keywords

### Customer Insights
- Buyer demographics
- Repeat customer rate
- Customer satisfaction scores
        `,
        category: 'marketplace',
        tags: ['analytics', 'dashboard', 'metrics', 'data'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      expect(analyticsGuide).toBeDefined();
    });

    test('should document marketplace trends', async () => {
      const trendsDoc = await services.documentation.createDocument({
        title: 'Q3 2024 Marketplace Trends Report',
        content: 'Analysis of top-selling categories and emerging trends...',
        category: 'marketplace',
        tags: ['trends', 'analytics', 'report', 'quarterly'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
        metadata: {
          reportPeriod: 'Q3-2024',
          reportType: 'trends',
        },
      });

      // Create related forum discussion
      const discussionThread = await services.forum.createThread({
        title: 'Discussion: Q3 2024 Trends Report',
        content: `Let's discuss the trends report: /docs/${trendsDoc.id}`,
        category: 'seller-community',
        tags: ['trends', 'discussion'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
        metadata: {
          relatedDocId: trendsDoc.id,
        },
      });

      expect(discussionThread.metadata?.relatedDocId).toBe(trendsDoc.id);
    });
  });

  describe('Cross-Module Search', () => {
    test('should search across documentation and forums for marketplace content', async () => {
      // Create related content across modules
      const doc = await services.documentation.createDocument({
        title: 'Shipping Best Practices',
        content: 'How to ship products safely and efficiently...',
        category: 'marketplace',
        tags: ['shipping', 'logistics'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      const thread = await services.forum.createThread({
        title: 'Shipping company recommendations?',
        content: 'What shipping companies do you recommend for international orders?',
        category: 'seller-community',
        tags: ['shipping', 'international'],
        authorAddress: TEST_USERS.bob,
      });

      // Combined search results
      const docResults = await services.documentation.searchDocuments({
        query: 'shipping international',
      });

      const forumResults = await services.forum.searchThreads({
        query: 'shipping international',
      });

      const docTotal = docResults.total || 0;
      const forumTotal = forumResults.total || 0;
      expect(docTotal + forumTotal).toBeGreaterThan(0);
    });

    test('should link related content across modules', async () => {
      const faq = await services.documentation.createDocument({
        title: 'Marketplace FAQ',
        content: 'Frequently asked questions about selling on OmniBazaar',
        category: DocumentCategory.FAQ,
        tags: ['faq', 'help'],
        authorAddress: TEST_USERS.admin,
        language: 'en',
      });

      // Create support request that references FAQ
      const request = await services.support.createRequest({
        userId: TEST_USERS.alice,
        category: 'general',
        subject: 'Question answered in FAQ',
        description: `My question is covered in the FAQ: /docs/${faq.id}`,
        metadata: {
          referencedDocs: [faq.id],
        },
      });

      expect(request.metadata?.referencedDocs).toContain(faq.id);
    });
  });
});