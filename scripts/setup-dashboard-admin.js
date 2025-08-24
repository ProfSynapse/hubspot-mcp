#!/usr/bin/env node

/**
 * Dashboard Admin User Setup Script
 * Location: scripts/setup-dashboard-admin.js
 * 
 * This script creates an initial admin user for the analytics dashboard.
 * It can be run after database setup to ensure there's at least one user
 * who can access the dashboard. It includes password validation and
 * secure password hashing using bcrypt.
 * 
 * Usage:
 *   node scripts/setup-dashboard-admin.js
 *   node scripts/setup-dashboard-admin.js --username=admin --password=secure123
 *   npm run setup-dashboard-admin
 */

const readline = require('readline');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuration
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Database connection
let pool;

function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Set DATABASE_URL to your PostgreSQL connection string');
    process.exit(1);
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  return pool;
}

// Input validation functions
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  
  if (username.length < 3 || username.length > 50) {
    return 'Username must be between 3 and 50 characters';
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`;
  }
  
  // Check for at least one uppercase, lowercase, number, and special character
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return 'Password must contain at least one uppercase letter, lowercase letter, number, and special character';
  }
  
  return null;
}

// Generate a secure random password
function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Database operations
async function checkUserExists(username) {
  try {
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database error checking user:', error);
    throw error;
  }
}

async function createUser(username, password) {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Database error creating user:', error);
    throw error;
  }
}

async function getUserCount() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Database error counting users:', error);
    throw error;
  }
}

// Interactive input functions
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function askPassword(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Main setup functions
async function interactiveSetup() {
  const rl = createReadlineInterface();
  
  try {
    console.log('\n🔐 HubSpot MCP Dashboard - Admin User Setup');
    console.log('==========================================\n');

    // Check existing users
    const userCount = await getUserCount();
    
    if (userCount > 0) {
      console.log(`ℹ️  Found ${userCount} existing user(s) in the database`);
      
      const proceed = await askQuestion(rl, 'Do you want to create another admin user? (y/N): ');
      if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        return;
      }
    }

    // Get username
    let username;
    while (true) {
      username = await askQuestion(rl, 'Enter admin username: ');
      
      const usernameError = validateUsername(username);
      if (usernameError) {
        console.log(`❌ ${usernameError}`);
        continue;
      }
      
      const userExists = await checkUserExists(username);
      if (userExists) {
        console.log(`❌ User '${username}' already exists`);
        continue;
      }
      
      break;
    }

    // Ask about password generation
    const generatePassword = await askQuestion(rl, 'Generate a secure password automatically? (Y/n): ');
    let password;

    if (generatePassword.toLowerCase() === 'n' || generatePassword.toLowerCase() === 'no') {
      // Manual password entry
      while (true) {
        password = await askPassword(rl, 'Enter admin password: ');
        
        const passwordError = validatePassword(password);
        if (passwordError) {
          console.log(`❌ ${passwordError}`);
          continue;
        }
        
        const confirmPassword = await askPassword(rl, 'Confirm admin password: ');
        if (password !== confirmPassword) {
          console.log('❌ Passwords do not match');
          continue;
        }
        
        break;
      }
    } else {
      // Generate secure password
      password = generateSecurePassword(16);
      console.log(`\n🔑 Generated secure password: ${password}`);
      console.log('⚠️  IMPORTANT: Save this password securely - it won\'t be shown again!\n');
    }

    // Confirm creation
    console.log(`\nCreating admin user:`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${generatePassword.toLowerCase() !== 'n' ? '[Generated securely]' : '[Entered manually]'}`);
    
    const confirm = await askQuestion(rl, '\nProceed with user creation? (Y/n): ');
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log('Setup cancelled.');
      return;
    }

    // Create the user
    console.log('\n⏳ Creating admin user...');
    const newUser = await createUser(username, password);
    
    console.log('✅ Admin user created successfully!');
    console.log(`   User ID: ${newUser.id}`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Created: ${newUser.created_at}`);
    
    if (generatePassword.toLowerCase() !== 'n' && generatePassword.toLowerCase() !== 'no') {
      console.log(`\n🔑 Password: ${password}`);
      console.log('⚠️  SAVE THIS PASSWORD - it won\'t be displayed again!');
    }

    console.log('\n🎉 Setup complete! You can now log in to the dashboard.');

  } finally {
    rl.close();
  }
}

async function scriptedSetup(username, password) {
  console.log('\n🔐 HubSpot MCP Dashboard - Admin User Setup (Scripted)');
  console.log('===================================================\n');

  // Validate inputs
  const usernameError = validateUsername(username);
  if (usernameError) {
    console.error(`❌ ${usernameError}`);
    process.exit(1);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(`❌ ${passwordError}`);
    process.exit(1);
  }

  // Check if user exists
  const userExists = await checkUserExists(username);
  if (userExists) {
    console.error(`❌ User '${username}' already exists`);
    process.exit(1);
  }

  // Create user
  console.log(`⏳ Creating admin user: ${username}`);
  const newUser = await createUser(username, password);
  
  console.log('✅ Admin user created successfully!');
  console.log(`   User ID: ${newUser.id}`);
  console.log(`   Username: ${newUser.username}`);
  console.log(`   Created: ${newUser.created_at}`);
  console.log('\n🎉 Setup complete!');
}

// Main execution
async function main() {
  try {
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    initializeDatabase();
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection established');

    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ Users table does not exist');
      console.error('   Please run database migrations first:');
      console.error('   npm run setup-analytics');
      process.exit(1);
    }

    // Parse command line arguments
    const args = process.argv.slice(2);
    const usernameArg = args.find(arg => arg.startsWith('--username='));
    const passwordArg = args.find(arg => arg.startsWith('--password='));

    if (usernameArg && passwordArg) {
      // Scripted setup
      const username = usernameArg.split('=')[1];
      const password = passwordArg.split('=')[1];
      await scriptedSetup(username, password);
    } else if (usernameArg || passwordArg) {
      console.error('❌ Both --username and --password must be provided for scripted setup');
      process.exit(1);
    } else {
      // Interactive setup
      await interactiveSetup();
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Database connection refused. Check your DATABASE_URL and ensure PostgreSQL is running.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   Database host not found. Check your DATABASE_URL.');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Setup interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Setup terminated');
  process.exit(1);
});

// Run the setup
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, createUser, validateUsername, validatePassword };