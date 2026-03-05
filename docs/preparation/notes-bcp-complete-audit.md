# Notes BCP Complete Parameter Audit

## Overview
Complete analysis of ALL Notes BCP tool parameter requirements based on actual inputSchema definitions in the tool files.

## Critical Discovery: Parameter Naming Inconsistency
**CONFIRMED MISMATCH**: Notes BCP uses TWO DIFFERENT ID parameter patterns:
- **Generic Operations**: Use `id` parameter (get, delete, update)
- **Association Operations**: Use `noteId` parameter (addAssociation, listAssociations, removeAssociation)

This explains the user testing failures - our MCP schemas assume consistent parameter naming.

---

## Tool-by-Tool Parameter Analysis

### 1. addAssociation.tool.ts
- **Tool Name**: `addAssociationToNote`
- **Required Parameters**: `noteId`, `objectType`, `objectId`
- **Optional Parameters**: `associationType`
- **Parameter Types**:
  - `noteId`: string - "ID of the note to add an association to"
  - `objectType`: string - "Type of object to associate with (e.g., "contacts", "companies", "deals", "tickets")"
  - `objectId`: string - "ID of the object to associate with"
  - `associationType`: string - "Type of association (optional, defaults to standard association for the object type)"
- **Critical Issue**: Uses `noteId` NOT `id`

### 2. create.tool.ts
- **Tool Name**: `createNote`
- **Required Parameters**: `content`
- **Optional Parameters**: `ownerId`, `associations`, `metadata`
- **Parameter Types**:
  - `content`: string - "Content of the note"
  - `ownerId`: string - "HubSpot owner ID for the note"
  - `associations`: array - "Associations to link this note with"
    - Array items: `objectType` (string, required), `objectId` (string, required), `associationType` (string, optional)
  - `metadata`: object - "Additional properties for the note"
- **Complex Structure**: associations array with nested object validation

### 3. createWithAssociations.tool.ts
- **Tool Name**: `createNoteWithAssociations`
- **Required Parameters**: `content`, `associations`
- **Optional Parameters**: `timestamp`, `ownerId`, `metadata`
- **Parameter Types**:
  - `content`: string - "The content of the note"
  - `associations`: array (required) - "Objects to associate with the note"
    - Array items: `objectType` (string, required), `objectId` (string, required), `associationType` (string, optional)
  - `timestamp`: string - "The timestamp for the note (ISO string or milliseconds since epoch)"
  - `ownerId`: string - "The HubSpot owner ID for the note"
  - `metadata`: object - "Additional metadata for the note"

### 4. delete.tool.ts
- **Tool Name**: `deleteNote`
- **Required Parameters**: `id`
- **Optional Parameters**: None
- **Parameter Types**:
  - `id`: string - "ID of the note to delete"
- **Note**: Uses generic `id` parameter

### 5. get.tool.ts
- **Tool Name**: `getNote`
- **Required Parameters**: `id`
- **Optional Parameters**: None
- **Parameter Types**:
  - `id`: string - "ID of the note to retrieve"
- **Note**: Uses generic `id` parameter

### 6. listAssociations.tool.ts
- **Tool Name**: `listNoteAssociations`
- **Required Parameters**: `noteId`, `toObjectType`
- **Optional Parameters**: `limit`, `after`
- **Parameter Types**:
  - `noteId`: string - "ID of the note to list associations for"
  - `toObjectType`: string with enum - Valid values: ["contacts", "companies", "deals", "tickets", "products", "line_items"]
  - `limit`: integer - Min: 1, Max: 500, Default: 100
  - `after`: string - "Pagination cursor for retrieving the next page of results"
- **Critical Issues**: 
  - Uses `noteId` NOT `id`
  - Uses `toObjectType` NOT `objectType`
  - Enum validation for `toObjectType`

