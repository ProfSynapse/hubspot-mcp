import { HubspotBaseService } from '../../core/base-service.js';
import { BcpError } from '../../core/types.js';
import Fuse from 'fuse.js';

export interface PropertyInput {
  name: string;
  label: string;
  description?: string;
  groupName: string;
  type: 'string' | 'number' | 'date' | 'datetime' | 'enumeration' | 'bool';
  fieldType: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'number';
  options?: Array<{
    label: string;
    value: string;
    displayOrder?: number;
    hidden?: boolean;
  }>;
  formField?: boolean;
  displayOrder?: number;
  hidden?: boolean;
  hasUniqueValue?: boolean;
  calculationFormula?: string;
}

export interface PropertyResponse {
  name: string;
  label: string;
  description: string;
  groupName: string;
  type: string;
  fieldType: string;
  options?: Array<{
    label: string;
    value: string;
    displayOrder: number;
    hidden: boolean;
  }>;
  formField: boolean;
  displayOrder: number;
  hidden: boolean;
  hasUniqueValue: boolean;
  calculationFormula?: string;
  createdAt: string;
  updatedAt: string;
  createdUserId?: string;
  updatedUserId?: string;
}

export interface PropertyGroupInput {
  name: string;
  displayName: string;
  displayOrder?: number;
}

export interface PropertyGroupResponse {
  name: string;
  displayName: string;
  displayOrder: number;
  properties: string[];
}

export class PropertiesService extends HubspotBaseService {

  /**
   * In-memory cache for properties
   * Key format: `${objectType}:${includeArchived}`
   */
  private propertyCache: Map<string, {
    properties: PropertyResponse[];
    timestamp: number;
    ttl: number;
  }> = new Map();

