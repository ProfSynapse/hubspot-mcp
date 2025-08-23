/**
 * Get Product Tool
 * 
 * Provides functionality to get a specific product by ID in HubSpot.
 * Part of the Products BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { ProductsService } from './products.service.js';

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
      
      return {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to get product',
        error: errorMessage
      };
    }
  }
};