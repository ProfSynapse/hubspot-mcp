/**
 * OAuth 2.1 Service for MCP Server
 * 
 * Implements OAuth 2.1 with Dynamic Client Registration (DCR) as required
 * by the MCP specification for HTTP Streamable transport
 */

import crypto from 'crypto';
import { Request, Response } from 'express';

interface OAuthClient {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope?: string;
  created_at: number;
  token_endpoint_auth_method: 'client_secret_post' | 'client_secret_basic' | 'none';
}

interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge?: string;
  code_challenge_method?: string;
  expires_at: number;
  user_id?: string;
}

interface AccessToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
  client_id: string;
  user_id?: string;
  created_at: number;
}

export class OAuthService {
  private clients = new Map<string, OAuthClient>();
  private authorizationCodes = new Map<string, AuthorizationCode>();
  private accessTokens = new Map<string, AccessToken>();
  private refreshTokens = new Map<string, string>(); // refresh_token -> access_token

  constructor(
    private issuer: string,
    private baseUrl: string
  ) {
    // Initialize pre-configured clients from environment variables
    this.initializePreConfiguredClients();
  }

  /**
   * Initialize pre-configured OAuth clients from environment variables
   * This allows Railway deployment with fixed client credentials
   */
  private initializePreConfiguredClients(): void {
    // Support multiple pre-configured clients
    const clientConfigs = [
      {
        clientIdEnv: 'OAUTH_CLIENT_ID',
        clientSecretEnv: 'OAUTH_CLIENT_SECRET',
        clientNameEnv: 'OAUTH_CLIENT_NAME'
      },
      {
        clientIdEnv: 'CLAUDE_CLIENT_ID',
        clientSecretEnv: 'CLAUDE_CLIENT_SECRET',
        clientNameEnv: 'CLAUDE_CLIENT_NAME'
      }
    ];

    clientConfigs.forEach(config => {
      const clientId = process.env[config.clientIdEnv];
      const clientSecret = process.env[config.clientSecretEnv];
      const clientName = process.env[config.clientNameEnv];

      if (clientId && clientSecret) {
        const client: OAuthClient = {
          client_id: clientId,
          client_secret: clientSecret,
          client_name: clientName || `Pre-configured Client (${clientId})`,
          redirect_uris: [
            `${this.baseUrl}/callback`,
            'http://localhost:3000/callback',
            'https://claude.ai/callback',
            'https://console.anthropic.com/callback'
          ],
          grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
          response_types: ['code'],
          scope: 'mcp:read mcp:write hubspot:read hubspot:write',
          created_at: Date.now(),
          token_endpoint_auth_method: 'client_secret_post'
        };

        this.clients.set(clientId, client);
        console.log(`✅ Pre-configured OAuth client: ${client.client_name} (${clientId})`);
      }
    });
  }

