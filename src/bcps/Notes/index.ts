/**
 * Notes BCP Index
 *
 * Exports all tools related to HubSpot Notes.
 */

import { tool as createTool } from './create.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as deleteTool } from './delete.tool.js';
import { tool as listTool } from './list.tool.js';
import { tool as recentTool } from './recent.tool.js';
import { tool as addAssociationTool } from './addAssociation.tool.js';
import { tool as removeAssociationTool } from './removeAssociation.tool.js';
import { tool as listAssociationsTool } from './listAssociations.tool.js';
import { tool as createWithAssociationsTool } from './createWithAssociations.tool.js';
import { ToolDefinition } from '../../core/types.js';

/**
 * Array of all Note tools
 */
export const noteTools: ToolDefinition[] = [
  createTool,
  getTool,
  updateTool,
  deleteTool,
  listTool,
  recentTool,
  addAssociationTool,
  removeAssociationTool,
  listAssociationsTool,
  createWithAssociationsTool
];

/**
 * Notes BCP
 */
export const notesBCP = {
  name: 'Notes',
  description: 'Tools for managing notes in HubSpot',
  tools: noteTools
};

export default notesBCP;
