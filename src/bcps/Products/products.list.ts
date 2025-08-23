/**
 * List Products Tool
 * 
 * Provides functionality to list recent products in HubSpot.
 * Part of the Products BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { ProductsService } from './products.service.js';

/**
 * Input schema for list products tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum number of products to return (default: 10, max: 100)',
      minimum: 1,
      maximum: 100
    }
  },
  required: []
};

/**
 * List products tool definition
 */
export const tool: ToolDefinition = {
  name: 'list',
  description: 'Get a list of recent products from HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new ProductsService(config);
      await service.init();
      
      // Get products
      const limit = params.limit || 10;
      const products = await service.getRecentProducts(limit);
      
      return {
        message: `Found ${products.length} product(s)`,
        products: products.map(product => ({
          id: product.id,
          name: product.properties.name,
          price: product.properties.price || 'Not set',
          description: product.properties.description || 'No description',
          sku: product.properties.hs_sku || 'No SKU',
          createdAt: product.createdAt
        }))
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        message: 'Failed to list products',
        error: errorMessage
      };
    }
  }
};