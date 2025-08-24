/**
 * Simple SQLite Analytics Demo
 * Creates a working demo with mock data
 */

const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const session = require('express-session');

// Create database
const db = new sqlite3.Database('./analytics.db');

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create tables
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          domain TEXT NOT NULL,
          operation TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          response_time INTEGER,
          parameters TEXT,
          response_size INTEGER
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS errors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          domain TEXT NOT NULL,
          operation TEXT NOT NULL,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          stack_trace TEXT,
          parameters TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess TEXT NOT NULL,
          expire DATETIME NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Generate mock data
async function generateMockData() {
  console.log('Generating mock data...');
  
  const BCP_TOOLS = {
    Companies: ['create', 'get', 'update', 'search', 'recent'],
    Contacts: ['create', 'get', 'update', 'search', 'recent'],
    Deals: ['create', 'get', 'update', 'search', 'recent', 'batchCreate', 'batchUpdate'],
    Notes: ['createCompanyNote', 'createContactNote', 'createDealNote', 'get', 'update'],
    Properties: ['create', 'get', 'update', 'list'],
    Products: ['get', 'list', 'search'],
    Quotes: ['create', 'get', 'update', 'search'],
    Emails: ['create', 'get', 'update', 'list'],
    BlogPosts: ['create', 'get', 'update', 'list']
  };

  const domains = Object.keys(BCP_TOOLS);
  const errorTypes = ['ValidationError', 'AuthenticationError', 'RateLimitError', 'NotFoundError'];

  // Generate 500 tool calls
  for (let i = 0; i < 500; i++) {
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const operation = BCP_TOOLS[domain][Math.floor(Math.random() * BCP_TOOLS[domain].length)];
    const success = Math.random() > 0.2; // 80% success rate
    const responseTime = Math.floor(Math.random() * 2000) + 50;
    const responseSize = Math.floor(Math.random() * 5000) + 100;
    
    // Random timestamp within last 30 days
    const daysAgo = Math.random() * 30;
    const timestamp = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));

    await new Promise((resolve) => {
      db.run(
        'INSERT INTO tool_calls (timestamp, domain, operation, success, response_time, response_size) VALUES (?, ?, ?, ?, ?, ?)',
        [timestamp.toISOString(), domain, operation, success, responseTime, responseSize],
        resolve
      );
    });

    // Add error for failed calls
    if (!success) {
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const errorMessage = `${errorType}: Something went wrong with ${operation}`;
      
      await new Promise((resolve) => {
        db.run(
          'INSERT INTO errors (timestamp, domain, operation, error_type, error_message) VALUES (?, ?, ?, ?, ?)',
          [timestamp.toISOString(), domain, operation, errorType, errorMessage],
          resolve
        );
      });
    }

    if (i % 50 === 0) {
      console.log(`Generated ${i}/500 entries...`);
    }
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  await new Promise((resolve) => {
    db.run(
      'INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)',
      ['admin', passwordHash],
      resolve
    );
  });

  console.log('Mock data generated! Admin user: admin/admin123');
}

// Start Express server
async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

  app.use(session({
    secret: 'demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
  }));

  // Auth middleware
  function requireAuth(req, res, next) {
    if (req.session?.authenticated) {
      next();
    } else {
      res.status(401).json({ error: 'Authentication required' });
    }
  }

  // Login endpoint
  app.post('/api/auth', async (req, res) => {
    const { username, password, action } = req.body;

    if (action === 'logout') {
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ success: true });
      });
      return;
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.session.authenticated = true;
      req.session.username = username;
      res.json({ success: true, user: { username } });
    });
  });

  // Auth status
  app.get('/api/auth/status', (req, res) => {
    res.json({ 
      authenticated: !!req.session?.authenticated,
      user: req.session?.username ? { username: req.session.username } : null
    });
  });

  // Analytics data
  app.get('/api/analytics', requireAuth, (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get summary stats
    db.get(`
      SELECT 
        COUNT(*) as total_calls,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN success = 0 THEN 1 END) as total_errors
      FROM tool_calls WHERE timestamp >= ?
    `, [since], (err, summary) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      // Get tool usage
      db.all(`
        SELECT domain, operation, COUNT(*) as count, AVG(response_time) as avg_response_time
        FROM tool_calls 
        WHERE timestamp >= ?
        GROUP BY domain, operation
        ORDER BY count DESC
        LIMIT 20
      `, [since], (err, toolUsage) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        // Get daily stats
        db.all(`
          SELECT 
            DATE(timestamp) as date, 
            COUNT(*) as calls,
            AVG(response_time) as avg_response_time,
            COUNT(CASE WHEN success = 0 THEN 1 END) as errors
          FROM tool_calls 
          WHERE timestamp >= ?
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `, [since], (err, dailyStats) => {
          if (err) return res.status(500).json({ error: 'Database error' });

          // Get recent errors
          db.all(`
            SELECT domain, operation, error_type, error_message, COUNT(*) as count
            FROM errors 
            WHERE timestamp >= ?
            GROUP BY domain, operation, error_type, error_message
            ORDER BY count DESC
            LIMIT 10
          `, [since], (err, errors) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            res.json({
              summary: summary || { total_calls: 0, avg_response_time: 0, total_errors: 0 },
              usage: {
                totalCalls: summary?.total_calls || 0,
                errorRate: summary?.total_calls ? (summary.total_errors / summary.total_calls) * 100 : 0,
                toolUsage: toolUsage || [],
                dailyStats: dailyStats || []
              },
              errors: errors || [],
              period: `${days} days`
            });
          });
        });
      });
    });
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(3002, () => {
    console.log('🚀 Analytics API running on http://localhost:3002');
    console.log('Try: http://localhost:3002/health');
    console.log('Login with: admin / admin123');
  });
}

// Main execution
async function main() {
  try {
    console.log('Initializing SQLite database...');
    await initializeDatabase();
    
    console.log('Generating mock data...');
    await generateMockData();
    
    console.log('Starting server...');
    await startServer();
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}