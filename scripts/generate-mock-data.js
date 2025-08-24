/**
 * Generate Mock Analytics Data
 * Creates realistic test data based on actual BCP tools in the codebase
 */

const path = require('path');
const { getSQLiteDatabase } = require('../build/src/analytics/sqlite-database.js');
const { SQLiteAnalyticsService } = require('../build/src/analytics/sqlite-analytics-service.js');

// BCP tools based on actual codebase structure
const BCP_TOOLS = {
  Companies: ['create', 'get', 'update', 'search', 'recent'],
  Contacts: ['create', 'get', 'update', 'search', 'recent'],
  Deals: ['create', 'get', 'update', 'search', 'recent', 'batchCreate', 'batchUpdate'],
  Notes: ['createCompanyNote', 'createContactNote', 'createDealNote', 'get', 'listCompanyNotes', 'listContactNotes', 'listDealNotes', 'update'],
  Properties: ['create', 'get', 'update', 'list', 'createGroup', 'getGroup', 'listGroups', 'updateGroup'],
  Products: ['get', 'list', 'search'],
  Quotes: ['create', 'get', 'update', 'search', 'recent', 'addLineItem', 'removeLineItem', 'listLineItems', 'updateLineItem'],
  Emails: ['create', 'get', 'update', 'list', 'recent'],
  BlogPosts: ['create', 'get', 'update', 'list', 'recent'],
  Associations: ['create', 'list', 'batchCreate', 'batchRead', 'createDefault', 'batchCreateDefault', 'getAssociationTypes', 'getAssociationTypeReference']
};

// Common error types
const ERROR_TYPES = [
  'ValidationError',
  'AuthenticationError', 
  'RateLimitError',
  'NotFoundError',
  'NetworkError',
  'ServerError'
];

const ERROR_MESSAGES = {
  ValidationError: [
    'Missing required parameter: objectId',
    'Invalid email format',
    'Property value exceeds maximum length',
    'Invalid date format'
  ],
  AuthenticationError: [
    'Invalid access token',
    'Token expired',
    'Insufficient permissions'
  ],
  RateLimitError: [
    'API rate limit exceeded',
    'Too many requests per minute'
  ],
  NotFoundError: [
    'Contact not found',
    'Company not found', 
    'Deal not found',
    'Property not found'
  ],
  NetworkError: [
    'Connection timeout',
    'DNS resolution failed',
    'Network unreachable'
  ],
  ServerError: [
    'Internal server error',
    'Service temporarily unavailable',
    'Database connection failed'
  ]
};

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockParameters(domain, operation) {
  const params = {};
  
  switch (domain) {
    case 'Companies':
      if (operation === 'create') {
        params.properties = { name: 'Acme Corp', domain: 'acme.com' };
      } else if (operation === 'get') {
        params.objectId = getRandomInt(1000, 9999).toString();
      } else if (operation === 'search') {
        params.query = 'tech company';
      }
      break;
    case 'Contacts':
      if (operation === 'create') {
        params.properties = { firstname: 'John', lastname: 'Doe', email: 'john@example.com' };
      } else if (operation === 'get') {
        params.objectId = getRandomInt(1000, 9999).toString();
      }
      break;
    case 'Deals':
      if (operation === 'create') {
        params.properties = { dealname: 'New Deal', amount: '10000' };
      }
      break;
    case 'Notes':
      if (operation.includes('create')) {
        params.note = { body: 'This is a test note' };
        if (operation === 'createContactNote') params.contactId = getRandomInt(1000, 9999).toString();
        if (operation === 'createCompanyNote') params.companyId = getRandomInt(1000, 9999).toString();
        if (operation === 'createDealNote') params.dealId = getRandomInt(1000, 9999).toString();
      }
      break;
  }
  
  return params;
}

async function generateMockData() {
  console.log('Initializing SQLite database...');
  const analyticsService = new SQLiteAnalyticsService();
  await analyticsService.initialize();

  console.log('Generating mock analytics data...');
  
  const now = new Date();
  const dataPoints = 1000; // Generate 1000 mock data points
  
  for (let i = 0; i < dataPoints; i++) {
    // Generate timestamp within last 30 days
    const daysAgo = Math.random() * 30;
    const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    // Pick random domain and operation
    const domain = getRandomElement(Object.keys(BCP_TOOLS));
    const operation = getRandomElement(BCP_TOOLS[domain]);
    
    // Generate success/failure (85% success rate)
    const success = Math.random() > 0.15;
    
    // Generate response time (50-2000ms, with some outliers)
    let responseTime;
    if (Math.random() > 0.95) {
      responseTime = getRandomInt(2000, 8000); // Slow responses 5% of time
    } else {
      responseTime = getRandomInt(50, 1500); // Normal responses
    }
    
    const parameters = generateMockParameters(domain, operation);
    const responseSize = getRandomInt(100, 5000);
    
    // Log the tool call
    await analyticsService.logToolCall(
      domain,
      operation,
      success,
      responseTime,
      parameters,
      responseSize
    );
    
    // If it failed, also log an error
    if (!success) {
      const errorType = getRandomElement(ERROR_TYPES);
      const errorMessage = getRandomElement(ERROR_MESSAGES[errorType]);
      const stackTrace = `Error: ${errorMessage}\n    at ${domain}.${operation}()\n    at /src/bcps/${domain}/${operation}.ts:42:15`;
      
      await analyticsService.logError(
        domain,
        operation,
        errorType,
        errorMessage,
        stackTrace,
        parameters
      );
    }
    
    if (i % 100 === 0) {
      console.log(`Generated ${i}/${dataPoints} data points...`);
    }
  }
  
  console.log(`Generated ${dataPoints} mock analytics data points!`);
  
  // Also create an admin user
  const bcrypt = require('bcrypt');
  const db = getSQLiteDatabase();
  
  const adminPassword = 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  
  try {
    await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      ['admin', passwordHash]
    );
    console.log('Created admin user: admin/admin123');
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log('Admin user already exists');
    } else {
      console.error('Error creating admin user:', error);
    }
  }
  
  await db.close();
  console.log('Mock data generation complete!');
}

if (require.main === module) {
  generateMockData().catch(console.error);
}

module.exports = { generateMockData };