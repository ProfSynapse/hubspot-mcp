/**
 * Associations Service
 * 
 * Provides functionality to create, retrieve, update, and delete associations between HubSpot objects.
 * Part of the Associations BCP.
 */

import { HubspotBaseService } from '../../core/base-service.js';
import { ServiceConfig, BcpError } from '../../core/types.js';
import * as AssociationTypeHelper from './associationTypeHelper.js';

/**
 * Association Type definition
 * Represents a specific type of association between objects in HubSpot
 */
export interface AssociationType {
  associationCategory: 'HUBSPOT_DEFINED' | 'USER_DEFINED' | 'INTEGRATOR_DEFINED';
  associationTypeId: number;
}

/**
 * Association definition
 * Represents an association between two objects in HubSpot
 */
export interface Association {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
  types: AssociationType[];
}

/**
 * Association input for creating associations
 */
export interface AssociationInput {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
  types: AssociationType[];
}

/**
 * Association batch input for creating multiple associations
 */
export interface AssociationBatchInput {
  inputs: AssociationInput[];
}

/**
 * Association batch delete input
 */
export interface AssociationBatchDeleteInput {
  inputs: {
    from: {
      id: string;
    };
    to: {
      id: string;
    }[];
  }[];
}

/**
 * Association batch read input
 */
export interface AssociationBatchReadInput {
  inputs: {
    id: string;
    after?: string;
  }[];
}

/**
 * Association Type with label and category
 * Represents a specific type of association between objects in HubSpot with additional metadata
 */
export interface AssociationTypeWithLabel {
  typeId: number;
  label: string;
  category: 'HUBSPOT_DEFINED' | 'USER_DEFINED' | 'INTEGRATOR_DEFINED';
}

/**
 * Association result from list operation
 */
export interface AssociationListItem {
  associationTypes: AssociationTypeWithLabel[];
  toObjectId: string;
}

/**
 * Association list result
 */
export interface AssociationListResult {
  results: AssociationListItem[];
  paging?: {
    next: {
      after: string;
      link?: string; // Deprecated
    };
  };
}

/**
 * Association result from batch read
 */
export interface AssociationResult {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
  types: AssociationType[];
}

/**
 * Association batch read result
 */
export interface AssociationBatchReadResult {
  results: {
    from: {
      id: string;
    };
    to: AssociationResult[];
    paging?: {
      next: {
        after: string;
        link?: string; // Deprecated
      };
    };
  }[];
}

/**
 * Associations Service
 * Handles operations related to HubSpot associations
 */
