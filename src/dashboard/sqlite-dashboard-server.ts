/**
 * SQLite Dashboard Server
 * Express server for analytics dashboard using SQLite for local development
 */

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { getSQLiteDatabase } from '../analytics/sqlite-database.js';
import { SQLiteAnalyticsService } from '../analytics/sqlite-analytics-service.js';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// SQLite session store (simple in-memory for development)
class SQLiteSessionStore extends session.Store {
  private db = getSQLiteDatabase();

  async get(sid: string, callback: (err?: any, session?: any) => void) {
    try {
      const rows = await this.db.query('SELECT sess FROM sessions WHERE sid = ? AND expire > ?', [sid, new Date().toISOString()]);
      const session = rows.length > 0 ? JSON.parse(rows[0].sess) : null;
      callback(null, session);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback?: (err?: any) => void) {
    try {
      const expire = new Date(Date.now() + (session.cookie.maxAge || 24 * 60 * 60 * 1000));
      await this.db.run(
        'INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)',
        [sid, JSON.stringify(session), expire.toISOString()]
      );
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await this.db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}

// Initialize services
const analyticsService = new SQLiteAnalyticsService();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(session({
  store: new SQLiteSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  if ((req.session as any)?.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Routes

// Login
app.post('/api/auth', async (req, res) => {
  try {
    const { username, password, action } = req.body;

    if (action === 'logout') {
      req.session.destroy((err: any) => {
        if (err) {
          return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
      });
      return;
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = getSQLiteDatabase();
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    (req.session as any).authenticated = true;
    (req.session as any).username = username;

    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { username }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  if ((req.session as any)?.authenticated) {
    res.json({ 
      authenticated: true, 
      user: { username: (req.session as any).username }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Analytics data
app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const [usageStats, errorStats, summaryStats] = await Promise.all([
      analyticsService.getUsageStats(days),
      analyticsService.getErrorStats(days),
      analyticsService.getSummaryStats()
    ]);

    res.json({
      usage: usageStats,
      errors: errorStats,
      summary: summaryStats,
      period: `${days} days`
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    console.log('Initializing SQLite analytics service...');
    await analyticsService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 SQLite Analytics Dashboard Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app, startServer };