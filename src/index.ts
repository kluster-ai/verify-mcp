#!/usr/bin/env node

/**
 * MCP Server for kluster verify
 * 
 * This server provides fact-checking tools that integrate with kluster.ai's
 * hallucination detection API to verify claims against reliable sources.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Command } from 'commander';
import { KlusterAIClient } from './kluster-client.js';

// Configure CLI options
const program = new Command();

program
  .name('kluster-verify-mcp')
  .description('MCP server for kluster verify')
  .option('--api-key <key>', 'kluster.ai API key')
  .option('--base-url <url>', 'kluster.ai base URL', 'https://api-r.klusterai.dev/v1')
  .parse();

const options = program.opts();

// Get configuration from CLI args or environment variables
const apiKey = options.apiKey || process.env.KLUSTER_AI_API_KEY;
const baseUrl = options.baseUrl || process.env.KLUSTER_AI_BASE_URL || 'https://api-r.klusterai.dev/v1';

// Validate required configuration
if (!apiKey) {
  console.error('Error: API key is required. Provide it via --api-key argument or KLUSTER_AI_API_KEY environment variable.');
  process.exit(1);
}

// Initialize kluster.ai client
const klusterClient = new KlusterAIClient(apiKey, baseUrl);

// Create MCP server
const server = new Server(
  {
    name: 'kluster-verify',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available MCP tools
const tools: Tool[] = [
  {
    name: 'fact_check',
    description: 'Fact-check a claim against reliable sources using kluster.ai',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The claim to fact-check',
        },
        return_search_results: {
          type: 'boolean',
          description: 'Whether to return search results for verification',
          default: true,
        },
      },
      required: ['claim'],
    },
  },
  {
    name: 'verify_document_claim',
    description: 'Verify if a user\'s claim accurately reflects the content of a source document. Use this when a user makes a statement about what a document says or contains. Provide the document content and the user\'s interpretation to check for accuracy.',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The user\'s claim or interpretation about what the document contains',
        },
        document_content: {
          type: 'string',
          description: 'The full text content of the source document that the claim is about. Include the complete document text for accurate verification.',
        },
        return_search_results: {
          type: 'boolean',
          description: 'Whether to return additional search results for cross-verification',
          default: true,
        },
      },
      required: ['claim', 'document_content'],
    },
  },
];

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('Arguments are required');
  }

  try {
    if (name === 'fact_check') {
      const claim = args.claim as string;
      const returnSearchResults = (args.return_search_results as boolean) ?? true;
      
      // Prepare the prompt for fact checking
      const prompt = 'Please verify this claim for accuracy:';
      
      const response = await klusterClient.detectHallucination(
        prompt,
        claim,
        undefined, // No context needed for simple fact-checking
        returnSearchResults
      );

      // Return structured response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              claim,
              is_accurate: !response.is_hallucination,
              explanation: response.explanation,
              confidence: response.usage,
              search_results: response.search_results,
            }, null, 2),
          },
        ],
      };
    } else if (name === 'verify_document_claim') {
      const claim = args.claim as string;
      const documentContent = args.document_content as string;
      const returnSearchResults = (args.return_search_results as boolean) ?? true;
      
      // Use document content as context for verification
      const prompt = 'Does this claim accurately reflect the provided document content?';
      
      const response = await klusterClient.detectHallucination(
        prompt,
        claim,
        documentContent, // Document content as context - this is the key!
        returnSearchResults
      );

      // Return structured response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              claim,
              is_accurate: !response.is_hallucination,
              explanation: response.explanation,
              confidence: response.usage,
              search_results: response.search_results,
            }, null, 2),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

/**
 * Main function to start the MCP server
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('kluster.ai MCP server started successfully');
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});