#!/usr/bin/env node

/**
 * HTTP Streamable MCP Server for kluster.ai Verify
 * 
 * Provides MCP (Model Context Protocol) tools over HTTP Streamable transport
 * for integration with n8n workflows. Implements JSON-RPC protocol for
 * fact-checking claims using kluster.ai's verification API.
 */

import { Command } from 'commander';
import express from 'express';
import cors from 'cors';
import { KlusterAIClient } from '../../build/kluster-client.js';

// Configure CLI options
const program = new Command();

program
  .name('kluster-ai-http-streamable-server')
  .description('HTTP Streamable MCP server for kluster.ai Verify')
  .option('--api-key <key>', 'kluster.ai API key')
  .option('--base-url <url>', 'kluster.ai base URL', 'https://api.kluster.ai/v1')
  .option('--port <port>', 'HTTP server port', '3001')
  .parse();

const options = program.opts();

// Get configuration
const apiKey = options.apiKey || process.env.KLUSTER_API_KEY;
const baseUrl = options.baseUrl || process.env.KLUSTER_AI_BASE_URL || 'https://api.kluster.ai/v1';
const port = parseInt(options.port) || 3001;

if (!apiKey) {
  console.error('❌ Error: API key is required. Use --api-key or KLUSTER_API_KEY');
  process.exit(1);
}

// Initialize kluster.ai client
const klusterClient = new KlusterAIClient(apiKey, baseUrl);

// Create HTTP server with Express
const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json());

// HTTP Streamable endpoint implementing MCP JSON-RPC protocol
app.post('/stream', async (req, res) => {
  try {
    const message = req.body;
    
    // Handle MCP protocol initialization
    if (message.method === 'initialize') {
      const result = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name: 'kluster-verify',
            version: '1.0.0'
          }
        }
      };
      
      return res.json(result);
      
    } else if (message.method === 'notifications/initialized') {
      // Acknowledge initialization notification
      return res.status(204).send();
      
    } else if (message.method === 'tools/list') {
      // Return available verification tools
      const result = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [
            {
              name: 'verify',
              description: 'Verify claims against reliable sources using kluster.ai Verify service',
              inputSchema: {
                type: 'object',
                properties: {
                  claim: {
                    type: 'string',
                    description: 'The claim to verify'
                  },
                  return_search_results: {
                    type: 'boolean',
                    description: 'Whether to return search results',
                    default: true
                  }
                },
                required: ['claim'],
                additionalProperties: false
              }
            },
            {
              name: 'verify_document',
              description: 'Verify if a user\'s claim accurately reflects document content using kluster.ai Verify service',
              inputSchema: {
                type: 'object',
                properties: {
                  claim: {
                    type: 'string',
                    description: 'The claim to verify'
                  },
                  document_content: {
                    type: 'string',
                    description: 'The source document content'
                  },
                  return_search_results: {
                    type: 'boolean',
                    description: 'Whether to return search results',
                    default: true
                  }
                },
                required: ['claim', 'document_content'],
                additionalProperties: false
              }
            }
          ]
        }
      };
      
      return res.json(result);
      
    } else if (message.method === 'tools/call') {
      // Execute verification tools
      const { name, arguments: args } = message.params;
      
      try {
        let toolResult: any;
        
        if (name === 'verify') {
          const { claim, return_search_results = true } = args;
          
          if (typeof claim !== 'string') {
            throw new Error('Claim must be a string');
          }

          const apiResult = await klusterClient.verifyClaim(
            'Please verify this claim for accuracy:',
            claim,
            undefined,
            return_search_results
          );

          toolResult = {
            claim,
            is_hallucination: apiResult.is_hallucination,
            explanation: apiResult.explanation,
            usage: apiResult.usage,
            search_results: apiResult.search_results || [],
          };
          
        } else if (name === 'verify_document') {
          const { claim, document_content, return_search_results = true } = args;
          
          if (typeof claim !== 'string') {
            throw new Error('Claim must be a string');
          }
          if (typeof document_content !== 'string') {
            throw new Error('Document content must be a string');
          }

          const apiResult = await klusterClient.verifyClaim(
            'Does this claim accurately reflect the provided document content?',
            claim,
            document_content,
            return_search_results
          );

          toolResult = {
            claim,
            is_hallucination: apiResult.is_hallucination,
            explanation: apiResult.explanation,
            usage: apiResult.usage,
            search_results: apiResult.search_results || [],
          };
          
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        return res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
          }
        });
        
      } catch (toolError) {
        const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
        
        return res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true
          }
        });
      }
      
    } else {
      // Handle unknown methods
      return res.json({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      });
    }
    
  } catch (error) {
    console.error('HTTP Streamable error:', error);
    
    return res.json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
  }
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'kluster-ai-http-streamable-server',
    port,
    endpoint: '/stream',
    timestamp: new Date().toISOString()
  });
});

// Start the HTTP server
app.listen(port, () => {
  console.log(`\nkluster.ai HTTP Streamable MCP Server started`);
  console.log(`Server URL: http://localhost:${port}`);
  console.log(`HTTP Streamable Endpoint: http://localhost:${port}/stream`);
  console.log(`Health Check: http://localhost:${port}/health`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...`);
  
  console.log(`\nFor n8n MCP Tool configuration:`);
  console.log(`  Transport: HTTP Streamable`);
  console.log(`  URL: http://host.docker.internal:${port}/stream`);
  console.log(`  Tools: verify, verify_document`);
});