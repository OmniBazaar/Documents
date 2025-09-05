/**
 * Jest Global Setup
 * 
 * Runs before all tests to configure the test environment
 */

import { logger } from '../../src/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global error handlers
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
  throw error;
});

// Mock console methods to reduce test output noise
global.console.log = jest.fn();
global.console.info = jest.fn();
global.console.warn = jest.fn();
// Keep console.error for debugging

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});