#!/usr/bin/env node

/**
 * Simple SSE MCP Server for n8n Integration
 * 
 * Creates an HTTP server with SSE endpoints that n8n MCP Tool can connect to.
 * This bypasses the need for MCP SDK SSE transport and creates a standard HTTP API.
 */

import express from 'express';
import cors from 'cors';
import { Command } from 'commander';
import { KlusterAIClient } from '../../build/kluster-client.js';

// Configure CLI options
const program = new Command();

program
  .name('kluster-ai-sse-server')
  .description('SSE HTTP server for kluster.ai integration with n8n')
  .option('--api-key <key>', 'kluster.ai API key')
  .option('--base-url <url>', 'kluster.ai base URL', 'https://api.klusterai.ai/v1')
  .option('--port <port>', 'HTTP server port', '3001')
  .parse();

const options = program.opts();

// Get configuration
const apiKey = options.apiKey || process.env.KLUSTER_AI_API_KEY;
const baseUrl = options.baseUrl || process.env.KLUSTER_AI_BASE_URL || 'https://api.klusterai.ai/v1';
const port = parseInt(options.port) || 3001;

if (!apiKey) {
  console.error('❌ Error: API key is required. Use --api-key or KLUSTER_AI_API_KEY');
  process.exit(1);
}

// Initialize kluster.ai client
const klusterClient = new KlusterAIClient(apiKey, baseUrl);

// Create Express app
const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json());

// Store active SSE connections
const sseConnections = new Set<express.Response>();

// SSE endpoint for n8n MCP Tool
app.get('/sse', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add to active connections
  sseConnections.add(res);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to kluster.ai MCP SSE server',
    timestamp: new Date().toISOString(),
    tools: ['fact_check', 'verify_document_claim']
  })}\n\n`);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    sseConnections.delete(res);
    console.log(`📡 SSE client disconnected. Active connections: ${sseConnections.size}`);
  });

  req.on('error', () => {
    clearInterval(keepAlive);
    sseConnections.delete(res);
  });

  console.log(`📡 SSE client connected. Active connections: ${sseConnections.size}`);
});

// Tool execution endpoint
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    console.log(`🔧 Executing tool: ${toolName} with args:`, JSON.stringify(args, null, 2));

    let result;
    switch (toolName) {
      case 'fact_check': {
        const { claim, return_search_results = true } = args;
        
        if (typeof claim !== 'string') {
          throw new Error('Claim must be a string');
        }

        const apiResult = await klusterClient.detectHallucination(
          'Please verify this claim for accuracy:',
          claim,
          undefined,
          return_search_results
        );

        result = {
          tool: 'fact_check',
          claim,
          is_accurate: !apiResult.is_hallucination,
          explanation: apiResult.explanation,
          confidence: apiResult.usage,
          search_results: apiResult.search_results || [],
        };
        break;
      }

      case 'verify_document_claim': {
        const { claim, document_content, return_search_results = true } = args;
        
        if (typeof claim !== 'string') {
          throw new Error('Claim must be a string');
        }
        if (typeof document_content !== 'string') {
          throw new Error('Document content must be a string');
        }

        const apiResult = await klusterClient.detectHallucination(
          'Does this claim accurately reflect the provided document content?',
          claim,
          document_content,
          return_search_results
        );

        result = {
          tool: 'verify_document_claim',
          claim,
          is_accurate: !apiResult.is_hallucination,
          explanation: apiResult.explanation,
          confidence: apiResult.usage,
          search_results: apiResult.search_results || [],
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    // Send success response
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

    // Broadcast to SSE clients
    const sseEvent = {
      type: 'tool_execution',
      tool: toolName,
      success: true,
      result,
      timestamp: new Date().toISOString()
    };

    sseConnections.forEach(conn => {
      if (!conn.destroyed) {
        conn.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
      }
    });

    console.log(`✅ Tool ${toolName} executed successfully`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Tool ${toolName} failed:`, errorMessage);

    // Send error response
    res.status(500).json({
      success: false,
      error: errorMessage,
      tool: toolName,
      timestamp: new Date().toISOString()
    });

    // Broadcast error to SSE clients
    const sseEvent = {
      type: 'tool_execution',
      tool: toolName,
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };

    sseConnections.forEach(conn => {
      if (!conn.destroyed) {
        conn.write(`data: ${JSON.stringify(sseEvent)}\n\n`);
      }
    });
  }
});

// Tool listing endpoint
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'fact_check',
        description: 'Fact-check a claim against reliable sources using kluster.ai',
        parameters: {
          claim: { type: 'string', required: true, description: 'The claim to fact-check' },
          return_search_results: { type: 'boolean', required: false, description: 'Whether to return search results' }
        }
      },
      {
        name: 'verify_document_claim',
        description: 'Verify if a user\'s claim accurately reflects document content',
        parameters: {
          claim: { type: 'string', required: true, description: 'The claim to verify' },
          document_content: { type: 'string', required: true, description: 'The source document content' },
          return_search_results: { type: 'boolean', required: false, description: 'Whether to return search results' }
        }
      }
    ],
    server: 'kluster-verify',
    version: '1.0.0'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'kluster-ai-sse-server',
    port: port,
    activeConnections: sseConnections.size,
    endpoints: {
      sse: '/sse',
      tools: '/tools',
      factCheck: '/tools/fact_check',
      verifyDocument: '/tools/verify_document_claim',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`\n🚀 kluster.ai SSE Server started successfully!`);
  console.log(`📍 Server URL: http://localhost:${port}`);
  console.log(`📡 SSE Endpoint: http://localhost:${port}/sse`);
  console.log(`🔧 Tools Endpoint: http://localhost:${port}/tools`);
  console.log(`💓 Health Check: http://localhost:${port}/health`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...`);
  
  console.log(`\n🎯 For n8n MCP Tool configuration:`);
  console.log(`   • Tool Type: HTTP Request`);
  console.log(`   • Base URL: http://localhost:${port}`);
  console.log(`   • SSE URL: http://localhost:${port}/sse`);
  console.log(`   • Fact Check: POST /tools/fact_check`);
  console.log(`   • Verify Document: POST /tools/verify_document_claim`);
  
  console.log(`\n📖 Usage Examples:`);
  console.log(`   curl -X POST http://localhost:${port}/tools/fact_check \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"claim": "The Earth is flat"}'`);
});