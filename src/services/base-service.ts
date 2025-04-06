/**
 * Base Service
 * 
 * Abstract base class for all service implementations.
 * Provides common functionality like rate limiting, error handling, and request management.
 * Services that interact with external APIs should extend this class.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import config from '../config.js';

export abstract class BaseService {
    protected client: AxiosInstance;
    protected rateLimitRemaining: number = 100;
    protected rateLimitReset: number = 0;

    /**
     * Creates a new service instance with the provided configuration
     * @param baseURL - Base URL for API requests
     * @param headers - Default headers to include with every request
     */
    constructor(baseURL: string, headers: Record<string, string>) {
        this.client = axios.create({
            baseURL,
            headers,
            timeout: config.serviceTimeout
        });

        // Add response interceptor for rate limit handling
        this.client.interceptors.response.use(
            (response) => {
                // Update rate limit info from headers if available
                if (response.headers['x-hubspot-ratelimit-remaining']) {
                    this.rateLimitRemaining = parseInt(response.headers['x-hubspot-ratelimit-remaining'] as string);
                }
                if (response.headers['x-hubspot-ratelimit-reset']) {
                    this.rateLimitReset = parseInt(response.headers['x-hubspot-ratelimit-reset'] as string);
                }
                return response;
            },
            async (error) => {
                // Handle rate limiting (429 Too Many Requests)
                if (error.response?.status === 429) {
                    const resetTime = parseInt(error.response.headers['x-hubspot-ratelimit-reset'] || '0');
                    const waitTime = Math.max(0, resetTime - Math.floor(Date.now() / 1000));

                    process.stderr.write(`Rate limit exceeded. Waiting ${waitTime} seconds before retrying...\n`);

                    // Wait until rate limit resets
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

                    // Retry the request
                    return this.client.request(error.config);
                }

                // Handle other errors
                this.handleRequestError(error);
                throw error;
            }
        );
    }

    /**
     * Checks if we're close to hitting rate limits and waits if necessary
     * @protected
     */
    protected async checkRateLimit(): Promise<void> {
        if (this.rateLimitRemaining <= 5) { // Buffer of 5 requests
            const now = Math.floor(Date.now() / 1000);
            const waitTime = Math.max(0, this.rateLimitReset - now);
            if (waitTime > 0) {
                process.stderr.write(`Approaching rate limit. Waiting ${waitTime} seconds...\n`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            }
        }
    }

    /**
     * Makes an API request with rate limit handling
     * @protected
     * @param requestFn - Function that makes the actual API request
     * @returns The API response
     */
    protected async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
        await this.checkRateLimit();
        try {
            return await requestFn();
        } catch (error) {
            this.handleRequestError(error);
            throw error;
        }
    }

    /**
     * Handles request errors with appropriate logging and formatting
     * @protected
     * @param error - The error that occurred
     */
    protected handleRequestError(error: any): void {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            const url = error.config?.url;

            process.stderr.write(`API Error (${status}) for ${url}: ${JSON.stringify(data)}\n`);

            // Enhance error with more context
            (error as any).friendlyMessage = this.getFriendlyErrorMessage(error);
        } else {
            process.stderr.write(`Non-Axios error: ${error}\n`);
        }
    }

    /**
     * Creates a user-friendly error message based on the API error
     * @protected
     * @param error - The Axios error
     * @returns A user-friendly error message
     */
    protected getFriendlyErrorMessage(error: any): string {
        if (!axios.isAxiosError(error)) {
            return 'An unexpected error occurred';
        }

        const status = error.response?.status;

        switch (status) {
            case 400:
                return 'The request was invalid. Please check your input.';
            case 401:
                return 'Authentication failed. Please check your Hubspot API token.';
            case 403:
                return 'You do not have permission to access this resource. Check your Hubspot API token scopes.';
            case 404:
                return 'The requested resource was not found in Hubspot.';
            case 429:
                return 'Hubspot API rate limit exceeded. Please try again later.';
            case 500:
            case 502:
            case 503:
            case 504:
                return 'The Hubspot API encountered an error. Please try again later.';
            default:
                return `An error occurred: ${error.message}`;
        }
    }
}
