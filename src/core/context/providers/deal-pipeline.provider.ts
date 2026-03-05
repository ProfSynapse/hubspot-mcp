/**
 * Deal Pipeline Context Provider
 *
 * Provides dynamic context for deal pipeline and stage fields by fetching
 * available pipelines and stages from HubSpot at server startup.
 */

import { BaseContextProvider, SchemaContext, ContextProviderError } from '../types.js';
import { DealsService } from '../../../bcps/Deals/deals.service.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger({
  level: 'info',
  environment: 'development',
  serviceName: 'deal-pipeline-provider',
  version: '0.1.0'
});

/**
 * Context provider for deal pipelines and stages
 */
export class DealPipelineContextProvider extends BaseContextProvider {
  readonly domain = 'Deals';
  readonly fields = ['pipeline', 'dealstage'];
  readonly name = 'DealPipelineContextProvider';

  private dealsService?: DealsService;
  private pipelines: Array<{
    id: string;
    label: string;
    stages: Array<{
      id: string;
      label: string;
      displayOrder: number;
      probability: number;
      closed: boolean;
    }>;
    default: boolean;
  }> = [];

  /**
   * Initialize the provider by fetching pipeline data from HubSpot
   */
  async initialize(apiKey: string): Promise<void> {
    try {
      logger.info('Initializing Deal Pipeline Context Provider...');

      // Create and initialize deals service
      this.dealsService = new DealsService({ hubspotAccessToken: apiKey });
      await this.dealsService.init();

      // Fetch all pipelines and their stages
      this.pipelines = await this.dealsService.getDealPipelines();

      if (this.pipelines.length === 0) {
        throw new Error('No deal pipelines found in HubSpot account');
      }

      // Log pipeline information
      const pipelineCount = this.pipelines.length;
      const stageCount = this.pipelines.reduce((total, p) => total + p.stages.length, 0);
      const defaultPipeline = this.pipelines.find(p => p.default);

      logger.info(`Found ${pipelineCount} pipelines with ${stageCount} total stages`);
      if (defaultPipeline) {
        logger.info(`Default pipeline: ${defaultPipeline.label} (${defaultPipeline.id})`);
      }

      // Debug log pipeline details
      for (const pipeline of this.pipelines) {
        logger.debug(`Pipeline: ${pipeline.label} (${pipeline.id}) - ${pipeline.stages.length} stages`);
      }

      this.setInitialized(true);
      logger.info('✅ Deal Pipeline Context Provider initialized successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to initialize Deal Pipeline Context Provider: ${errorMessage}`);
      throw new ContextProviderError(this.name, errorMessage, error as Error);
    }
  }

  /**
   * Get all context provided by this provider
   */
  getContext(): SchemaContext[] {
    if (!this.isInitialized() || this.pipelines.length === 0) {
      return [];
    }

    return [
      this.getPipelineContext(),
      this.getDealStageContext()
    ];
  }

  /**
   * Get pipeline context
   */
  private getPipelineContext(): SchemaContext {
    const values = this.pipelines.map(pipeline => ({
      value: pipeline.id,
      label: pipeline.label,
      description: pipeline.default ? 'Default pipeline' : undefined
    }));

    // Sort so default pipeline comes first
    values.sort((a, b) => {
      if (a.description && !b.description) return -1;
      if (!a.description && b.description) return 1;
      return a.label.localeCompare(b.label);
    });

    return {
      field: 'pipeline',
      values,
      description: 'Available sales pipelines',
      required: true
    };
  }

  /**
   * Get deal stage context (all stages across all pipelines)
   */
  private getDealStageContext(): SchemaContext {
    const values: Array<{
      value: string;
      label: string;
      description?: string;
    }> = [];

    for (const pipeline of this.pipelines) {
      // Sort stages by display order
      const sortedStages = [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder);

      for (const stage of sortedStages) {
        values.push({
          value: stage.id,
          label: stage.label,
          description: `${pipeline.label} - ${stage.probability * 100}% probability${stage.closed ? ' (Closed)' : ''}`
        });
      }
    }

    return {
      field: 'dealstage',
      values,
      description: 'Available deal stages across all pipelines',
      required: true
    };
  }

  /**
   * Pipeline context is required - server should fail if it can't load pipelines
   */
  isRequired(): boolean {
    return true;
  }

  /**
   * Get pipeline information for validation purposes
   */
  getPipelinesInfo(): Array<{
    id: string;
    label: string;
    stageIds: string[];
    isDefault: boolean;
  }> {
    return this.pipelines.map(pipeline => ({
      id: pipeline.id,
      label: pipeline.label,
      stageIds: pipeline.stages.map(stage => stage.id),
      isDefault: pipeline.default
    }));
  }

  /**
   * Validate that a stage belongs to a specific pipeline
   */
  validateStageForPipeline(pipelineId: string, stageId: string): boolean {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) {
      return false;
    }

    return pipeline.stages.some(stage => stage.id === stageId);
  }

  /**
   * Get the default pipeline ID
   */
  getDefaultPipelineId(): string | undefined {
    const defaultPipeline = this.pipelines.find(p => p.default);
    return defaultPipeline?.id;
  }

  /**
   * Get stages for a specific pipeline
   */
  getStagesForPipeline(pipelineId: string): Array<{
    id: string;
    label: string;
    displayOrder: number;
    probability: number;
    closed: boolean;
  }> {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    return pipeline ? [...pipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder) : [];
  }
}