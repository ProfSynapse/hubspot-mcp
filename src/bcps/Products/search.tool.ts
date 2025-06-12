/**
 * Search Products Tool
 * 
 * Provides functionality to search products by name in HubSpot.
 * Part of the Products BCP.
 */

import { ToolDefinition, InputSchema, ServiceConfig } from '../../core/types.js';
import { ProductsService } from './products.service.js';

/**
 * Input schema for search products tool
 */
const inputSchema: InputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Product name to search for (required)'
    }
  },
  required: ['name']
};

/**
 * Search products tool definition
 */
export const tool: ToolDefinition = {
  name: 'search',
  description: 'Search for products by name in HubSpot',
  inputSchema,
  handler: async (params) => {
    try {
      // Get API key from environment
      const apiKey = process.env.HUBSPOT_ACCESS_TOKEN || '';
      
      // Create service instance
      const config = { hubspotAccessToken: apiKey };
      const service = new ProductsService(config);
      await service.init();
      
      // Search products
      const products = await service.searchProductsByName(params.name);
      
      return {
        message: `Found ${products.length} product(s) matching "${params.name}"`,
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
        message: 'Failed to search products',
        error: errorMessage
      };
    }
  }
};