### 7. list.tool.ts
- **Tool Name**: `listNotes`
- **Required Parameters**: None (all optional)
- **Optional Parameters**: `ownerId`, `startTimestamp`, `endTimestamp`, `limit`, `after`
- **Parameter Types**:
  - `ownerId`: string - "Filter notes by owner ID"
  - `startTimestamp`: string - "Filter notes created after this timestamp (ISO 8601 format)"
  - `endTimestamp`: string - "Filter notes created before this timestamp (ISO 8601 format)"
  - `limit`: integer - Min: 1, Max: 100, Default: 10
  - `after`: string - "Pagination cursor for retrieving the next page of results"

### 8. recent.tool.ts
- **Tool Name**: `getRecentNotes`
- **Required Parameters**: None
- **Optional Parameters**: `limit`
- **Parameter Types**:
  - `limit`: integer - Min: 1, Max: 100, Default: 10

### 9. update.tool.ts
- **Tool Name**: `updateNote`
- **Required Parameters**: `id`
- **Optional Parameters**: `content`, `ownerId`, `metadata`
- **Parameter Types**:
  - `id`: string - "ID of the note to update"
  - `content`: string - "Updated content of the note"
  - `ownerId`: string - "Updated HubSpot owner ID for the note"
  - `metadata`: object - "Additional properties to update for the note"
- **Note**: Uses generic `id` parameter

### 10. removeAssociation.tool.ts
- **Tool Name**: `removeAssociationFromNote`
- **Required Parameters**: `noteId`, `objectType`, `objectId`
- **Optional Parameters**: None
- **Parameter Types**:
  - `noteId`: string - "ID of the note to remove an association from"
  - `objectType`: string - "Type of object to disassociate (e.g., "contacts", "companies", "deals", "tickets")"
  - `objectId`: string - "ID of the object to disassociate"
- **Critical Issue**: Uses `noteId` NOT `id`

---

## Parameter Naming Patterns Summary

### ID Parameter Usage:
1. **Generic `id`**: delete, get, update
2. **Specific `noteId`**: addAssociation, listAssociations, removeAssociation

### Object Type Parameter Usage:
1. **Standard `objectType`**: addAssociation, removeAssociation, create (associations), createWithAssociations (associations)
2. **List-specific `toObjectType`**: listAssociations (with enum validation)

### Association Parameter Patterns:
1. **Simple Association**: `objectType`, `objectId`, `associationType` (optional)
2. **Array Associations**: Nested objects in arrays with same parameter structure
3. **List Association**: `noteId`, `toObjectType` with enum validation

### Complex Structures:
1. **associations array** (create, createWithAssociations): Array of objects with objectType, objectId, associationType
2. **metadata object** (create, createWithAssociations, update): Open object for additional properties
3. **Pagination parameters**: `limit`, `after` used consistently across listing operations

---

## Critical Mismatches Identified

### 1. ID Parameter Inconsistency
- **Problem**: Association tools expect `noteId` but generic operations use `id`
- **Impact**: Parameter validation failures in MCP layer
- **Required Fix**: MCP schemas must handle both parameter names

### 2. Object Type Parameter Variation  
- **Problem**: `objectType` vs `toObjectType` for different operations
- **Impact**: List association operations fail validation
- **Required Fix**: Schema must support both variations

### 3. Enum Validation Missing
- **Problem**: `toObjectType` has enum constraints not reflected in generic schemas
- **Impact**: Invalid object types pass MCP validation but fail at BCP level
- **Required Fix**: MCP schemas must include enum validation

### 4. Complex Array Structure
- **Problem**: associations array has nested validation requirements
- **Impact**: Invalid association objects may pass generic validation
- **Required Fix**: Proper nested object validation in MCP schemas

---

## MCP Schema Recommendations

### For Association Operations:
- Support both `id` and `noteId` parameters 
- Support both `objectType` and `toObjectType` parameters
- Include enum validation for `toObjectType` in list operations
- Implement proper array validation for association objects

### For Standard Operations:
- Maintain existing `id` parameter support
- Add proper metadata object validation
- Include proper pagination parameter support

This analysis confirms the critical parameter naming mismatches causing user testing failures.