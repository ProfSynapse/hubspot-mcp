# Complete Railway Deployment Guide for HubSpot MCP Server

## Executive Summary

This comprehensive guide provides step-by-step instructions for deploying the HubSpot MCP server to Railway.app. The deployment process involves setting up a Railway project, configuring environment variables, creating HubSpot Private App credentials, and integrating with Claude Desktop. This guide ensures a secure, production-ready deployment with proper authentication and monitoring.

**Key Requirements:**
- Railway account with GitHub integration
- HubSpot account with Super Admin permissions
- Node.js 18+ compatible codebase
- JWT secret for authentication
- Claude Desktop for MCP integration

## Table of Contents

1. [Pre-Deployment Requirements](#pre-deployment-requirements)
2. [HubSpot Private App Setup](#hubspot-private-app-setup)
3. [JWT Secret Generation](#jwt-secret-generation)
4. [Railway Project Setup](#railway-project-setup)
5. [Environment Variables Configuration](#environment-variables-configuration)
6. [Deployment Process](#deployment-process)
7. [Testing and Validation](#testing-and-validation)
8. [Claude Desktop Integration](#claude-desktop-integration)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

## Pre-Deployment Requirements

### Railway Account Setup

1. **Create Railway Account**
   - Navigate to [railway.app](https://railway.app)
   - Click "Login" in the top toolbar
   - Select "GitHub" to authenticate using your GitHub credentials
   - Complete the account setup process

2. **Required Permissions**
   - GitHub repository access (for deployment)
   - Railway project creation permissions
   - Environment variable management access

### GitHub Repository Requirements

1. **Repository Structure**
   - Ensure your HubSpot MCP server code is in a GitHub repository
   - Verify the repository contains the correct branch (`railway-http-deployment` or `main`)
   - Confirm the following files exist:
     - `package.json` with proper start script
     - `railway.json` (optional but recommended)
     - `src/` directory with application code

2. **Package.json Verification**
   ```json
   {
     "name": "hubspot-mcp",
     "scripts": {
       "start": "node build/http-server.js",
       "build": "tsc"
     },
     "engines": {
       "node": ">=18.0.0"
     }
   }
   ```

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **TypeScript**: For compilation (if using TypeScript)
- **Internet Connection**: For Railway deployment and HubSpot API access

## HubSpot Private App Setup

### Step 1: Access HubSpot Developer Settings

1. **Navigate to Private Apps**
   - Log in to your HubSpot account
   - Click the Settings icon (⚙️) in the top-right corner
   - In the left sidebar menu, go to **Integrations → Private Apps**
   - Click **Create private app**

2. **Verify Permissions**
   - Ensure you have Super Admin permissions in HubSpot
   - Private Apps creation requires Super Admin access

### Step 2: Configure Basic App Information

1. **Basic Info Tab**
   - Enter your app **Name**: "MCP Server Integration" (or preferred name)
   - Upload a **Logo** (optional): Square image, recommended 256x256px
   - Enter **Description**: "Model Context Protocol server for HubSpot CRM integration"

2. **App Purpose**
   - Select appropriate use case for your integration
   - Add any additional notes for internal reference

### Step 3: Configure API Scopes and Permissions

1. **Navigate to Scopes Tab**
   - Click the **Scopes** tab in the app creation interface
   - The "Create app" button will be disabled until scopes are added

2. **Required Scopes for MCP Server**
   
   **CRM Object Permissions:**
   - `crm.objects.companies.read` - Read company data
   - `crm.objects.companies.write` - Create and update companies
   - `crm.objects.contacts.read` - Read contact data
   - `crm.objects.contacts.write` - Create and update contacts
   - `crm.objects.deals.read` - Read deal data
   - `crm.objects.deals.write` - Create and update deals
   - `crm.objects.notes.read` - Read engagement notes
   - `crm.objects.notes.write` - Create and update notes
   - `crm.objects.emails.read` - Read email engagements
   - `crm.objects.emails.write` - Create and update emails
   
   **Additional Permissions:**
   - `crm.schemas.companies.read` - Read company properties
   - `crm.schemas.contacts.read` - Read contact properties
   - `crm.schemas.deals.read` - Read deal properties
   - `crm.objects.quotes.read` - Read quote data
   - `crm.objects.quotes.write` - Create and update quotes
   - `content.read` - Read blog content (if using BlogPosts BCP)
   - `content.write` - Create and update blog content

3. **Select Appropriate Scopes**
   - Check each required scope in the interface
   - Review permissions carefully - follow principle of least privilege
   - Consider future feature requirements when selecting scopes

### Step 4: Create and Obtain Access Token

1. **Create the App**
   - Click **Create app** button (top-right corner)
   - Review the app information in the modal
   - Click **Continue creating** to finalize

2. **Access Token Generation**
   - Once created, navigate to the **Access token** section
   - Click **Show token** to reveal the access token
   - **Important**: Copy the token immediately and store securely

3. **Token Security**
   - The access token does not expire automatically
   - Store the token in a secure location (password manager recommended)
   - Never commit the token to version control

### Step 5: Token Management Best Practices

1. **Token Rotation**
   - Use the **Rotate** button if the token is compromised
   - Update all systems using the token immediately after rotation
   - Original token expires when new one is generated

2. **Access Monitoring**
   - Monitor API call logs in HubSpot for unusual activity
   - Each Private App provides separate logging for better tracking
   - Review access patterns regularly

## JWT Secret Generation

### Understanding JWT Secret Requirements

JWT (JSON Web Token) secrets are used for signing and verifying authentication tokens in the MCP server. A secure secret is critical for preventing token forgery and ensuring API security.

### Security Requirements

1. **Length**: Minimum 32 characters (256 bits recommended)
2. **Randomness**: Cryptographically secure random generation
3. **Uniqueness**: Unique per application/environment
4. **Storage**: Secure environment variable storage

### Generating Secure JWT Secret

#### Method 1: Node.js Crypto Module

1. **Open Terminal/Command Prompt**

2. **Generate Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Example Output**
   ```
   e3ff5f077839c1331b1d893a728246685cb7dba9e3a77bffe7d52eaccf660988
   ```

#### Method 2: Online Generator (Use with Caution)

1. **Secure Online Generator**
   - Use only reputable sources
   - Generate locally when possible
   - Never use predictable patterns

2. **Manual Verification**
   ```javascript
   // Verify secret length and randomness
   const secret = "your_generated_secret_here";
   console.log("Length:", secret.length); // Should be >= 32
   console.log("Entropy:", secret); // Should appear random
   ```

### JWT Implementation Best Practices

1. **Algorithm Selection**
   - Use HS256 (HMAC with SHA-256) for symmetric signing
   - Consider RS256 (RSA with SHA-256) for asymmetric signing in enterprise environments

2. **Token Expiration**
   - Set appropriate expiration times (30-60 minutes recommended)
   - Implement refresh token mechanism for longer sessions
   - Balance security with user experience

3. **Secret Rotation**
   - Plan for periodic secret rotation
   - Implement graceful rollover procedures
   - Update all dependent systems simultaneously

## Railway Project Setup

### Step 1: Create New Railway Project

1. **Access Railway Dashboard**
   - Log in to [railway.app](https://railway.app)
   - Click **Dashboard** from the top menu
   - Select **New Project** button

2. **Project Creation Options**
   - Choose **Deploy from GitHub repo** (recommended)
   - Alternative: Use template or CLI deployment

### Step 2: GitHub Repository Connection

1. **Repository Selection**
   - Railway displays list of available repositories
   - Select your HubSpot MCP server repository
   - Ensure correct branch is selected (`railway-http-deployment` or `main`)

2. **GitHub Permissions**
   - Grant Railway access to the selected repository
   - Configure webhook permissions for automatic deployments
   - Verify repository visibility settings

3. **Branch Configuration**
   - Select deployment branch
   - Configure automatic deployment triggers
   - Set up production vs staging branch mapping

### Step 3: Project Configuration

1. **Project Naming**
   - Choose descriptive project name: "hubspot-mcp-server"
   - Add project description for team reference
   - Configure project tags for organization

2. **Service Configuration**
   - Railway auto-detects Node.js application
   - Verify service name and configuration
   - Review auto-generated settings

### Step 4: Railway Configuration File

1. **railway.json Verification**
   
   Your project should include a `railway.json` file:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "npm run build",
       "watchPatterns": [
         "src/**",
         "package.json",
         "tsconfig.json"
       ]
     },
     "deploy": {
       "startCommand": "npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10,
       "healthcheckPath": "/health",
       "healthcheckTimeout": 30,
       "healthcheckInterval": 60
     }
   }
   ```

2. **Configuration Benefits**
   - Explicit build and deploy commands
   - Health check configuration
   - Restart policy management
   - File watch patterns for rebuilds

## Environment Variables Configuration

### Step 1: Access Environment Variables

1. **Navigate to Variables Tab**
   - In your Railway project dashboard
   - Select your service
   - Click the **Variables** tab

2. **Variable Management Interface**
   - Add new variables with **Add Variable** button
   - Use **Raw Editor** for bulk operations
   - Enable **Sealed Variables** for sensitive data

### Step 2: Required Environment Variables

#### Core Application Variables

1. **NODE_ENV**
   - **Value**: `production`
   - **Description**: Sets application environment mode
   - **Required**: Yes

2. **PORT**
   - **Value**: `3000` (Railway auto-assigns if not set)
   - **Description**: Application port number
   - **Required**: Optional (Railway provides default)

3. **HOST**
   - **Value**: `0.0.0.0`
   - **Description**: Host binding for Railway networking
   - **Required**: Yes

#### Authentication Variables

4. **HUBSPOT_ACCESS_TOKEN** (Sealed Variable)
   - **Value**: Your HubSpot Private App access token
   - **Description**: API authentication for HubSpot
   - **Required**: Yes
   - **Security**: Enable "Sealed" option

5. **JWT_SECRET** (Sealed Variable)
   - **Value**: Your generated JWT secret (32+ characters)
   - **Description**: JWT signing secret for authentication
   - **Required**: Yes
   - **Security**: Enable "Sealed" option

#### HubSpot Configuration

6. **HUBSPOT_API_BASE_URL**
   - **Value**: `https://api.hubapi.com`
   - **Description**: HubSpot API endpoint
   - **Required**: Yes

7. **HUBSPOT_RATE_LIMIT**
   - **Value**: `10`
   - **Description**: API rate limit (requests per second)
   - **Required**: Optional

#### Security Configuration

8. **CORS_ORIGIN**
   - **Value**: `https://claude.ai,https://console.anthropic.com`
   - **Description**: Allowed CORS origins
   - **Required**: Yes

9. **RATE_LIMIT_WINDOW_MS**
   - **Value**: `900000` (15 minutes)
   - **Description**: Rate limiting window
   - **Required**: Optional

10. **RATE_LIMIT_MAX**
    - **Value**: `1000`
    - **Description**: Maximum requests per window
    - **Required**: Optional

#### Session Management

11. **SESSION_MAX_AGE**
    - **Value**: `1800000` (30 minutes)
    - **Description**: Session timeout
    - **Required**: Optional

12. **SESSION_CLEANUP_INTERVAL**
    - **Value**: `300000` (5 minutes)
    - **Description**: Session cleanup frequency
    - **Required**: Optional

#### Monitoring Configuration

13. **LOG_LEVEL**
    - **Value**: `info`
    - **Description**: Application logging level
    - **Required**: Optional

14. **METRICS_ENABLED**
    - **Value**: `true`
    - **Description**: Enable application metrics
    - **Required**: Optional

15. **HEALTH_CHECK_ENABLED**
    - **Value**: `true`
    - **Description**: Enable health check endpoint
    - **Required**: Optional

### Step 3: Variable Validation

1. **Configuration Validation**
   
   Create a validation checklist:
   ```
   ✅ HUBSPOT_ACCESS_TOKEN (sealed, 40+ characters)
   ✅ JWT_SECRET (sealed, 32+ characters)
   ✅ NODE_ENV = production
   ✅ CORS_ORIGIN (proper domains listed)
   ✅ All required variables present
   ```

2. **Environment Testing**
   - Test variable accessibility in deployment
   - Verify sealed variables are properly encrypted
   - Confirm no variables are missing

## Deployment Process

### Step 1: Trigger Initial Deployment

1. **Automatic Deployment**
   - Railway automatically triggers deployment upon GitHub connection
   - Monitor deployment progress in Railway dashboard
   - View real-time build logs

2. **Manual Deployment**
   - Click **Deploy** button in Railway dashboard
   - Select specific commit or branch
   - Monitor deployment progress

### Step 2: Build Process Monitoring

1. **Build Logs**
   - Access via **Deployments** tab
   - Monitor for build errors or warnings
   - Verify all dependencies install correctly

2. **Common Build Issues**
   - Missing environment variables
   - TypeScript compilation errors
   - Node.js version compatibility
   - Dependency conflicts

### Step 3: Deployment Verification

1. **Service Status**
   - Verify service shows "Active" status
   - Check deployment success indicators
   - Review resource utilization

2. **Log Monitoring**
   - Monitor application startup logs
   - Verify environment variable loading
   - Check for runtime errors

### Step 4: Domain Configuration

1. **Generate Public Domain**
   - Navigate to **Settings** → **Networking**
   - Click **Generate Domain**
   - Note the generated URL for testing

2. **Custom Domain** (Optional)
   - Add custom domain in Railway settings
   - Configure DNS records
   - Enable HTTPS certificate

## Testing and Validation

### Step 1: Health Check Verification

1. **Health Endpoint Test**
   ```bash
   curl https://your-app-name.railway.app/health
   ```

2. **Expected Response**
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-01-XX",
     "uptime": 120.5,
     "version": "0.1.0",
     "environment": "production"
   }
   ```

### Step 2: HubSpot API Connectivity

1. **API Connection Test**
   - Verify HubSpot access token validity
   - Test basic API endpoints
   - Confirm proper authentication

2. **Error Scenarios**
   ```
   Common Issues:
   - 401 Unauthorized: Invalid access token
   - 403 Forbidden: Insufficient scopes
   - 429 Too Many Requests: Rate limit exceeded
   - 500 Server Error: Application issues
   ```

### Step 3: MCP Protocol Validation

1. **MCP Endpoint Testing**
   ```bash
   curl -X POST https://your-app-name.railway.app/mcp \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
   ```

2. **Expected MCP Response**
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "tools": [
         {
           "name": "hubspotCompany",
           "description": "Manage HubSpot companies"
         }
       ]
     }
   }
   ```

### Step 4: End-to-End Testing

1. **Authentication Flow**
   - Test JWT token generation
   - Verify token validation
   - Confirm session management

2. **CRM Operations**
   - Test company creation/retrieval
   - Test contact management
   - Test deal operations
   - Verify all BCP functionalities

### Step 5: Performance Testing

1. **Load Testing** (Optional)
   ```bash
   # Use tools like Apache Bench
   ab -n 100 -c 10 https://your-app-name.railway.app/health
   ```

2. **Response Time Validation**
   - Health check: < 200ms
   - HubSpot API calls: < 2000ms
   - MCP protocol responses: < 1000ms

## Claude Desktop Integration

### Step 1: Access Claude Desktop Configuration

1. **Open Claude Desktop**
   - Launch Claude Desktop application
   - Navigate to Settings (usually lower corner)
   - Select the **Developer** tab

2. **Configuration File Access**
   - Click **Edit Config** button
   - This opens `claude_desktop_config.json`
   - Create file if it doesn't exist

### Step 2: Configure MCP Server Connection

1. **Basic HTTP Configuration**
   
   Add your deployed Railway server to the configuration:
   ```json
   {
     "mcpServers": {
       "hubspot-mcp": {
         "type": "sse",
         "url": "https://your-app-name.railway.app/mcp",
         "headers": {
           "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
         },
         "timeout": 30000
       }
     }
   }
   ```

2. **Environment Variable Configuration**
   
   For better security, use environment variables:
   ```json
   {
     "mcpServers": {
       "hubspot-mcp": {
         "type": "sse", 
         "url": "${HUBSPOT_MCP_URL:-https://your-app-name.railway.app/mcp}",
         "headers": {
           "Authorization": "Bearer ${HUBSPOT_MCP_TOKEN}"
         },
         "timeout": 30000,
         "retry": {
           "maxAttempts": 3,
           "backoffMs": 1000
         }
       }
     }
   }
   ```

### Step 3: Authentication Setup

1. **JWT Token Generation**
   
   Generate a JWT token for Claude Desktop access:
   ```bash
   # Using curl to get a token (implement in your server)
   curl -X POST https://your-app-name.railway.app/auth/token \
     -H "Content-Type: application/json" \
     -d '{"client_id": "claude-desktop"}'
   ```

2. **Token Storage**
   - Store JWT token securely
   - Use Claude Desktop's encrypted storage when possible
   - Consider token expiration and refresh mechanisms

### Step 4: Configuration Validation

1. **JSON Validation**
   - Verify JSON syntax is correct
   - No trailing commas
   - Proper quote usage
   - Valid URL format

2. **Common Configuration Errors**
   ```
   ❌ Trailing commas in JSON
   ❌ Invalid URL format
   ❌ Missing authentication headers
   ❌ Incorrect server type specification
   ❌ Network connectivity issues
   ```

### Step 5: Enable Developer Mode

1. **Developer Settings**
   - In Claude Desktop settings
   - Navigate to Developer tab
   - Toggle on **Developer Mode**
   - This enables detailed logging and error messages

2. **Log Access**
   - View MCP server connection logs
   - Monitor authentication attempts
   - Debug configuration issues

### Step 6: Restart and Verification

1. **Restart Claude Desktop**
   - Save `claude_desktop_config.json`
   - Completely quit Claude Desktop
   - Restart the application

2. **Connection Verification**
   - Look for MCP server indicator in Claude Desktop
   - Indicator appears in bottom-right of input box
   - Verify server status shows as connected

3. **Functionality Testing**
   - Test MCP tools are available
   - Try basic HubSpot operations
   - Verify authentication is working

### Step 7: Advanced Configuration Options

1. **Multiple Environment Support**
   ```json
   {
     "mcpServers": {
       "hubspot-mcp-prod": {
         "type": "sse",
         "url": "https://prod-server.railway.app/mcp",
         "headers": {
           "Authorization": "Bearer ${PROD_MCP_TOKEN}"
         }
       },
       "hubspot-mcp-staging": {
         "type": "sse",
         "url": "https://staging-server.railway.app/mcp",
         "headers": {
           "Authorization": "Bearer ${STAGING_MCP_TOKEN}"
         }
       }
     }
   }
   ```

2. **Connection Tuning**
   ```json
   {
     "mcpServers": {
       "hubspot-mcp": {
         "type": "sse",
         "url": "https://your-app-name.railway.app/mcp",
         "headers": {
           "Authorization": "Bearer YOUR_JWT_TOKEN"
         },
         "timeout": 30000,
         "keepAlive": true,
         "retry": {
           "maxAttempts": 5,
           "backoffMs": 2000,
           "maxBackoffMs": 10000
         }
       }
     }
   }
   ```

## Troubleshooting

### Common Deployment Issues

#### 1. Build Failures

**Symptoms:**
- Deployment fails during build phase
- TypeScript compilation errors
- Missing dependencies

**Solutions:**
```bash
# Check package.json scripts
{
  "scripts": {
    "build": "tsc",
    "start": "node build/http-server.js"
  }
}

# Verify tsconfig.json exists and is valid
# Check for proper dependency versions in package.json
# Review build logs for specific error messages
```

#### 2. Environment Variable Issues

**Symptoms:**
- Application fails to start
- Authentication errors
- Configuration validation failures

**Solutions:**
```bash
# Verify all required variables are set
# Check sealed variables are properly encrypted
# Validate variable names match application code
# Test variable accessibility in Railway logs
```

#### 3. Health Check Failures

**Symptoms:**
- Railway shows service as unhealthy
- Deployment succeeds but health checks fail
- Service restarts continuously

**Solutions:**
```bash
# Verify health check endpoint exists at /health
# Check health check timeout settings
# Review application logs for startup errors
# Validate port binding (0.0.0.0:3000)
```

#### 4. HubSpot API Connectivity

**Symptoms:**
- 401 Authentication errors
- 403 Permission denied
- 429 Rate limit exceeded

**Solutions:**
```bash
# Verify HubSpot access token validity
# Check Private App scopes match requirements
# Implement proper rate limiting
# Review HubSpot API logs
```

### Claude Desktop Connection Issues

#### 1. Configuration Problems

**Symptoms:**
- Claude Desktop doesn't show MCP server indicator
- Connection timeouts
- Authentication failures

**Solutions:**
```json
// Verify JSON syntax
// Check URL format: https://your-app.railway.app/mcp
// Validate JWT token format and expiration
// Ensure proper headers configuration
```

#### 2. Network Issues

**Symptoms:**
- Intermittent connectivity
- Slow response times
- Connection drops

**Solutions:**
```bash
# Check Railway service status
# Verify internet connectivity
# Review Claude Desktop logs
# Test MCP endpoint manually with curl
```

### Debugging Tools and Commands

#### 1. Railway CLI Debugging

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# View logs
railway logs

# Check service status
railway status

# Environment variable debugging
railway variables
```

#### 2. Health Check Commands

```bash
# Test health endpoint
curl -I https://your-app-name.railway.app/health

# Test MCP endpoint
curl -X POST https://your-app-name.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Test HubSpot connectivity
curl -X GET "https://api.hubapi.com/crm/v3/objects/companies" \
  -H "Authorization: Bearer YOUR_HUBSPOT_TOKEN"
```

#### 3. Log Analysis

```bash
# Railway deployment logs
# Look for:
# - Build completion messages
# - Environment variable loading
# - Server startup confirmation
# - Error stack traces

# Common error patterns:
# - "EADDRINUSE": Port already in use
# - "ECONNREFUSED": Cannot connect to external service
# - "ENOTFOUND": DNS resolution failures
# - "ETIMEDOUT": Network timeout issues
```

### Recovery Procedures

#### 1. Rollback Deployment

```bash
# Using Railway dashboard
# Navigate to Deployments tab
# Select previous successful deployment
# Click "Redeploy"

# Using Railway CLI
railway redeploy [deployment-id]
```

#### 2. Environment Reset

```bash
# Backup current variables
railway variables > backup.env

# Reset problematic variables
# Update through Railway dashboard or CLI

# Restart service
railway service restart
```

#### 3. Complete Service Reset

```bash
# Delete and recreate service (last resort)
# Backup all configuration first
# Document current settings
# Create new service with same configuration
```

## Security Best Practices

### Authentication Security

1. **JWT Token Management**
   ```javascript
   // Strong secrets (32+ characters)
   const jwtSecret = process.env.JWT_SECRET;
   
   // Appropriate expiration times
   const tokenExpiry = '30m'; // 30 minutes
   
   // Secure algorithm selection
   const algorithm = 'HS256';
   ```

2. **Token Rotation Schedule**
   - JWT secrets: Rotate quarterly
   - HubSpot tokens: Rotate on compromise or annually
   - Document rotation procedures
   - Test rotation process regularly

### Environment Variable Security

1. **Sealed Variables**
   - Mark all sensitive variables as "sealed"
   - Use Railway's encrypted storage
   - Never log sensitive values

2. **Access Control**
   ```bash
   # Production variables should be:
   # - Sealed/encrypted
   # - Limited access
   # - Audit logged
   # - Regularly rotated
   ```

### Network Security

1. **CORS Configuration**
   ```javascript
   const corsOptions = {
     origin: [
       'https://claude.ai',
       'https://console.anthropic.com'
     ],
     credentials: true,
     optionsSuccessStatus: 200
   };
   ```

2. **Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
     message: 'Too many requests from this IP'
   });
   ```

### API Security

1. **Input Validation**
   ```javascript
   // Validate all incoming requests
   // Sanitize user input
   // Use schema validation (Zod, Joi)
   // Implement proper error handling
   ```

2. **Logging and Monitoring**
   ```javascript
   // Log security events
   // Monitor for unusual patterns
   // Set up alerts for failures
   // Regular security audits
   ```

### Compliance Considerations

1. **Data Protection**
   - Follow GDPR requirements if applicable
   - Implement data retention policies
   - Secure data transmission (HTTPS only)
   - Regular security assessments

2. **Audit Trail**
   - Log all API access attempts
   - Monitor authentication failures
   - Track data access patterns
   - Maintain security logs

## Validation Checklist

### Pre-Deployment Checklist

- [ ] Railway account created and GitHub connected
- [ ] HubSpot Private App created with proper scopes
- [ ] JWT secret generated (32+ characters)
- [ ] All environment variables documented
- [ ] Railway.json configuration file present
- [ ] Package.json scripts verified (build/start)
- [ ] Health check endpoint implemented

### Deployment Checklist

- [ ] GitHub repository connected to Railway
- [ ] Environment variables configured and sealed
- [ ] Initial deployment successful
- [ ] Build logs reviewed for errors
- [ ] Service status shows "Active"
- [ ] Public domain generated
- [ ] Health check endpoint responds correctly

### Post-Deployment Checklist

- [ ] Health check returns 200 OK
- [ ] MCP endpoint responds to tool list request
- [ ] HubSpot API connectivity verified
- [ ] JWT authentication working
- [ ] All BCP tools accessible
- [ ] Error handling tested
- [ ] Logging and monitoring configured

### Claude Desktop Integration Checklist

- [ ] Configuration file created/updated
- [ ] JSON syntax validated
- [ ] MCP server URL correct
- [ ] Authentication headers configured
- [ ] Claude Desktop restarted
- [ ] MCP server indicator visible
- [ ] Tools available in Claude Desktop
- [ ] End-to-end functionality tested

### Security Checklist

- [ ] All sensitive variables sealed
- [ ] CORS origins properly configured
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] Error messages don't leak sensitive data
- [ ] Audit logging configured
- [ ] Token rotation procedures documented
- [ ] Security monitoring alerts set up

---

## Conclusion

This comprehensive guide provides everything needed to successfully deploy the HubSpot MCP server to Railway. Following these steps ensures a secure, production-ready deployment with proper monitoring and integration with Claude Desktop.

**Key Success Factors:**
- Thorough preparation and requirement verification
- Proper environment variable configuration
- Comprehensive testing at each stage
- Security-first approach throughout deployment
- Regular monitoring and maintenance procedures

For additional support, refer to:
- [Railway Documentation](https://docs.railway.com)
- [HubSpot Developer Documentation](https://developers.hubspot.com)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Claude Desktop Help Center](https://support.anthropic.com)

**Support Contact:**
For deployment issues or questions, consult the project documentation or contact the development team with specific error messages and deployment logs.