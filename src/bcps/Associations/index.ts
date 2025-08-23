/**
 * Associations BCP Index
 *
 * Exports all tools related to HubSpot Associations.
 */

import { tool as createTool } from './create.tool.js';
import { tool as createDefaultTool } from './createDefault.tool.js';
import { tool as listTool } from './list.tool.js';
import { tool as batchCreateTool } from './batchCreate.tool.js';
import { tool as batchCreateDefaultTool } from './batchCreateDefault.tool.js';
import { tool as batchReadTool } from './batchRead.tool.js';
import { tool as getAssociationTypesTool } from './getAssociationTypes.tool.js';
import { tool as getAssociationTypeReferenceTool } from './getAssociationTypeReference.tool.js';
import { ToolDefinition } from '../../core/types.js';

/**
 * Array of all Association tools
 */
export const associationTools: ToolDefinition[] = [
  createTool,
  createDefaultTool,
  listTool,
  batchCreateTool,
  batchCreateDefaultTool,
  batchReadTool,
  getAssociationTypesTool,
  getAssociationTypeReferenceTool
];

/**
 * Associations BCP
 */
export const associationsBCP = {
  name: 'Associations',
  description: 'Tools for managing associations between objects in HubSpot',
  tools: associationTools
};

export default associationsBCP;
