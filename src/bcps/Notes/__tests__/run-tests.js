/**
 * Notes Service Test Runner
 * 
 * Simple script to run the Notes service tests.
 */

// Import Jest
const jest = require('jest');

// Set up Jest options
const options = {
  projects: [__dirname],
  testRegex: 'notes\\.service\\.test\\.ts$',
  verbose: true
};

// Run the tests
jest.run(options);
