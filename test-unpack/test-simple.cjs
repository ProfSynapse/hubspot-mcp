#!/usr/bin/env node

// Ultra-minimal CommonJS test to check if the issue is ES modules
console.error('SIMPLE: Starting ultra-simple test...');
console.error('SIMPLE: Node version:', process.version);
console.error('SIMPLE: Process running');

// Test basic timeout to see if we can keep process alive
setTimeout(() => {
  console.error('SIMPLE: Timeout reached - process still alive');
  process.exit(0);
}, 2000);

console.error('SIMPLE: Test setup complete, waiting for timeout...');