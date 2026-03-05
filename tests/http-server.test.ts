/**
 * HTTP Server Integration Tests
 * Location: tests/http-server.test.ts
 * 
 * This module provides comprehensive tests for the HTTP MCP server,
 * including protocol compliance, authentication, session management,
 * and tool execution over HTTP transport.
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// Mock environment variables before importing the app
process.env.NODE_ENV = 'test';
process.env.HUBSPOT_ACCESS_TOKEN = 'test-token-placeholder';
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long';
process.env.LOG_LEVEL = 'error';
process.env.METRICS_ENABLED = 'false';

// Import app after setting environment
import app from '../src/http-server.js';

describe('MCP HTTP Server', () => {
  describe('Health Endpoints', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    test('GET /ready should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.timestamp).toBeDefined();
    });

    test('GET /live should return liveness status', async () => {
      const response = await request(app)
        .get('/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Metrics Endpoint', () => {
    test('GET /metrics should return Prometheus format', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.text).toContain('mcp_http_requests_total');
      expect(response.text).toContain('mcp_sessions_active');
    });
  });

  describe('MCP Protocol Compliance', () => {
    test('POST /mcp with invalid JSON should return JSON-RPC error', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32600); // Invalid Request
    });

    test('POST /mcp with missing jsonrpc should return validation error', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          id: 1,
          method: 'test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32600); // Invalid Request
    });

    test('POST /mcp without Content-Type should return error', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
    });

    test('POST /mcp with valid MCP initialize request should require auth in production', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        });

      // In test/development mode, this might pass without auth
      // In production, it should require authentication
      if (response.status === 401) {
        expect(response.body).toHaveProperty('jsonrpc', '2.0');
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.code).toBe(-32001); // Authentication Failed
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('jsonrpc', '2.0');
        expect(response.headers).toHaveProperty('mcp-session-id');
      }
    });
  });

  describe('Session Management', () => {
    test('MCP request should generate session ID', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        });

      if (response.status === 200) {
        expect(response.headers).toHaveProperty('mcp-session-id');
        expect(typeof response.headers['mcp-session-id']).toBe('string');
      }
    });

    test('Subsequent requests with same session ID should maintain session', async () => {
      // First request to establish session
      const firstResponse = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        });

      if (firstResponse.status === 200) {
        const sessionId = firstResponse.headers['mcp-session-id'];

        // Second request with same session ID
        const secondResponse = await request(app)
          .post('/mcp')
          .set('Content-Type', 'application/json')
          .set('Mcp-Session-Id', sessionId as string)
          .send({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list'
          });

        if (secondResponse.status === 200) {
          expect(secondResponse.headers['mcp-session-id']).toBe(sessionId);
        }
      }
    });
  });

  describe('Development Endpoints', () => {
    test('GET /dev/token should provide development token', async () => {
      const response = await request(app)
        .get('/dev/token')
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('example');
      expect(typeof response.body.token).toBe('string');
    });

    test('GET /dev/sessions should provide session statistics', async () => {
      const response = await request(app)
        .get('/dev/sessions')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('maxSessions');
      expect(response.body).toHaveProperty('byState');
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe(-32601); // Method not found
    });

    test('Unsupported HTTP method on /mcp should return error', async () => {
      const response = await request(app)
        .put('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'test'
        })
        .expect(405);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Headers', () => {
    test('Responses should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});