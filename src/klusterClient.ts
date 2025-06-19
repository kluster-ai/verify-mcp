import axios, { AxiosInstance } from 'axios';
import type { VerificationResponse } from './types.js';

/**
 * Client for interacting with kluster.ai verification API
 */
export class KlusterAIClient {
  private client: AxiosInstance;

  /**
   * Create a new kluster.ai client
   * @param apiKey - Your kluster.ai API key
   * @param baseUrl - Base URL for the API (default: https://api.kluster.ai/v1)
   */
  constructor(apiKey: string, baseUrl = 'https://api.kluster.ai/v1') {
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

      const response = await this.client.post<VerificationResponse>(
        '/verify/reliability',
        payload
      );

      return response.data;
    } catch (error: any) {
      console.error(`Kluster API Error:`, error.message);
      if (error.response) {
        console.error(`Response status:`, error.response.status);
        console.error(`Response data:`, error.response.data);
      }
      throw new Error(`Failed to verify claim: ${error.message}`);
    }
  }
}