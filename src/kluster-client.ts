import axios, { AxiosInstance } from 'axios';

/**
 * Request interface for kluster.ai verification API
 */
export interface VerificationRequest {
  prompt: string;
  output: string;
  context?: string;
  return_search_results?: string;
}

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
 * Client for interacting with kluster.ai verification API
 */
export class KlusterAIClient {
  private client: AxiosInstance;

  /**
   * Create a new kluster.ai client
   * @param apiKey - Your kluster.ai API key
   * @param baseUrl - Base URL for the API (e.g., https://api-r.klusterai.dev/v1)
   */
  constructor(apiKey: string, baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Verify claims using kluster.ai
   * @param prompt - The question or instruction for verification
   * @param output - The text/claim to be fact-checked
   * @param context - Optional context to help with detection
   * @param returnSearchResults - Whether to include search results for verification
   * @returns Promise resolving to verification results
   */
  async verifyClaim(
    prompt: string,
    output: string,
    context?: string,
    returnSearchResults = true
  ): Promise<VerificationResponse> {
    try {
      // Only include defined fields to match exact API format
      const payload: any = {
        model: 'klusterai/verify-agent',
        prompt,
        output,
        return_search_results: returnSearchResults ? 'true' : 'false',
      };
      
      // Only add context if it's defined
      if (context !== undefined) {
        payload.context = context;
      }

      // Optional: Enable debug logging in development
      // console.error(`[DEBUG] API Request:`, JSON.stringify(payload, null, 2));

      const response = await this.client.post<VerificationResponse>(
        '/verify/reliability',
        payload
      );

      // Optional: Enable debug logging in development
      // console.error(`[DEBUG] Response:`, JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      // Log error details for debugging
      console.error(`API Error:`, error.message);
      if (error.response) {
        console.error(`Response status:`, error.response.status);
        console.error(`Response data:`, error.response.data);
      }
      throw new Error(`Failed to verify claim: ${error.message}`);
    }
  }
}