  // OAuth 2.0 Authorization Server Metadata (RFC8414)
  getServerMetadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.baseUrl}/authorize`,
      token_endpoint: `${this.baseUrl}/token`,
      registration_endpoint: `${this.baseUrl}/register`,
      jwks_uri: `${this.baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['mcp:read', 'mcp:write', 'hubspot:read', 'hubspot:write'],
      resource_indicators_supported: true,
      revocation_endpoint: `${this.baseUrl}/revoke`,
      introspection_endpoint: `${this.baseUrl}/introspect`
    };
  }

  // Dynamic Client Registration (RFC7591)
  async registerClient(registrationRequest: any): Promise<OAuthClient> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();

    const client: OAuthClient = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: registrationRequest.client_name || `MCP Client ${clientId}`,
      redirect_uris: registrationRequest.redirect_uris || [`${this.baseUrl}/callback`],
      grant_types: registrationRequest.grant_types || ['authorization_code', 'refresh_token'],
      response_types: registrationRequest.response_types || ['code'],
      scope: registrationRequest.scope || 'mcp:read mcp:write',
      created_at: Date.now(),
      token_endpoint_auth_method: registrationRequest.token_endpoint_auth_method || 'client_secret_post'
    };

    this.clients.set(clientId, client);

    return client;
  }

  // Authorization endpoint handler
  async authorize(req: Request, res: Response) {
    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      code_challenge,
      code_challenge_method
    } = req.query;

    // Validate client
    const client = this.clients.get(client_id as string);
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client not found'
      });
    }

    // Validate redirect URI
    if (!client.redirect_uris.includes(redirect_uri as string)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect URI'
      });
    }

    // For MCP servers, we can auto-approve the authorization
    // In production, you might want a user consent flow
    const authCode = this.generateAuthorizationCode();
    const code: AuthorizationCode = {
      code: authCode,
      client_id: client_id as string,
      redirect_uri: redirect_uri as string,
      scope: scope as string || 'mcp:read mcp:write',
      code_challenge: code_challenge as string,
      code_challenge_method: code_challenge_method as string,
      expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
      user_id: 'mcp-user' // For MCP, this could be a service user
    };

    this.authorizationCodes.set(authCode, code);

    // Redirect with authorization code
    const redirectUrl = new URL(redirect_uri as string);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state as string);
    }

    res.redirect(redirectUrl.toString());
  }

  // Token endpoint handler
  async token(req: Request, res: Response) {
    const { grant_type, client_id, client_secret, code, redirect_uri, code_verifier, refresh_token } = req.body;

    // Authenticate client
    const client = this.clients.get(client_id);
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    // Handle different client authentication methods
    if (client.token_endpoint_auth_method === 'client_secret_post') {
      if (!client_secret || client.client_secret !== client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Client secret required for client_secret_post authentication'
        });
      }
    } else if (client.token_endpoint_auth_method === 'client_secret_basic') {
      // Handle Basic authentication
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Basic ')) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Basic authentication required'
        });
      }
      
      const credentials = Buffer.from(auth.substring(6), 'base64').toString('utf-8');
      const [authClientId, authClientSecret] = credentials.split(':');
      
      if (authClientId !== client_id || authClientSecret !== client.client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
      }
    }
    // 'none' auth method doesn't require client secret validation

    if (grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(req, res, client, code, redirect_uri, code_verifier);
    } else if (grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(req, res, client, refresh_token);
    } else if (grant_type === 'client_credentials') {
      return this.handleClientCredentialsGrant(req, res, client);
    }

    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Grant type not supported'
    });
  }

  private async handleAuthorizationCodeGrant(req: Request, res: Response, client: OAuthClient, code: string, redirect_uri: string, code_verifier?: string) {
    const authCode = this.authorizationCodes.get(code);
    
    if (!authCode || authCode.expires_at < Date.now()) {
      this.authorizationCodes.delete(code);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid or expired'
      });
    }

    if (authCode.client_id !== client.client_id || authCode.redirect_uri !== redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code was issued to another client'
      });
    }

    // Verify PKCE if code challenge was provided
    if (authCode.code_challenge) {
      if (!code_verifier) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Code verifier required'
        });
      }

      const challenge = authCode.code_challenge_method === 'S256' 
        ? crypto.createHash('sha256').update(code_verifier).digest('base64url')
        : code_verifier;

      if (challenge !== authCode.code_challenge) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Code verifier does not match code challenge'
        });
      }
    }

    // Generate access token
    const accessToken = this.generateAccessToken();
    const refreshToken = this.generateRefreshToken();

    const token: AccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      refresh_token: refreshToken,
      scope: authCode.scope,
      client_id: client.client_id,
      user_id: authCode.user_id,
      created_at: Date.now()
    };

    this.accessTokens.set(accessToken, token);
    this.refreshTokens.set(refreshToken, accessToken);
    this.authorizationCodes.delete(code);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope
    });
  }

  private async handleRefreshTokenGrant(req: Request, res: Response, client: OAuthClient, refresh_token: string) {
    const accessTokenKey = this.refreshTokens.get(refresh_token);
    if (!accessTokenKey) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid'
      });
    }

    const oldToken = this.accessTokens.get(accessTokenKey);
    if (!oldToken || oldToken.client_id !== client.client_id) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid'
      });
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken();
    const newRefreshToken = this.generateRefreshToken();

    const token: AccessToken = {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: oldToken.scope,
      client_id: client.client_id,
      user_id: oldToken.user_id,
      created_at: Date.now()
    };

    // Clean up old tokens
    this.accessTokens.delete(accessTokenKey);
    this.refreshTokens.delete(refresh_token);

    // Store new tokens
    this.accessTokens.set(newAccessToken, token);
    this.refreshTokens.set(newRefreshToken, newAccessToken);

    res.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: token.scope
    });
  }

  private async handleClientCredentialsGrant(req: Request, res: Response, client: OAuthClient) {
    const accessToken = this.generateAccessToken();

    const token: AccessToken = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'mcp:read mcp:write hubspot:read hubspot:write',
      client_id: client.client_id,
      created_at: Date.now()
    };

    this.accessTokens.set(accessToken, token);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: token.scope
    });
  }

  // Validate access token
  validateAccessToken(token: string): AccessToken | null {
    const accessToken = this.accessTokens.get(token);
    
    if (!accessToken) {
      return null;
    }

    // Check if token is expired
    if (accessToken.created_at + (accessToken.expires_in * 1000) < Date.now()) {
      this.accessTokens.delete(token);
      return null;
    }

    return accessToken;
  }

  // Get client information
  getClient(clientId: string): OAuthClient | undefined {
    return this.clients.get(clientId);
  }

  private generateClientId(): string {
    return `mcp_${crypto.randomBytes(16).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateAuthorizationCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}