export class AssociationsService extends HubspotBaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Create an association between two objects
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param fromObjectId - The ID of the first object
   * @param toObjectType - The type of the second object
   * @param toObjectId - The ID of the second object
   * @param types - The association types to create
   * @param autoDiscoverType - Whether to automatically discover the association type if not provided
   * @returns The created association
   */
  public async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string,
    types: AssociationType[],
    autoDiscoverType: boolean = true
  ): Promise<void> {
    this.checkInitialized();
    
    if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
      throw new BcpError(
        'Object types and IDs are required for creating an association',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!types || types.length === 0) {
      if (autoDiscoverType) {
        // Try to automatically discover the association type
        const typeId = AssociationTypeHelper.getAssociationTypeId(fromObjectType, toObjectType);
        
        if (typeId) {
          types = [{
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: typeId
          }];
          console.log(`Auto-discovered association type ID ${typeId} for ${fromObjectType} -> ${toObjectType}`);
        } else {
          throw new BcpError(
            `At least one association type is required and auto-discovery failed for ${fromObjectType} -> ${toObjectType}`,
            'VALIDATION_ERROR',
            400
          );
        }
      } else {
        throw new BcpError(
          'At least one association type is required',
          'VALIDATION_ERROR',
          400
        );
      }
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`,
        body: types
      });
    } catch (error) {
      this.handleApiError(error, 'Failed to create association');
    }
  }

  /**
   * Create a default association between two objects
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param fromObjectId - The ID of the first object
   * @param toObjectType - The type of the second object
   * @param toObjectId - The ID of the second object
   * @returns The created default association
   */
  public async createDefaultAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ): Promise<void> {
    this.checkInitialized();
    
    if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
      throw new BcpError(
        'Object types and IDs are required for creating a default association',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      await this.client.apiRequest({
        method: 'PUT',
        path: `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/default/${toObjectType}/${toObjectId}`
      });
    } catch (error) {
      this.handleApiError(error, 'Failed to create default association');
    }
  }

  /**
   * Delete all associations between two objects
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param fromObjectId - The ID of the first object
   * @param toObjectType - The type of the second object
   * @param toObjectId - The ID of the second object
   */
  public async deleteAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ): Promise<void> {
    this.checkInitialized();
    
    if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
      throw new BcpError(
        'Object types and IDs are required for deleting an association',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`
      });
    } catch (error) {
      this.handleApiError(error, 'Failed to delete association');
    }
  }

  /**
   * List associations for an object
   * 
   * @param objectType - The type of the object (e.g., 'contacts', 'companies')
   * @param objectId - The ID of the object
   * @param toObjectType - The type of associated objects to list
   * @param limit - Maximum number of results to return (default: 500, max: 500)
   * @param after - Pagination cursor
   * @returns List of associations
   */
  public async listAssociations(
    objectType: string,
    objectId: string,
    toObjectType: string,
    limit: number = 500,
    after?: string
  ): Promise<AssociationListResult> {
    this.checkInitialized();
    
    if (!objectType || !objectId || !toObjectType) {
      throw new BcpError(
        'Object type, ID, and target object type are required for listing associations',
        'VALIDATION_ERROR',
        400
      );
    }

    // Ensure limit is within bounds
    if (limit <= 0 || limit > 500) {
      limit = 500;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      if (after) {
        queryParams.append('after', after);
      }

      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v4/objects/${objectType}/${objectId}/associations/${toObjectType}?${queryParams.toString()}`
      });

      // Ensure the response has the expected structure
      if (!response || typeof response !== 'object') {
        throw new BcpError(
          'Invalid response from HubSpot API',
          'API_ERROR',
          500
        );
      }

      // Cast the response to any to access its properties
      const apiResponse = response as any;
      
      // Ensure results is an array, even if empty
      const result: AssociationListResult = {
        results: Array.isArray(apiResponse.results) ? apiResponse.results : [],
        paging: apiResponse.paging
      };

      return result;
    } catch (error) {
      this.handleApiError(error, 'Failed to list associations');
    }
  }

  /**
   * Get association types between two object types
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @returns An object mapping association type names to type IDs, or null if not found
   */
  public getAssociationTypes(
    fromObjectType: string,
    toObjectType: string
  ): Record<string, number> | null {
    return AssociationTypeHelper.getAssociationTypes(fromObjectType, toObjectType);
  }
  
  /**
   * Get the association type ID for a given pair of object types and association type name
   * 
   * @param fromObjectType - The source object type (e.g., 'notes', 'contacts')
   * @param toObjectType - The target object type (e.g., 'contacts', 'companies')
   * @param associationType - The association type name (e.g., 'primary', 'meeting')
   * @returns The association type ID, or null if not found
   */
  public getAssociationTypeId(
    fromObjectType: string,
    toObjectType: string,
    associationType: string = 'default'
  ): number | null {
    return AssociationTypeHelper.getAssociationTypeId(fromObjectType, toObjectType, associationType);
  }
  
  /**
   * Get a reference table of all association types in the cache
   * 
   * @returns A formatted string containing the reference table
   */
  public getAssociationTypeReferenceTable(): string {
    return AssociationTypeHelper.getReferenceTable();
  }

  /**
   * Get association types from the HubSpot API
   * 
   * @param fromObjectType - The source object type (e.g., 'contacts', 'companies')
   * @param toObjectType - The target object type (e.g., 'contacts', 'companies')
   * @returns The API response containing association types
   */
  public async getAssociationTypesFromApi(
    fromObjectType: string,
    toObjectType: string
  ): Promise<{ results: Array<{ typeId: number; label: string }> }> {
    this.checkInitialized();
    
    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/labels`
      });
      
      // Use unknown as an intermediate type to avoid direct type conversion errors
      return response as unknown as { results: Array<{ typeId: number; label: string }> };
    } catch (error) {
      this.handleApiError(error, `Failed to get association types for ${fromObjectType} to ${toObjectType}`);
    }
  }

  /**
   * Batch create associations
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @param inputs - The associations to create
   * @param autoDiscoverType - Whether to automatically discover association types if not provided
   * @returns The created associations
   */
  public async batchCreateAssociations(
    fromObjectType: string,
    toObjectType: string,
    inputs: AssociationInput[],
    autoDiscoverType: boolean = true
  ): Promise<Association[]> {
    this.checkInitialized();
    
    if (!fromObjectType || !toObjectType) {
      throw new BcpError(
        'Object types are required for batch creating associations',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!inputs || inputs.length === 0) {
      throw new BcpError(
        'At least one association input is required',
        'VALIDATION_ERROR',
        400
      );
    }
    
    // If auto-discover is enabled, check each input for missing types
    if (autoDiscoverType) {
      for (const input of inputs) {
        if (!input.types || input.types.length === 0) {
          // Try to automatically discover the association type
          const typeId = AssociationTypeHelper.getAssociationTypeId(fromObjectType, toObjectType);
          
          if (typeId) {
            input.types = [{
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: typeId
            }];
            console.log(`Auto-discovered association type ID ${typeId} for ${fromObjectType} -> ${toObjectType}`);
          } else {
            throw new BcpError(
              `Association types are required for input ${JSON.stringify(input)} and auto-discovery failed`,
              'VALIDATION_ERROR',
              400
            );
          }
        }
      }
    }

    try {
      const response = await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/create`,
        body: { inputs }
      });

      return (response as any).results;
    } catch (error) {
      this.handleApiError(error, 'Failed to batch create associations');
    }
  }

  /**
   * Batch create default associations
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @param inputs - The associations to create
   * @returns The created default associations
   */
  public async batchCreateDefaultAssociations(
    fromObjectType: string,
    toObjectType: string,
    inputs: { from: { id: string }, to: { id: string } }[]
  ): Promise<Association[]> {
    this.checkInitialized();
    
    if (!fromObjectType || !toObjectType) {
      throw new BcpError(
        'Object types are required for batch creating default associations',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!inputs || inputs.length === 0) {
      throw new BcpError(
        'At least one association input is required',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const response = await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/associate/default`,
        body: { inputs }
      });

      return (response as any).results;
    } catch (error) {
      this.handleApiError(error, 'Failed to batch create default associations');
    }
  }

  /**
   * Batch delete associations
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @param inputs - The associations to delete
   */
  public async batchDeleteAssociations(
    fromObjectType: string,
    toObjectType: string,
    inputs: { from: { id: string }, to: { id: string }[] }[]
  ): Promise<void> {
    this.checkInitialized();
    
    if (!fromObjectType || !toObjectType) {
      throw new BcpError(
        'Object types are required for batch deleting associations',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!inputs || inputs.length === 0) {
      throw new BcpError(
        'At least one association input is required',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/archive`,
        body: { inputs }
      });
    } catch (error) {
      this.handleApiError(error, 'Failed to batch delete associations');
    }
  }

  /**
   * Batch delete specific association labels
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @param inputs - The association labels to delete
   */
  public async batchDeleteAssociationLabels(
    fromObjectType: string,
    toObjectType: string,
    inputs: AssociationInput[]
  ): Promise<void> {
    this.checkInitialized();
    
    if (!fromObjectType || !toObjectType) {
      throw new BcpError(
        'Object types are required for batch deleting association labels',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!inputs || inputs.length === 0) {
      throw new BcpError(
        'At least one association input is required',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/labels/archive`,
        body: { inputs }
      });
    } catch (error) {
      this.handleApiError(error, 'Failed to batch delete association labels');
    }
  }

  /**
   * Batch read associations
   * 
   * @param fromObjectType - The type of the first object (e.g., 'contacts', 'companies')
   * @param toObjectType - The type of the second object
   * @param inputs - The objects to read associations for
   * @returns The associations for the specified objects
   */
  public async batchReadAssociations(
    fromObjectType: string,
    toObjectType: string,
    inputs: { id: string, after?: string }[]
  ): Promise<AssociationBatchReadResult> {
    this.checkInitialized();
    
    if (!fromObjectType || !toObjectType) {
      throw new BcpError(
        'Object types are required for batch reading associations',
        'VALIDATION_ERROR',
        400
      );
    }

    if (!inputs || inputs.length === 0) {
      throw new BcpError(
        'At least one input is required',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const response = await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`,
        body: { inputs }
      });

      return response as unknown as AssociationBatchReadResult;
    } catch (error) {
      this.handleApiError(error, 'Failed to batch read associations');
    }
  }
}
