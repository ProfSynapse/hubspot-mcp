/**
 * Products Service
 * 
 * Handles all HubSpot product-related API operations.
 * Extends the base service with product-specific functionality.
 */

import { SimplePublicObjectInputForCreate, PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/products/index.js';
import { HubspotBaseService } from '../../core/base-service.js';

// Basic product properties that can be undefined
export interface ProductPropertiesInput {
  name: string;
  price?: string;
  description?: string;
  hs_sku?: string;
  hs_cost_of_goods_sold?: string;
  hs_recurring_billing_period?: string;
  hs_product_type?: string;
  [key: string]: string | undefined;
}

// HubSpot API requires all properties to be strings
export interface ProductProperties {
  name: string;
  price: string;
  description: string;
  hs_sku: string;
  [key: string]: string;
}

export interface ProductResponse {
  id: string;
  properties: ProductProperties;
  createdAt: string;
  updatedAt: string;
}

export class ProductsService extends HubspotBaseService {
  /**
   * Create a new product
   */
  async createProduct(properties: ProductPropertiesInput): Promise<ProductResponse> {
    this.checkInitialized();
    this.validateRequired(properties, ['name']);

    try {
      const apiProperties: { [key: string]: string } = {
        name: properties.name,
        ...(properties.price && { price: properties.price }),
        ...(properties.description && { description: properties.description })
      };

      // Add other properties if they exist
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== undefined && !apiProperties[key]) {
          apiProperties[key] = value;
        }
      });

      const input: SimplePublicObjectInputForCreate = {
        properties: apiProperties,
        associations: []
      };

      const response = await this.client.crm.products.basicApi.create(input);

      return {
        id: response.id,
        properties: response.properties as ProductProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create product');
    }
  }

  /**
   * Get product by ID
   */
  async getProduct(id: string): Promise<ProductResponse> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.products.basicApi.getById(id);

      return {
        id: response.id,
        properties: response.properties as ProductProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      // Handle 404 errors specifically for better error reporting
      if (this.isNotFoundError(error)) {
        throw new Error(`Product with ID '${id}' not found. Please verify the product ID and try again.`);
      }
      throw this.handleApiError(error, 'Failed to get product');
    }
  }

  /**
   * Check if error is a 404 Not Found error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as any).status === 404;
    }
    
    // Check error message for common 404 patterns
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('404') || 
           message.includes('not found') || 
           message.includes('Not Found') ||
           message.includes('does not exist');
  }

  /**
   * Search for products by name
   */
  async searchProductsByName(name: string): Promise<ProductResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'name',
            operator: 'CONTAINS_TOKEN',
            value: name
          }]
        }],
        sorts: [],
        properties: ['name', 'price', 'description', 'hs_sku'],
        limit: 100,
        after: 0
      };

      const response = await this.client.crm.products.searchApi.doSearch(searchRequest);

      return response.results.map(product => ({
        id: product.id,
        properties: product.properties as ProductProperties,
        createdAt: new Date(product.createdAt).toISOString(),
        updatedAt: new Date(product.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search products');
    }
  }

  /**
   * Get recent products
   */
  async getRecentProducts(limit: number = 10): Promise<ProductResponse[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.products.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );

      return response.results.map(product => ({
        id: product.id,
        properties: product.properties as ProductProperties,
        createdAt: new Date(product.createdAt).toISOString(),
        updatedAt: new Date(product.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get recent products');
    }
  }

  /**
   * Update product properties
   */
  async updateProduct(id: string, properties: Partial<ProductPropertiesInput>): Promise<ProductResponse> {
    this.checkInitialized();

    try {
      // Filter out undefined values and ensure string values
      const apiProperties: { [key: string]: string } = Object.fromEntries(
        Object.entries(properties)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      );

      const response = await this.client.crm.products.basicApi.update(id, {
        properties: apiProperties
      });

      return {
        id: response.id,
        properties: response.properties as ProductProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update product');
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<void> {
    this.checkInitialized();

    try {
      await this.client.crm.products.basicApi.archive(id);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to delete product');
    }
  }
}