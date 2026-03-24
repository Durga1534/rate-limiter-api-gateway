import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Mock setup for tests
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
});

afterAll(async () => {
  // Cleanup if needed
});

beforeEach(async () => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test if needed
});
