/**
 * Companies Service
 * 
 * Handles all HubSpot company-related API operations.
 * Extends the base service with company-specific functionality.
 */

import { SimplePublicObjectInputForCreate, PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/companies/index.js';
import { HubspotBaseService } from '../../core/base-service.js';

// Basic company properties that can be undefined
export interface CompanyPropertiesInput {
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  [key: string]: string | undefined;
}

// HubSpot API requires all properties to be strings
export interface CompanyProperties {
  name: string;
  domain: string;
  description: string;
  industry: string;
  [key: string]: string;
}

export interface CompanyResponse {
  id: string;
  properties: CompanyProperties;
  createdAt: string;
  updatedAt: string;
}

export class CompaniesService extends HubspotBaseService {
  /**
   * Create a new company
   */
  async createCompany(properties: CompanyPropertiesInput): Promise<CompanyResponse> {
    this.checkInitialized();
    this.validateRequired(properties, ['name']);

    try {
      const apiProperties: { [key: string]: string } = {
        name: properties.name,
        ...(properties.domain && { domain: properties.domain }),
        ...(properties.description && { description: properties.description }),
        ...(properties.industry && { industry: properties.industry })
      };

      const input: SimplePublicObjectInputForCreate = {
        properties: apiProperties,
        associations: []
      };

      const response = await this.client.crm.companies.basicApi.create(input);

      return {
        id: response.id,
        properties: response.properties as CompanyProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create company');
    }
  }

  /**
   * Get company by ID
   */
  async getCompany(id: string): Promise<CompanyResponse> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.companies.basicApi.getById(id);

      return {
        id: response.id,
        properties: response.properties as CompanyProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get company');
    }
  }

  /**
   * Search for companies by domain
   */
  async searchCompaniesByDomain(domain: string): Promise<CompanyResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'domain',
            operator: 'EQ',
            value: domain
          }]
        }],
        sorts: [],
        properties: ['name', 'domain', 'description', 'industry'],
        limit: 100,
        after: 0
      };

      const response = await this.client.crm.companies.searchApi.doSearch(searchRequest);

      return response.results.map(company => ({
        id: company.id,
        properties: company.properties as CompanyProperties,
        createdAt: new Date(company.createdAt).toISOString(),
        updatedAt: new Date(company.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search companies');
    }
  }

  /**
   * Search for companies by name
   */
  async searchCompaniesByName(name: string): Promise<CompanyResponse[]> {
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
        properties: ['name', 'domain', 'description', 'industry'],
        limit: 100,
        after: 0
      };

      const response = await this.client.crm.companies.searchApi.doSearch(searchRequest);

      return response.results.map(company => ({
        id: company.id,
        properties: company.properties as CompanyProperties,
        createdAt: new Date(company.createdAt).toISOString(),
        updatedAt: new Date(company.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search companies');
    }
  }

  /**
   * Get recent companies
   */
  async getRecentCompanies(limit: number = 10): Promise<CompanyResponse[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.companies.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );

      return response.results.map(company => ({
        id: company.id,
        properties: company.properties as CompanyProperties,
        createdAt: new Date(company.createdAt).toISOString(),
        updatedAt: new Date(company.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get recent companies');
    }
  }

  /**
   * Update company properties
   */
  async updateCompany(id: string, properties: Partial<CompanyPropertiesInput>): Promise<CompanyResponse> {
    this.checkInitialized();

    try {
      // Filter out undefined values and ensure string values
      const apiProperties: { [key: string]: string } = Object.fromEntries(
        Object.entries(properties)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      );

      const response = await this.client.crm.companies.basicApi.update(id, {
        properties: apiProperties
      });

      return {
        id: response.id,
        properties: response.properties as CompanyProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update company');
    }
  }

  /**
   * Delete a company
   */
  async deleteCompany(id: string): Promise<void> {
    this.checkInitialized();

    try {
      await this.client.crm.companies.basicApi.archive(id);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to delete company');
    }
  }
}