  /**
   * Default cache TTL: 10 minutes
   */
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  /**
   * Get all properties for a specific object type
   */
  async getProperties(objectType: string): Promise<PropertyResponse[]> {
    this.checkInitialized();
    this.validateRequired({ objectType }, ['objectType']);

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/properties/${objectType}`
      });

      const data = await response.json();
      return (data.results || []).map((property: any) => this.transformPropertyResponse(property));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get properties for ${objectType}`);
    }
  }

  /**
   * Get a specific property by name
   */
  async getProperty(objectType: string, propertyName: string): Promise<PropertyResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType, propertyName }, ['objectType', 'propertyName']);

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/properties/${objectType}/${propertyName}`
      });

      const data = await response.json();
      return this.transformPropertyResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get property ${propertyName} for ${objectType}`);
    }
  }

  /**
   * Create a new property for a specific object type
   */
  async createProperty(objectType: string, propertyData: PropertyInput): Promise<PropertyResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType }, ['objectType']);
    this.validateRequired(propertyData, ['name', 'label', 'groupName', 'type', 'fieldType']);

    try {
      const requestBody = {
        name: propertyData.name,
        label: propertyData.label,
        description: propertyData.description || '',
        groupName: propertyData.groupName,
        type: propertyData.type,
        fieldType: propertyData.fieldType,
        formField: propertyData.formField ?? true,
        displayOrder: propertyData.displayOrder ?? -1,
        hidden: propertyData.hidden ?? false,
        hasUniqueValue: propertyData.hasUniqueValue ?? false,
      };

      if (propertyData.options && propertyData.options.length > 0) {
        (requestBody as any).options = propertyData.options;
      }

      if (propertyData.calculationFormula) {
        (requestBody as any).calculationFormula = propertyData.calculationFormula;
      }

      const response = await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v3/properties/${objectType}`,
        body: requestBody
      });

      const data = await response.json();
      return this.transformPropertyResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to create property for ${objectType}`);
    }
  }

  /**
   * Update an existing property
   */
  async updateProperty(objectType: string, propertyName: string, propertyData: Partial<PropertyInput>): Promise<PropertyResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType, propertyName }, ['objectType', 'propertyName']);

    try {
      const requestBody: any = {};
      
      if (propertyData.label !== undefined) requestBody.label = propertyData.label;
      if (propertyData.description !== undefined) requestBody.description = propertyData.description;
      if (propertyData.groupName !== undefined) requestBody.groupName = propertyData.groupName;
      if (propertyData.type !== undefined) requestBody.type = propertyData.type;
      if (propertyData.fieldType !== undefined) requestBody.fieldType = propertyData.fieldType;
      if (propertyData.formField !== undefined) requestBody.formField = propertyData.formField;
      if (propertyData.displayOrder !== undefined) requestBody.displayOrder = propertyData.displayOrder;
      if (propertyData.hidden !== undefined) requestBody.hidden = propertyData.hidden;
      if (propertyData.hasUniqueValue !== undefined) requestBody.hasUniqueValue = propertyData.hasUniqueValue;
      if (propertyData.options !== undefined) requestBody.options = propertyData.options;
      if (propertyData.calculationFormula !== undefined) requestBody.calculationFormula = propertyData.calculationFormula;

      const response = await this.client.apiRequest({
        method: 'PATCH',
        path: `/crm/v3/properties/${objectType}/${propertyName}`,
        body: requestBody
      });

      const data = await response.json();
      return this.transformPropertyResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to update property ${propertyName} for ${objectType}`);
    }
  }

  /**
   * Delete a property
   */
  async deleteProperty(objectType: string, propertyName: string): Promise<void> {
    this.checkInitialized();
    this.validateRequired({ objectType, propertyName }, ['objectType', 'propertyName']);

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/crm/v3/properties/${objectType}/${propertyName}`
      });
    } catch (error) {
      throw this.handleApiError(error, `Failed to delete property ${propertyName} for ${objectType}`);
    }
  }

  /**
   * Get all property groups for a specific object type
   */
  async getPropertyGroups(objectType: string): Promise<PropertyGroupResponse[]> {
    this.checkInitialized();
    this.validateRequired({ objectType }, ['objectType']);

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/properties/${objectType}/groups`
      });

      const data = await response.json();
      return (data.results || []).map((group: any) => this.transformPropertyGroupResponse(group));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get property groups for ${objectType}`);
    }
  }

  /**
   * Get a specific property group by name
   */
  async getPropertyGroup(objectType: string, groupName: string): Promise<PropertyGroupResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType, groupName }, ['objectType', 'groupName']);

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/properties/${objectType}/groups/${groupName}`
      });

      const data = await response.json();
      return this.transformPropertyGroupResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to get property group ${groupName} for ${objectType}`);
    }
  }

  /**
   * Create a new property group
   */
  async createPropertyGroup(objectType: string, groupData: PropertyGroupInput): Promise<PropertyGroupResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType }, ['objectType']);
    this.validateRequired(groupData, ['name', 'displayName']);

    try {
      const requestBody = {
        name: groupData.name,
        displayName: groupData.displayName,
        displayOrder: groupData.displayOrder ?? -1
      };

      const response = await this.client.apiRequest({
        method: 'POST',
        path: `/crm/v3/properties/${objectType}/groups`,
        body: requestBody
      });

      const data = await response.json();
      return this.transformPropertyGroupResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to create property group for ${objectType}`);
    }
  }

  /**
   * Update an existing property group
   */
  async updatePropertyGroup(objectType: string, groupName: string, groupData: Partial<PropertyGroupInput>): Promise<PropertyGroupResponse> {
    this.checkInitialized();
    this.validateRequired({ objectType, groupName }, ['objectType', 'groupName']);

    try {
      const requestBody: any = {};
      
      if (groupData.displayName !== undefined) requestBody.displayName = groupData.displayName;
      if (groupData.displayOrder !== undefined) requestBody.displayOrder = groupData.displayOrder;

      const response = await this.client.apiRequest({
        method: 'PATCH',
        path: `/crm/v3/properties/${objectType}/groups/${groupName}`,
        body: requestBody
      });

      const data = await response.json();
      return this.transformPropertyGroupResponse(data);
    } catch (error) {
      throw this.handleApiError(error, `Failed to update property group ${groupName} for ${objectType}`);
    }
  }

  /**
   * Delete a property group
   */
  async deletePropertyGroup(objectType: string, groupName: string): Promise<void> {
    this.checkInitialized();
    this.validateRequired({ objectType, groupName }, ['objectType', 'groupName']);

    try {
      await this.client.apiRequest({
        method: 'DELETE',
        path: `/crm/v3/properties/${objectType}/groups/${groupName}`
      });
    } catch (error) {
      throw this.handleApiError(error, `Failed to delete property group ${groupName} for ${objectType}`);
    }
  }

  /**
   * Search properties with fuzzy matching using fuse.js
   */
  async searchProperties(options: {
    objectType: string;
    query: string;
    limit?: number;
    includeArchived?: boolean;
    groupName?: string;
  }): Promise<PropertyResponse[]> {
    this.checkInitialized();
    this.validateRequired({ objectType: options.objectType, query: options.query }, ['objectType', 'query']);

    // Get all properties (from cache or API)
    const allProperties = await this.getCachedProperties(
      options.objectType,
      options.includeArchived || false
    );

    // Apply optional group filter
    let propertiesToSearch = allProperties;
    if (options.groupName) {
      propertiesToSearch = allProperties.filter(p => p.groupName === options.groupName);
    }

    // Configure fuse.js for fuzzy search
    const fuse = new Fuse(propertiesToSearch, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'label', weight: 0.3 },
        { name: 'description', weight: 0.2 },
        { name: 'groupName', weight: 0.1 }
      ],
      threshold: 0.4,  // 0 = exact match, 1 = match anything
      includeScore: false
    });

    // Search and limit results
    const limit = Math.min(options.limit || 15, 50);
    const results = fuse.search(options.query).slice(0, limit);

    // Return just the property objects (fuse returns { item: property })
    return results.map(result => result.item);
  }

  /**
   * Get properties from cache or API
   */
  private async getCachedProperties(
    objectType: string,
    includeArchived: boolean
  ): Promise<PropertyResponse[]> {
    const cacheKey = `${objectType}:${includeArchived}`;
    const cached = this.propertyCache.get(cacheKey);

    // Check if cache is valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.properties;
    }

    // Fetch from API
    const properties = await this.getPropertiesFromAPI(objectType, includeArchived);

    // Store in cache
    this.propertyCache.set(cacheKey, {
      properties,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL_MS
    });

    return properties;
  }

  /**
   * Fetch properties from HubSpot API (with archived parameter)
   */
  private async getPropertiesFromAPI(
    objectType: string,
    includeArchived: boolean
  ): Promise<PropertyResponse[]> {
    const queryParams = includeArchived ? '?archived=true' : '';
    const path = `/crm/v3/properties/${objectType}${queryParams}`;

    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path
      });

      const data = await response.json();
      return (data.results || []).map((property: any) => this.transformPropertyResponse(property));
    } catch (error) {
      throw this.handleApiError(error, `Failed to get properties for ${objectType}`);
    }
  }

  /**
   * Clear property cache (useful for testing or manual invalidation)
   */
  clearPropertyCache(objectType?: string): void {
    if (objectType) {
      // Clear specific object type
      const keysToDelete = Array.from(this.propertyCache.keys())
        .filter(key => key.startsWith(`${objectType}:`));
      keysToDelete.forEach(key => this.propertyCache.delete(key));
    } else {
      // Clear all
      this.propertyCache.clear();
    }
  }

  /**
   * Transform property API response to standard format
   */
  private transformPropertyResponse(property: any): PropertyResponse {
    // Debug: Log the raw property response to understand the structure
    if (!property) {
      throw new BcpError('Property response is null or undefined', 'API_ERROR', 500);
    }

    return {
      name: property.name ?? '',
      label: property.label ?? '',
      description: property.description ?? '',
      groupName: property.groupName ?? '',
      type: property.type ?? '',
      fieldType: property.fieldType ?? '',
      options: property.options?.map((option: any) => ({
        label: option.label ?? '',
        value: option.value ?? '',
        displayOrder: option.displayOrder ?? 0,
        hidden: option.hidden ?? false
      })),
      formField: property.formField ?? true, // Default should be true, not false
      displayOrder: property.displayOrder ?? -1, // Default should be -1, not 0
      hidden: property.hidden ?? false,
      hasUniqueValue: property.hasUniqueValue ?? false,
      calculationFormula: property.calculationFormula ?? undefined,
      createdAt: property.createdAt || new Date().toISOString(),
      updatedAt: property.updatedAt || new Date().toISOString(),
      createdUserId: property.createdUserId,
      updatedUserId: property.updatedUserId
    };
  }

  /**
   * Transform property group API response to standard format
   */
  private transformPropertyGroupResponse(group: any): PropertyGroupResponse {
    if (!group) {
      throw new BcpError('Property group response is null or undefined', 'API_ERROR', 500);
    }

    return {
      name: group.name ?? '',
      displayName: group.displayName ?? '',
      displayOrder: group.displayOrder ?? -1, // Default should be -1, not 0
      properties: group.properties ?? []
    };
  }
}