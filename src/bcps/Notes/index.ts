/**
 * Notes BCP Index - Updated for Unified Tool
 *
 * Exports the unified Notes tool that replaces the complex multi-tool interface
 * with a single, intent-driven tool following the architect's specifications.
 */

import { tool as unifiedNotesTool } from './unified-notes.tool.js';
import { ToolDefinition } from '../../core/types.js';

/**
 * Array of unified Note tools
 */
export const noteTools: ToolDefinition[] = [
  unifiedNotesTool
];

/**
 * Notes BCP with simplified tool set
 */
export const notesBCP = {
  name: 'Notes',
  description: 'Unified tool for managing notes in HubSpot with automatic associations',
  tools: noteTools
};

export default notesBCP;
