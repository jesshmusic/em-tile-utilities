/**
 * Jest setup file for Dorman Lakely's Tile Utilities tests
 * Mocks Foundry VTT globals and APIs
 */

import { beforeAll, afterEach, jest } from '@jest/globals';
import { mockFoundry } from './mocks/foundry';

// Set up Foundry VTT global mocks
beforeAll(() => {
  mockFoundry();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
