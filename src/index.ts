#!/usr/bin/env node

/**
 * Self-hosted MCP server for kluster.ai Verify
 * 
 * Provides fact-checking and verification tools using kluster.ai's API.
 * Implements MCP protocol over HTTP Streamable transport.
 * 
 * @author kluster.ai
 * @version 1.0.0
 */

import { Command } from 'commander';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import fastify from 'fastify';
import { z } from 'zod';
import { KlusterAIClient } from './klusterClient.js';
import type { MCPVerificationResult } from './types.js';

// CLI configuration
const program = new Command();
program
  .name('kluster-verify-mcp')
  .description('Self-hosted MCP server for kluster.ai Verify')
  .option('--api-key <key>', 'kluster.ai API key')
  .option('--base-url <url>', 'kluster.ai base URL', 'https://api.kluster.ai/v1')
  .option('--port <port>', 'Server port', '3001')
  .parse();

const options = program.opts();

// Validate required configuration
const apiKey = options.apiKey || process.env.KLUSTER_API_KEY;
if (!apiKey) {
  console.error('Error: API key is required. Use --api-key or KLUSTER_API_KEY environment variable.');
  process.exit(1);
}

const baseUrl = options.baseUrl || process.env.KLUSTER_AI_BASE_URL || 'https://api.kluster.ai/v1';
const port = parseInt(options.port) || 3001;

// Initialize kluster.ai client
const klusterClient = new KlusterAIClient(apiKey, baseUrl);

/**
 * Creates an MCP server instance with kluster.ai Verify tools
 */
function createMcpServer(serverApiKey?: string): McpServer {
  const effectiveApiKey = serverApiKey || apiKey;
  
  const mcpServer = new McpServer(
    {
      name: 'kluster-verify-mcp-server',
      version: '1.0.0',
    },
    { 
      capabilities: { 
        tools: {}, 
        logging: {} 
      } 
    }
  );

  // Tool 1: verify
  mcpServer.tool(
    'verify',
    'Fact-check a claim against reliable sources using kluster.ai',
    {
      claim: z.string().describe('The claim to fact-check'),
      returnSearchResults: z
        .boolean()
        .describe('Whether to return search results for verification')
        .default(true),
    },
    async ({ claim, returnSearchResults }) => {
      try {
        // Create client with effective API key
        const client = new KlusterAIClient(effectiveApiKey, baseUrl);
        
        // Call kluster.ai API
        const result = await client.verifyClaim(
          'Please verify this claim for accuracy:',
          claim,
          undefined,
          returnSearchResults
        );

        // Transform response to match expected format
        const mcpResult: MCPVerificationResult = {
          claim,
          is_accurate: !result.is_hallucination, 
          explanation: result.explanation,
          confidence: result.usage, 
          search_results: result.search_results || [],
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(mcpResult, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool 2: verify_document
  mcpServer.tool(
    'verify_document',
    'Verify if a user\'s claim accurately reflects the content of a source document',
    {
      claim: z
        .string()
        .describe('The user\'s claim or interpretation about what the document contains'),
      documentContent: z
        .string()
        .describe('The full text content of the source document that the claim is about'),
      returnSearchResults: z
        .boolean()
        .describe('Whether to return additional search results for cross-verification')
        .default(true),
    },
    async ({ claim, documentContent, returnSearchResults }) => {
      try {
        // Create client with effective API key
        const client = new KlusterAIClient(effectiveApiKey, baseUrl);
        
        // Call kluster.ai API with document context
        const result = await client.verifyClaim(
          'Does this claim accurately reflect the provided document content?',
          claim,
          documentContent,
          returnSearchResults
        );

        // Transform response to match expected format
        const mcpResult: MCPVerificationResult = {
          claim,
          is_accurate: !result.is_hallucination, // Critical transformation
          explanation: result.explanation,
          confidence: result.usage, // Rename usage to confidence
          search_results: result.search_results || [],
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(mcpResult, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Add information resource
  mcpServer.resource(
    'info',
    'info://server',
    { mimeType: 'text/plain' },
    async () => {
      return {
        contents: [
          {
            uri: 'info://server',
            text: 'This is a self-hosted kluster.ai MCP server providing fact-checking and verification tools using kluster.ai technology.',
          },
        ],
      };
    }
  );

  return mcpServer;
}

/**
 * Creates a Fastify server with MCP endpoints
 * 
 * @returns Configured Fastify application with MCP endpoints
 */
async function createFastifyServer() {
  const app = fastify({ logger: false });

  // Handle MCP requests at /stream endpoint
  app.post('/stream', async (request, reply) => {
    // Extract API key from header (like cloud server)
    const headerApiKey = request.headers['x-api-key'] as string;
    const finalApiKey = headerApiKey || apiKey;
    
    if (!finalApiKey) {
      reply.code(401).send({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'API key required' },
        id: null
      });
      return;
    }
    
    const server = createMcpServer(finalApiKey);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Handle connection cleanup
    reply.raw.on('close', async () => {
      await transport.close();
      await server.server.close();
    });

    // Connect server to transport and handle request
    await server.server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      server: 'kluster-verify-mcp-server',
      version: '1.0.0',
      port,
      endpoint: '/stream',
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}

/**
 * Initialize and start the MCP server
 * 
 * Configures Fastify server, connects MCP transport, and starts listening
 * for incoming connections on the specified port.
 */
async function main() {
  try {
    const app = await createFastifyServer();
    
    await app.listen({ port, host: '0.0.0.0' });
    
    console.log(`kluster.ai Verify MCP Server started on port ${port}`);
    console.log(`MCP Endpoint: http://localhost:${port}/stream`);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});