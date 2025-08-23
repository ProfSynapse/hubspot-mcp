/**
 * Notes BCP
 * 
 * Provides tools for managing HubSpot notes, including creation with associations,
 * retrieval, updating, and listing notes for different object types.
 */

import { BCP } from '../../core/types.js';
import { tool as getTool } from './notes.get.js';
import { tool as updateTool } from './notes.update.js';
import { tool as createContactNoteTool } from './notes.createContactNote.js';
import { tool as createCompanyNoteTool } from './notes.createCompanyNote.js';
import { tool as createDealNoteTool } from './notes.createDealNote.js';
import { tool as listContactNotesTool } from './notes.listContactNotes.js';
import { tool as listCompanyNotesTool } from './notes.listCompanyNotes.js';
import { tool as listDealNotesTool } from './notes.listDealNotes.js';

/**
 * Notes BCP definition
 */
export const notesBCP: BCP = {
  domain: 'Notes',
  description: 'HubSpot notes management tools',
  tools: [
    getTool,
    updateTool,
    createContactNoteTool,
    createCompanyNoteTool,
    createDealNoteTool,
    listContactNotesTool,
    listCompanyNotesTool,
    listDealNotesTool
  ]
};

/**
 * Array of Notes tools for compatibility
 */
export const noteTools = notesBCP.tools;
