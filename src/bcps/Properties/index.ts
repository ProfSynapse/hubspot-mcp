import { ToolDefinition } from '../../core/types.js';

import { tool as listTool } from './properties.list.js';
import { tool as getTool } from './properties.get.js';
import { tool as createTool } from './properties.create.js';
import { tool as updateTool } from './properties.update.js';
import { tool as listGroupsTool } from './properties.listGroups.js';
import { tool as getGroupTool } from './properties.getGroup.js';
import { tool as createGroupTool } from './properties.createGroup.js';
import { tool as updateGroupTool } from './properties.updateGroup.js';

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