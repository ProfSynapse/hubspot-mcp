/**
 * Location: /src/bcps/Notes/unified-notes.types.ts
 * 
 * Type definitions for the unified Notes tool architecture.
 * Provides helper types for the intent-based Notes operations.
 * 
 * Used by:
 * - src/bcps/Notes/notes.service.ts: Imports helper types
 * - src/bcps/Notes/unified-notes.tool.ts: Imports operation parameter types
 */

// Helper types for unified Notes tool service methods
export interface CreateNoteOptions {
  ownerId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ListNotesOptions {
  limit?: number;
  after?: string;
  startDate?: string;
  endDate?: string;
}