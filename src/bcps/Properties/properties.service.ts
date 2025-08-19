import { HubspotBaseService } from '../../core/base-service.js';
import { BcpError } from '../../core/types.js';

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
   * Transform property API response to standard format
   */
  private transformPropertyResponse(property: any): PropertyResponse {
    return {
      name: property.name || '',
      label: property.label || '',
      description: property.description || '',
      groupName: property.groupName || '',
      type: property.type || '',
      fieldType: property.fieldType || '',
      options: property.options?.map((option: any) => ({
        label: option.label || '',
        value: option.value || '',
        displayOrder: option.displayOrder || 0,
        hidden: option.hidden || false
      })),
      formField: property.formField || false,
      displayOrder: property.displayOrder || 0,
      hidden: property.hidden || false,
      hasUniqueValue: property.hasUniqueValue || false,
      calculationFormula: property.calculationFormula,
      createdAt: property.createdAt ? new Date(property.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: property.updatedAt ? new Date(property.updatedAt).toISOString() : new Date().toISOString(),
      createdUserId: property.createdUserId,
      updatedUserId: property.updatedUserId
    };
  }

  /**
   * Transform property group API response to standard format
   */
  private transformPropertyGroupResponse(group: any): PropertyGroupResponse {
    return {
      name: group.name || '',
      displayName: group.displayName || '',
      displayOrder: group.displayOrder || 0,
      properties: group.properties || []
    };
  }
}