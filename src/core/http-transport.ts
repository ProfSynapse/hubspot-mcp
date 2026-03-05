/**
 * HTTP Streamable Transport for MCP Server
 * 
 * Implements the MCP Transport interface for HTTP Streamable transport
 * as specified in MCP Protocol version 2025-03-26
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * HTTP Streamable Transport
 * 
 * This transport handles JSON-RPC messages over HTTP POST requests
 * without using Server-Sent Events (SSE)
 */
export class HttpStreamableTransport implements Transport {
  private _sessionId: string;
  private _closed: boolean = false;
  
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;

  constructor(sessionId: string) {
    this._sessionId = sessionId;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  async start(): Promise<void> {
    // HTTP Streamable transport doesn't need explicit connection start
    // It's handled through HTTP requests
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this._closed) {
      throw new Error('Transport is closed');
    }
    
    // For HTTP Streamable transport, sending is handled by the HTTP response
    // This method is called by the MCP server to send responses back to the client
    // The actual sending happens in the HTTP response handler
    
    // We'll store the message to be sent back in the HTTP response
    // This is handled at the HTTP server level
  }

  async close(): Promise<void> {
    if (this._closed) {
      return;
    }
    
    this._closed = true;
    if (this.onclose) {
      this.onclose();
    }
  }

  /**
   * Handle an incoming message from the HTTP request
   */
  public handleMessage(message: JSONRPCMessage): void {
    if (this._closed) {
      return;
    }
    
    if (this.onmessage) {
      this.onmessage(message);
    }
  }

  /**
   * Check if transport is closed
   */
  public isClosed(): boolean {
    return this._closed;
  }
}