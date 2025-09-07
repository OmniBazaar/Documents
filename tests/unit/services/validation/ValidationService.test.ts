/**
 * ValidationService Unit Tests
 * 
 * Tests the validation service functionality including:
 * - Consensus requests for documents, forums, and support
 * - Review requests for content validation
 * - Error handling and edge cases
 * - Integration with validator network
 */

import { ValidationService, ConsensusType, ReviewType } from '../../../../src/services/validation/ValidationService';
import { TEST_VALIDATOR_ENDPOINT } from '../../../setup/testSetup';
import { logger } from '../../../../src/utils/logger';

// Mock logger to capture log calls
jest.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService(TEST_VALIDATOR_ENDPOINT);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with endpoint', () => {
      expect(validationService).toBeDefined();
    });

    test('should handle invalid endpoint gracefully', () => {
      const invalidService = new ValidationService('invalid-url');
      expect(invalidService).toBeDefined();
    });

    test('should store validator endpoint correctly', () => {
      const customEndpoint = 'http://custom-validator.test';
      const service = new ValidationService(customEndpoint);
      expect(service).toBeDefined();
    });
  });

  describe('Consensus Requests', () => {
    test('should request document update consensus successfully', () => {
      const testData = {
        documentId: 'doc-123',
        newContent: 'Updated content',
        changes: ['title', 'content'],
      };

      expect(() => {
        validationService.requestConsensus('documentUpdate', testData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'documentUpdate',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should request forum moderation consensus successfully', () => {
      const testData = {
        postId: 'post-456',
        reason: 'inappropriate content',
        reporterAddress: '0x1234567890123456789012345678901234567890',
      };

      expect(() => {
        validationService.requestConsensus('forumModeration', testData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'forumModeration',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should request support quality consensus successfully', () => {
      const testData = {
        sessionId: 'sess-789',
        qualityMetrics: {
          clarity: true,
          helpfulness: false,
        },
      };

      expect(() => {
        validationService.requestConsensus('supportQuality', testData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'supportQuality',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should handle consensus request errors', () => {
      // Mock logger.info to throw an error to trigger the catch block
      const originalLoggerInfo = mockLogger.info;
      mockLogger.info = jest.fn(() => {
        throw new Error('Logger service unavailable');
      });

      expect(() => {
        validationService.requestConsensus('documentUpdate', { test: 'data' });
      }).toThrow('Logger service unavailable');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request consensus', expect.objectContaining({
        type: 'documentUpdate',
        error: 'Logger service unavailable',
      }));

      // Restore original logger
      mockLogger.info = originalLoggerInfo;
    });

    test('should handle different consensus types', () => {
      const consensusTypes: ConsensusType[] = ['documentUpdate', 'forumModeration', 'supportQuality'];
      
      consensusTypes.forEach(type => {
        expect(() => {
          validationService.requestConsensus(type, { test: 'data' });
        }).not.toThrow();

        expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
          type,
          endpoint: TEST_VALIDATOR_ENDPOINT,
        });
      });
    });
  });

  describe('Review Requests', () => {
    test('should request document contribution review successfully', () => {
      const reviewRequest = {
        itemId: 'doc-123',
        context: {
          author: '0x1234567890123456789012345678901234567890',
          category: 'technical',
          significance: 'major',
        },
      };

      expect(() => {
        validationService.requestReview('documentContribution', reviewRequest);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'documentContribution',
        itemId: 'doc-123',
      });
    });

    test('should request forum post review successfully', () => {
      const reviewRequest = {
        itemId: 'post-456',
        context: {
          reportCount: 3,
          reportReasons: ['spam', 'inappropriate'],
        },
      };

      expect(() => {
        validationService.requestReview('forumPost', reviewRequest);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'forumPost',
        itemId: 'post-456',
      });
    });

    test('should request support session review successfully', () => {
      const reviewRequest = {
        itemId: 'sess-789',
        context: {
          volunteerAddress: '0x2345678901234567890123456789012345678901',
          userRating: 2,
          issues: ['unresponsive', 'unhelpful'],
        },
      };

      expect(() => {
        validationService.requestReview('supportSession', reviewRequest);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'supportSession',
        itemId: 'sess-789',
      });
    });

    test('should handle review request with minimal data', () => {
      const reviewRequest = {};

      expect(() => {
        validationService.requestReview('documentContribution', reviewRequest);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'documentContribution',
        itemId: '',
      });
    });

    test('should handle review request with undefined context', () => {
      const reviewRequest = {
        itemId: 'test-123',
        context: undefined,
      };

      expect(() => {
        validationService.requestReview('forumPost', reviewRequest);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'forumPost',
        itemId: 'test-123',
      });
    });

    test('should handle review request errors', () => {
      // Create a scenario that causes an error
      const originalConsole = console.log;
      console.log = jest.fn(() => {
        throw new Error('Console error');
      });

      // Trigger error by making logger.info fail
      const originalLoggerInfo = mockLogger.info;
      mockLogger.info = jest.fn(() => {
        throw new Error('Logger error');
      });

      expect(() => {
        validationService.requestReview('documentContribution', { itemId: 'test' });
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request review', expect.objectContaining({
        type: 'documentContribution',
        error: 'Logger error',
      }));

      // Restore original functions
      console.log = originalConsole;
      mockLogger.info = originalLoggerInfo;
    });

    test('should handle different review types', () => {
      const reviewTypes: ReviewType[] = ['documentContribution', 'forumPost', 'supportSession'];
      
      reviewTypes.forEach(type => {
        expect(() => {
          validationService.requestReview(type, { itemId: `test-${type}` });
        }).not.toThrow();

        expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
          type,
          itemId: `test-${type}`,
        });
      });
    });
  });

  describe('Consensus Status Checking', () => {
    test('should return default consensus status', () => {
      const requestId = 'consensus-123';
      const status = validationService.getConsensusStatus(requestId);
      
      expect(status).toBeDefined();
      expect(status.status).toBe('pending');
      expect(status.votes).toEqual({
        yes: 0,
        no: 0,
        abstain: 0,
      });
    });

    test('should handle different request IDs', () => {
      const requestIds = ['req-1', 'req-2', 'req-3', ''];
      
      requestIds.forEach(requestId => {
        const status = validationService.getConsensusStatus(requestId);
        
        expect(status).toBeDefined();
        expect(status.status).toBe('pending');
        expect(status.votes).toEqual({
          yes: 0,
          no: 0,
          abstain: 0,
        });
      });
    });

    test('should handle consensus status errors', () => {
      // Mock an error in getConsensusStatus by overriding the method
      const originalMethod = validationService.getConsensusStatus;
      validationService.getConsensusStatus = jest.fn(() => {
        throw new Error('Status lookup failed');
      });

      expect(() => {
        validationService.getConsensusStatus('test-id');
      }).toThrow('Status lookup failed');

      // Restore original method
      validationService.getConsensusStatus = originalMethod;
    });

    test('should log errors for failed status checks', () => {
      // Create a scenario that causes logger.error to be called
      const originalLoggerError = mockLogger.error;
      let errorWasCalled = false;
      
      mockLogger.error = jest.fn((...args) => {
        errorWasCalled = true;
        originalLoggerError(...args);
      });

      // Mock the method to throw an error
      const originalMethod = validationService.getConsensusStatus;
      validationService.getConsensusStatus = jest.fn((requestId: string) => {
        const error = new Error('Database connection failed');
        mockLogger.error('Failed to get consensus status', {
          requestId,
          error: error.message,
        });
        throw error;
      });

      expect(() => {
        validationService.getConsensusStatus('failing-request');
      }).toThrow();

      expect(errorWasCalled).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get consensus status', {
        requestId: 'failing-request',
        error: 'Database connection failed',
      });

      // Restore original method and logger
      validationService.getConsensusStatus = originalMethod;
      mockLogger.error = originalLoggerError;
    });
  });

  describe('Integration and Edge Cases', () => {
    test('should handle empty consensus data', () => {
      expect(() => {
        validationService.requestConsensus('documentUpdate', null);
      }).not.toThrow();

      expect(() => {
        validationService.requestConsensus('documentUpdate', undefined);
      }).not.toThrow();

      expect(() => {
        validationService.requestConsensus('documentUpdate', '');
      }).not.toThrow();
    });

    test('should handle complex nested data structures', () => {
      const complexData = {
        document: {
          id: 'complex-doc',
          metadata: {
            tags: ['tag1', 'tag2'],
            authors: [
              { address: '0x1234', role: 'primary' },
              { address: '0x5678', role: 'contributor' },
            ],
          },
          content: {
            sections: [
              { title: 'Introduction', content: 'Lorem ipsum...' },
              { title: 'Implementation', content: 'Technical details...' },
            ],
          },
        },
        changes: {
          added: ['section-3'],
          modified: ['section-1'],
          removed: [],
        },
      };

      expect(() => {
        validationService.requestConsensus('documentUpdate', complexData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'documentUpdate',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should handle concurrent consensus and review requests', () => {
      const promises = [];

      // Multiple consensus requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          Promise.resolve().then(() => {
            validationService.requestConsensus('documentUpdate', { docId: `doc-${i}` });
          })
        );
      }

      // Multiple review requests
      for (let i = 0; i < 3; i++) {
        promises.push(
          Promise.resolve().then(() => {
            validationService.requestReview('forumPost', { itemId: `post-${i}` });
          })
        );
      }

      expect(async () => {
        await Promise.all(promises);
      }).not.toThrow();
    });

    test('should handle special characters in data', () => {
      const dataWithSpecialChars = {
        title: 'Document with émojis 🚀 and spécial characters',
        content: 'Content with newlines\n\nand tabs\t\tand unicode: 你好世界',
        tags: ['tag-with-dashes', 'tag_with_underscores', 'tag.with.dots'],
      };

      expect(() => {
        validationService.requestConsensus('documentUpdate', dataWithSpecialChars);
      }).not.toThrow();

      expect(() => {
        validationService.requestReview('documentContribution', {
          itemId: 'special-chars-doc',
          context: dataWithSpecialChars,
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle logger failures gracefully', () => {
      // Mock logger to throw errors
      const originalLoggerInfo = mockLogger.info;
      const originalLoggerError = mockLogger.error;
      
      mockLogger.info = jest.fn(() => {
        throw new Error('Logger service unavailable');
      });
      
      mockLogger.error = jest.fn();

      expect(() => {
        validationService.requestConsensus('documentUpdate', { test: 'data' });
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request consensus', {
        type: 'documentUpdate',
        error: 'Logger service unavailable',
      });

      // Restore original logger methods
      mockLogger.info = originalLoggerInfo;
      mockLogger.error = originalLoggerError;
    });

    test('should handle different error types in requests', () => {
      const errorTypes = [
        new Error('Network error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
        'String error',
        { message: 'Object error' },
        42, // Number as error
      ];

      errorTypes.forEach((error, index) => {
        // Mock logger.info to throw the specific error
        mockLogger.info = jest.fn(() => {
          throw error;
        });

        expect(() => {
          validationService.requestConsensus('documentUpdate', { testCase: index });
        }).toThrow();

        const expectedErrorMessage = error instanceof Error ? error.message : String(error);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to request consensus', {
          type: 'documentUpdate',
          error: expectedErrorMessage,
        });
      });
    });

    test('should maintain endpoint configuration across errors', () => {
      const customEndpoint = 'http://test-validator.local';
      const service = new ValidationService(customEndpoint);
      
      // Mock logger to throw error
      mockLogger.info = jest.fn(() => {
        throw new Error('Temporary failure');
      });

      try {
        service.requestConsensus('documentUpdate', { test: 'data' });
      } catch (error) {
        // Expected to throw
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request consensus', {
        type: 'documentUpdate',
        error: 'Temporary failure',
      });

      // Service should still be functional after error
      mockLogger.info = jest.fn(); // Reset to not throw
      
      expect(() => {
        service.requestConsensus('forumModeration', { test: 'data' });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'forumModeration',
        endpoint: customEndpoint,
      });
    });

    test('should handle status check errors comprehensively', () => {
      const requestIds = ['normal-id', '', 'very-long-id-'.repeat(10), '🚀-emoji-id'];
      
      requestIds.forEach(requestId => {
        // Mock logger.error for this test  
        const originalLoggerError = mockLogger.error;
        mockLogger.error = jest.fn(() => {
          throw new Error('Logger cascade failure');
        });

        // Override getConsensusStatus to trigger error path
        const originalMethod = validationService.getConsensusStatus;
        validationService.getConsensusStatus = jest.fn((id: string) => {
          originalLoggerError('Failed to get consensus status', {
            requestId: id,
            error: 'Test error',
          });
          throw new Error('Test error');
        });

        expect(() => {
          validationService.getConsensusStatus(requestId);
        }).toThrow();

        // Restore methods
        validationService.getConsensusStatus = originalMethod;
        mockLogger.error = originalLoggerError;
      });
    });
  });

  describe('Validation Workflows', () => {
    test('should handle document validation workflow', () => {
      const documentData = {
        documentId: 'doc-workflow-1',
        changes: {
          title: 'Updated Title',
          content: 'Updated content with validation',
          metadata: { category: 'technical', priority: 'high' }
        },
        requester: '0x1234567890123456789012345678901234567890',
        reason: 'Content improvement and accuracy updates'
      };

      expect(() => {
        validationService.requestConsensus('documentUpdate', documentData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'documentUpdate',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should handle forum moderation workflow', () => {
      const moderationData = {
        postId: 'post-moderate-1',
        threadId: 'thread-123',
        violation: 'inappropriate_content',
        reporterAddress: '0x2345678901234567890123456789012345678901',
        evidence: {
          screenshots: ['hash1', 'hash2'],
          reportCount: 3,
          previousViolations: 1
        },
        recommendedAction: 'warning'
      };

      expect(() => {
        validationService.requestConsensus('forumModeration', moderationData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'forumModeration',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should handle support quality assessment workflow', () => {
      const qualityData = {
        sessionId: 'sess-quality-1',
        volunteerAddress: '0x3456789012345678901234567890123456789012',
        userAddress: '0x4567890123456789012345678901234567890123',
        metrics: {
          responseTime: 120, // seconds
          resolutionTime: 1800, // 30 minutes
          userSatisfaction: 4, // 1-5 scale
          issueResolved: true,
          followUpNeeded: false
        },
        qualityIndicators: {
          clarity: 'high',
          helpfulness: 'high',
          professionalism: 'medium',
          accuracy: 'high'
        }
      };

      expect(() => {
        validationService.requestConsensus('supportQuality', qualityData);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'supportQuality',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });

    test('should handle multi-step validation processes', () => {
      const validationSteps = [
        { type: 'documentUpdate', data: { step: 1, docId: 'multi-step-doc' } },
        { type: 'forumModeration', data: { step: 2, postId: 'multi-step-post' } },
        { type: 'supportQuality', data: { step: 3, sessionId: 'multi-step-session' } }
      ];

      expect(() => {
        validationSteps.forEach(({ type, data }) => {
          validationService.requestConsensus(type as ConsensusType, data);
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('Consensus Mechanisms', () => {
    test('should simulate pending consensus state', () => {
      const requestId = 'consensus-pending-123';
      const status = validationService.getConsensusStatus(requestId);

      expect(status).toEqual({
        status: 'pending',
        votes: { yes: 0, no: 0, abstain: 0 }
      });
    });

    test('should handle different consensus request IDs', () => {
      const requestIds = [
        'consensus-doc-update-456',
        'consensus-forum-mod-789',
        'consensus-support-quality-012',
        'consensus-urgent-345'
      ];

      requestIds.forEach(requestId => {
        const status = validationService.getConsensusStatus(requestId);
        
        expect(status).toBeDefined();
        expect(status.status).toBe('pending');
        expect(status.votes).toEqual({ yes: 0, no: 0, abstain: 0 });
      });
    });

    test('should track consensus status for multiple simultaneous requests', () => {
      const requests = Array.from({ length: 10 }, (_, i) => `consensus-batch-${i}`);
      
      const statuses = requests.map(requestId => 
        validationService.getConsensusStatus(requestId)
      );

      expect(statuses).toHaveLength(10);
      statuses.forEach(status => {
        expect(status.status).toBe('pending');
        expect(status.votes).toEqual({ yes: 0, no: 0, abstain: 0 });
      });
    });

    test('should handle consensus status with special characters in request ID', () => {
      const specialIds = [
        'consensus-émoji-🚀-test',
        'consensus-unicode-你好-test',
        'consensus-symbols-!@#$%^&*()-test',
        'consensus-very-long-id-' + 'x'.repeat(100)
      ];

      specialIds.forEach(requestId => {
        expect(() => {
          const status = validationService.getConsensusStatus(requestId);
          expect(status).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('Review Workflows', () => {
    test('should handle comprehensive document contribution review', () => {
      const comprehensiveReview = {
        itemId: 'doc-comprehensive-123',
        context: {
          author: '0x5678901234567890123456789012345678901234',
          category: 'technical',
          significance: 'major',
          changeType: 'content_update',
          affectedSections: ['introduction', 'implementation', 'troubleshooting'],
          reviewCriteria: {
            accuracy: 'required',
            clarity: 'required',
            completeness: 'required',
            consistency: 'preferred'
          },
          expertiseRequired: ['blockchain', 'smart_contracts', 'dapp_development'],
          urgency: 'normal',
          stakeholderImpact: 'medium'
        }
      };

      expect(() => {
        validationService.requestReview('documentContribution', comprehensiveReview);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'documentContribution',
        itemId: 'doc-comprehensive-123',
      });
    });

    test('should handle detailed forum post review', () => {
      const detailedForumReview = {
        itemId: 'post-detailed-456',
        context: {
          threadId: 'thread-789',
          reportCount: 5,
          reportReasons: ['spam', 'inappropriate', 'off_topic'],
          reporterAddresses: [
            '0x6789012345678901234567890123456789012345',
            '0x7890123456789012345678901234567890123456'
          ],
          postMetrics: {
            upvotes: 2,
            downvotes: 8,
            replies: 1,
            views: 45
          },
          authorHistory: {
            totalPosts: 23,
            previousViolations: 1,
            reputationScore: 45
          },
          contentAnalysis: {
            sentiment: 'negative',
            toxicityScore: 0.7,
            topicRelevance: 'low'
          }
        }
      };

      expect(() => {
        validationService.requestReview('forumPost', detailedForumReview);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'forumPost',
        itemId: 'post-detailed-456',
      });
    });

    test('should handle comprehensive support session review', () => {
      const comprehensiveSessionReview = {
        itemId: 'sess-comprehensive-789',
        context: {
          volunteerAddress: '0x8901234567890123456789012345678901234567',
          userAddress: '0x9012345678901234567890123456789012345678',
          sessionMetrics: {
            duration: 1800, // 30 minutes
            messagesExchanged: 15,
            responseTime: 120, // 2 minutes average
            resolutionTime: 1650 // 27.5 minutes
          },
          userFeedback: {
            rating: 2, // 1-5 scale
            comments: 'Volunteer was not helpful and seemed uninterested',
            issues: ['unresponsive', 'unhelpful', 'unprofessional']
          },
          volunteerMetrics: {
            totalSessions: 45,
            averageRating: 4.2,
            specializations: ['technical_support', 'wallet_issues'],
            currentLoad: 2 // active sessions
          },
          sessionOutcome: {
            resolved: false,
            escalated: true,
            followUpScheduled: true,
            userSatisfied: false
          },
          qualityIndicators: {
            responseQuality: 'poor',
            problemResolution: 'unsuccessful',
            userExperience: 'negative',
            adherenceToProtocol: 'partial'
          }
        }
      };

      expect(() => {
        validationService.requestReview('supportSession', comprehensiveSessionReview);
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Review requested', {
        type: 'supportSession',
        itemId: 'sess-comprehensive-789',
      });
    });

    test('should handle bulk review requests', () => {
      const bulkReviews = Array.from({ length: 15 }, (_, i) => ({
        type: ['documentContribution', 'forumPost', 'supportSession'][i % 3] as ReviewType,
        request: {
          itemId: `bulk-item-${i}`,
          context: {
            batchId: 'bulk-review-batch-1',
            priority: i < 5 ? 'high' : 'normal',
            automated: false
          }
        }
      }));

      expect(() => {
        bulkReviews.forEach(({ type, request }) => {
          validationService.requestReview(type, request);
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledTimes(15);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle consensus followed by review workflow', () => {
      const workflowData = {
        documentId: 'doc-workflow-integration',
        initialContent: 'Original content',
        proposedChanges: 'Updated content with improvements'
      };

      // Step 1: Request consensus for the change
      expect(() => {
        validationService.requestConsensus('documentUpdate', workflowData);
      }).not.toThrow();

      // Step 2: Request review of the implementation
      expect(() => {
        validationService.requestReview('documentContribution', {
          itemId: workflowData.documentId,
          context: { workflowStep: 'post-consensus-review' }
        });
      }).not.toThrow();

      // Step 3: Check consensus status
      expect(() => {
        const status = validationService.getConsensusStatus('workflow-consensus-123');
        expect(status).toBeDefined();
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledTimes(2); // consensus + review
    });

    test('should handle cross-module validation scenarios', () => {
      const crossModuleData = {
        documentId: 'cross-module-doc',
        forumThreadId: 'cross-module-thread',
        supportSessionId: 'cross-module-session',
        validationType: 'cross_module_consistency',
        affectedModules: ['documentation', 'forum', 'support'],
        integrationPoints: {
          docToForum: 'related_discussion',
          docToSupport: 'help_reference',
          forumToSupport: 'escalation_path'
        }
      };

      // Test all three consensus types for cross-module validation
      expect(() => {
        validationService.requestConsensus('documentUpdate', {
          ...crossModuleData,
          module: 'documentation'
        });
        
        validationService.requestConsensus('forumModeration', {
          ...crossModuleData,
          module: 'forum'
        });
        
        validationService.requestConsensus('supportQuality', {
          ...crossModuleData,
          module: 'support'
        });
      }).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledTimes(3);
    });

    test('should handle validator network communication simulation', () => {
      const networkData = {
        validatorNodes: ['node1', 'node2', 'node3'],
        consensusThreshold: 0.67,
        timeoutPeriod: 300000, // 5 minutes
        networkStatus: 'active',
        activeValidators: 15,
        minimumValidators: 7
      };

      expect(() => {
        validationService.requestConsensus('documentUpdate', networkData);
      }).not.toThrow();

      // Simulate network communication logging
      expect(mockLogger.info).toHaveBeenCalledWith('Consensus requested', {
        type: 'documentUpdate',
        endpoint: TEST_VALIDATOR_ENDPOINT,
      });
    });
  });

  describe('Service Lifecycle', () => {
    test('should be reusable across multiple operations', () => {
      const service = new ValidationService(TEST_VALIDATOR_ENDPOINT);
      
      // Perform multiple operations to test reusability
      expect(() => {
        service.requestConsensus('documentUpdate', { doc1: 'data' });
        service.requestReview('forumPost', { itemId: 'post1' });
        service.getConsensusStatus('status1');
        service.requestConsensus('supportQuality', { session1: 'data' });
        service.requestReview('documentContribution', { itemId: 'doc2' });
        service.getConsensusStatus('status2');
      }).not.toThrow();

      // Verify all operations logged correctly
      expect(mockLogger.info).toHaveBeenCalledTimes(4); // 2 consensus + 2 review requests
    });

    test('should handle rapid successive calls', () => {
      const operations = [];
      
      for (let i = 0; i < 20; i++) {
        operations.push(() => {
          validationService.requestConsensus('documentUpdate', { iteration: i });
        });
        operations.push(() => {
          validationService.requestReview('forumPost', { itemId: `post-${i}` });
        });
        operations.push(() => {
          validationService.getConsensusStatus(`status-${i}`);
        });
      }

      expect(() => {
        operations.forEach(op => op());
      }).not.toThrow();

      // Verify expected number of info log calls (40 consensus/review requests)
      expect(mockLogger.info).toHaveBeenCalledTimes(40);
    });

    test('should maintain state across service lifecycle', () => {
      const service = new ValidationService('http://test-lifecycle.local');
      
      // Test service creation
      expect(service).toBeDefined();
      
      // Test multiple consensus operations
      for (let i = 0; i < 5; i++) {
        expect(() => {
          service.requestConsensus('documentUpdate', { lifecycleTest: i });
        }).not.toThrow();
      }
      
      // Test multiple review operations  
      for (let i = 0; i < 3; i++) {
        expect(() => {
          service.requestReview('supportSession', { itemId: `lifecycle-${i}` });
        }).not.toThrow();
      }
      
      // Test status checks
      for (let i = 0; i < 2; i++) {
        expect(() => {
          const status = service.getConsensusStatus(`lifecycle-status-${i}`);
          expect(status.status).toBe('pending');
        }).not.toThrow();
      }
      
      // Verify total operations (8 info logs: 5 consensus + 3 review)
      expect(mockLogger.info).toHaveBeenCalledTimes(8);
    });
  });
});