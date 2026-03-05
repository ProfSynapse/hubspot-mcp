/**
 * Associations BCP Index
 *
 * Exports all tools related to HubSpot Associations.
 */

import { tool as createTool } from './associations.create.js';
import { tool as createDefaultTool } from './associations.createDefault.js';
import { tool as listTool } from './associations.list.js';
import { tool as batchCreateTool } from './associations.batchCreate.js';
import { tool as batchCreateDefaultTool } from './associations.batchCreateDefault.js';
import { tool as batchReadTool } from './associations.batchRead.js';
import { tool as getAssociationTypesTool } from './associations.getAssociationTypes.js';
import { tool as getAssociationTypeReferenceTool } from './associations.getAssociationTypeReference.js';
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
