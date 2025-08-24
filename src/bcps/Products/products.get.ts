/**
 * Get Product Tool
 * 
 * Provides functionality to get a specific product by ID in HubSpot.
 * Part of the Products BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { ProductsService } from './products.service.js';
import { enhanceResponse } from '../../core/response-enhancer.js';

/**
 * Input schema for get product tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Product ID (required)'
    }
  },
  required: ['id']
};

/**
 * Get product tool definition
 */
export const tool: ToolDefinition = {
  name: 'get',
  description: 'Get a specific product by ID from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new ProductsService(config);
      await service.init();
      
      // Get product
      const product = await service.getProduct(params.id);
      
      const response = {
        message: 'Product retrieved successfully',
        product: {
          id: product.id,
          name: product.properties.name,
          price: product.properties.price || 'Not set',
          description: product.properties.description || 'No description',
          sku: product.properties.hs_sku || 'No SKU',
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }
      };
      
      return enhanceResponse(response, 'get', params, 'Products');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a 404 error (product not found)
      const isNotFound = errorMessage.includes('not found') || 
                        errorMessage.includes('404') ||
                        errorMessage.includes('Not Found');
      
      if (isNotFound) {
        const notFoundResponse = {
          message: 'Product not found',
          error: errorMessage,
          details: {
            statusCode: 404,
            productId: params.id,
            suggestion: 'Please verify the product ID is correct and the product exists in HubSpot'
          }
        };
        
        return enhanceResponse(notFoundResponse, 'get', params, 'Products', error instanceof Error ? error : undefined);
      }
      
      // Handle other errors
      const errorResponse = {
        message: 'Failed to get product',
        error: errorMessage,
        details: {
          productId: params.id
        }
      };
      
      return enhanceResponse(errorResponse, 'get', params, 'Products', error instanceof Error ? error : undefined);
    }
  }
};