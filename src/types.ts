/**
 * TypeScript types for kluster.ai Verify MCP Server
 */

/**
 * Search result from kluster.ai verification
 */
export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * Response from kluster.ai verification API
 */
export interface VerificationResponse {
  is_hallucination: boolean;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  explanation: string;
  search_results?: SearchResult[];
}

/**
 * Transformed response for MCP clients
 */
export interface MCPVerificationResult {
  prompt: string;
  response: string;
  is_hallucination: boolean;
  explanation: string;
  confidence: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  search_results: SearchResult[];
}