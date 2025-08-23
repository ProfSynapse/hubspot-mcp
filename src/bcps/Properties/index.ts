import { ToolDefinition } from '../../core/types.js';

import { tool as listTool } from './list.tool.js';
import { tool as getTool } from './get.tool.js';
import { tool as createTool } from './create.tool.js';
import { tool as updateTool } from './update.tool.js';
import { tool as listGroupsTool } from './listGroups.tool.js';
import { tool as getGroupTool } from './getGroup.tool.js';
import { tool as createGroupTool } from './createGroup.tool.js';
import { tool as updateGroupTool } from './updateGroup.tool.js';

export const propertiesTools: ToolDefinition[] = [
  listTool,
  getTool,
  createTool,
  updateTool,
  listGroupsTool,
  getGroupTool,
  createGroupTool,
  updateGroupTool
];

export const propertiesBCP = {
  name: 'Properties',
  description: 'Tools for managing HubSpot properties and property groups',
  tools: propertiesTools
};

export default propertiesBCP;