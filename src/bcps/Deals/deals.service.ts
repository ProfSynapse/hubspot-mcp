/**
 * Deals Service
 * 
 * Handles all HubSpot deal-related API operations.
 * Extends the base service with deal-specific functionality.
 */

import { SimplePublicObjectInputForCreate, PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/deals/index.js';
import { HubspotBaseService } from '../../core/base-service.js';

// Basic deal properties that can be undefined
export interface DealPropertiesInput {
  dealname: string;
  pipeline?: string;
  dealstage?: string;
  amount?: string;
  closedate?: string;
  description?: string;
  hubspot_owner_id?: string;
  [key: string]: string | undefined;
}

// HubSpot API requires all properties to be strings
export interface DealProperties {
  dealname: string;
  pipeline: string;
  dealstage: string;
  amount: string;
  closedate: string;
  description: string;
  hubspot_owner_id: string;
  [key: string]: string;
}

export interface DealResponse {
  id: string;
  properties: DealProperties;
  createdAt: string;
  updatedAt: string;
}

export interface DealStage {
  id: string;
  label: string;
  displayOrder: number;
  probability: number;
  closed: boolean;
}

export interface DealPipeline {
  id: string;
  label: string;
  stages: DealStage[];
  default: boolean;
  createdAt: string;
  updatedAt: string;
}

export class DealsService extends HubspotBaseService {
  /**
   * Create a new deal
   */
  async createDeal(properties: DealPropertiesInput): Promise<DealResponse> {
    this.checkInitialized();
    this.validateRequired(properties, ['dealname']);

    try {
      const apiProperties: { [key: string]: string } = {
        dealname: properties.dealname,
        ...(properties.pipeline && { pipeline: properties.pipeline }),
        ...(properties.dealstage && { dealstage: properties.dealstage }),
        ...(properties.amount && { amount: properties.amount }),
        ...(properties.closedate && { closedate: properties.closedate }),
        ...(properties.description && { description: properties.description }),
        ...(properties.hubspot_owner_id && { hubspot_owner_id: properties.hubspot_owner_id })
      };

      const input: SimplePublicObjectInputForCreate = {
        properties: apiProperties,
        associations: []
      };

      const response = await this.client.crm.deals.basicApi.create(input);

      return {
        id: response.id,
        properties: response.properties as DealProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to create deal');
    }
  }

  /**
   * Get deal by ID
   */
  async getDeal(id: string): Promise<DealResponse> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.deals.basicApi.getById(id);

      return {
        id: response.id,
        properties: response.properties as DealProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get deal');
    }
  }

  /**
   * Search for deals
   */
  async searchDeals(searchRequest: PublicObjectSearchRequest): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.deals.searchApi.doSearch(searchRequest);

      return response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties as DealProperties,
        createdAt: new Date(deal.createdAt).toISOString(),
        updatedAt: new Date(deal.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search deals');
    }
  }

  /**
   * Search for deals by name
   */
  async searchDealsByName(name: string): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'dealname',
            operator: 'CONTAINS_TOKEN',
            value: name
          }]
        }],
        sorts: [],
        properties: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description'],
        limit: 100,
        after: 0
      };

      return await this.searchDeals(searchRequest);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search deals by name');
    }
  }

  /**
   * Search for deals modified after a specific date
   */
  async searchDealsByModifiedDate(date: Date): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const searchRequest: PublicObjectSearchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: date.getTime().toString()
          }]
        }],
        sorts: [],
        properties: ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'description'],
        limit: 100,
        after: 0
      };

      return await this.searchDeals(searchRequest);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to search deals by modified date');
    }
  }

  /**
   * Get recent deals
   */
  async getRecentDeals(limit: number = 10): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.deals.basicApi.getPage(
        limit,
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );

      return response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties as DealProperties,
        createdAt: new Date(deal.createdAt).toISOString(),
        updatedAt: new Date(deal.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get recent deals');
    }
  }

  /**
   * Update deal properties
   */
  async updateDeal(id: string, properties: Partial<DealPropertiesInput>): Promise<DealResponse> {
    this.checkInitialized();

    try {
      // Filter out undefined values and ensure string values
      const apiProperties: { [key: string]: string } = Object.fromEntries(
        Object.entries(properties)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      );

      const response = await this.client.crm.deals.basicApi.update(id, {
        properties: apiProperties
      });

      return {
        id: response.id,
        properties: response.properties as DealProperties,
        createdAt: new Date(response.createdAt).toISOString(),
        updatedAt: new Date(response.updatedAt).toISOString()
      };
    } catch (error) {
      throw this.handleApiError(error, 'Failed to update deal');
    }
  }

  /**
   * Delete a deal
   */
  async deleteDeal(id: string): Promise<void> {
    this.checkInitialized();

    try {
      await this.client.crm.deals.basicApi.archive(id);
    } catch (error) {
      throw this.handleApiError(error, 'Failed to delete deal');
    }
  }

  /**
   * Batch create deals
   */
  async batchCreateDeals(dealsInput: DealPropertiesInput[]): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const inputs = dealsInput.map(properties => {
        this.validateRequired(properties, ['dealname']);
        
        const apiProperties: { [key: string]: string } = {
          dealname: properties.dealname,
          ...(properties.pipeline && { pipeline: properties.pipeline }),
          ...(properties.dealstage && { dealstage: properties.dealstage }),
          ...(properties.amount && { amount: properties.amount }),
          ...(properties.closedate && { closedate: properties.closedate }),
          ...(properties.description && { description: properties.description }),
          ...(properties.hubspot_owner_id && { hubspot_owner_id: properties.hubspot_owner_id })
        };

        return {
          properties: apiProperties,
          associations: []
        };
      });

      const response = await this.client.crm.deals.batchApi.create({ inputs });

      return response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties as DealProperties,
        createdAt: new Date(deal.createdAt).toISOString(),
        updatedAt: new Date(deal.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to batch create deals');
    }
  }

  /**
   * Batch update deals
   */
  async batchUpdateDeals(updates: Array<{ id: string; properties: Partial<DealPropertiesInput> }>): Promise<DealResponse[]> {
    this.checkInitialized();

    try {
      const inputs = updates.map(({ id, properties }) => {
        const apiProperties: { [key: string]: string } = Object.fromEntries(
          Object.entries(properties)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, value as string])
        );

        return {
          id,
          properties: apiProperties
        };
      });

      const response = await this.client.crm.deals.batchApi.update({ inputs });

      return response.results.map(deal => ({
        id: deal.id,
        properties: deal.properties as DealProperties,
        createdAt: new Date(deal.createdAt).toISOString(),
        updatedAt: new Date(deal.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to batch update deals');
    }
  }

  /**
   * Get all deal pipelines with their stages
   */
  async getDealPipelines(): Promise<DealPipeline[]> {
    this.checkInitialized();

    try {
      const response = await this.client.crm.pipelines.pipelinesApi.getAll('deals');

      return response.results.map(pipeline => ({
        id: pipeline.id,
        label: pipeline.label,
        stages: pipeline.stages.map(stage => ({
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          probability: (stage.metadata as any)?.probability ? Number((stage.metadata as any).probability) / 100 : 0,
          closed: Boolean((stage.metadata as any)?.isClosed)
        })),
        default: Boolean((pipeline as any).default),
        createdAt: new Date(pipeline.createdAt).toISOString(),
        updatedAt: new Date(pipeline.updatedAt).toISOString()
      }));
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get deal pipelines');
    }
  }

  /**
   * Get all available deal stages across all pipelines
   */
  async getAllDealStages(): Promise<{ stageId: string; stageName: string; pipelineId: string; pipelineName: string }[]> {
    this.checkInitialized();

    try {
      const pipelines = await this.getDealPipelines();
      const stages: { stageId: string; stageName: string; pipelineId: string; pipelineName: string }[] = [];
      
      pipelines.forEach(pipeline => {
        pipeline.stages.forEach(stage => {
          stages.push({
            stageId: stage.id,
            stageName: stage.label,
            pipelineId: pipeline.id,
            pipelineName: pipeline.label
          });
        });
      });
      
      return stages;
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get all deal stages');
    }
  }
}