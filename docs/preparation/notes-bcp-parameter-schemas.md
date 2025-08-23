# Notes BCP Parameter Schema Analysis

## Overview
The Notes BCP contains 10 tools for managing HubSpot notes and their associations. This analysis documents all parameter schemas used by each tool.

## Tool Parameter Schemas

### 1. addAssociationToNote
- **Required Parameters:**
  - `noteId` (string) - ID of the note to add association to
  - `objectType` (string) - Type of object to associate with
  - `objectId` (string) - ID of the object to associate with
- **Optional Parameters:**
  - `associationType` (string) - Type of association

### 2. create (createNote)
- **Required Parameters:**
  - `content` (string) - Content of the note
- **Optional Parameters:**
  - `ownerId` (string) - HubSpot owner ID for the note
  - `associations` (array) - Array of association objects with:
    - `objectType` (string, required)
    - `objectId` (string, required)
    - `associationType` (string, optional)
  - `metadata` (object) - Additional properties for the note

### 3. createWithAssociations
- **Required Parameters:**
  - `content` (string) - The content of the note
  - `associations` (array) - Array of association objects with:
    - `objectType` (string, required)
    - `objectId` (string, required)
    - `associationType` (string, optional)
- **Optional Parameters:**
  - `timestamp` (string) - The timestamp for the note
  - `ownerId` (string) - The HubSpot owner ID for the note
  - `metadata` (object) - Additional metadata for the note

### 4. delete (deleteNote)
- **Required Parameters:**
  - `id` (string) - ID of the note to delete

### 5. get (getNote)
- **Required Parameters:**
  - `id` (string) - ID of the note to retrieve

### 6. list (listNotes)
- **Required Parameters:** None
- **Optional Parameters:**
  - `ownerId` (string) - Filter notes by owner ID
  - `startTimestamp` (string) - Filter notes created after this timestamp
  - `endTimestamp` (string) - Filter notes created before this timestamp
  - `limit` (integer) - Maximum number of notes to return (1-100, default: 10)
  - `after` (string) - Pagination cursor

### 7. listAssociations (listNoteAssociations)
- **Required Parameters:**
  - `noteId` (string) - ID of the note to list associations for
  - `toObjectType` (string) - Type of object to list associations for (enum: contacts, companies, deals, tickets, products, line_items)
- **Optional Parameters:**
  - `limit` (integer) - Maximum number of associations to return (1-500, default: 100)
  - `after` (string) - Pagination cursor

### 8. recent (getRecentNotes)
- **Required Parameters:** None
- **Optional Parameters:**
  - `limit` (integer) - Maximum number of recent notes to return (1-100, default: 10)

### 9. removeAssociation (removeAssociationFromNote)
- **Required Parameters:**
  - `noteId` (string) - ID of the note to remove association from
  - `objectType` (string) - Type of object to disassociate
  - `objectId` (string) - ID of the object to disassociate

### 10. update (updateNote)
- **Required Parameters:**
  - `id` (string) - ID of the note to update
- **Optional Parameters:**
  - `content` (string) - Updated content of the note
  - `ownerId` (string) - Updated HubSpot owner ID for the note
  - `metadata` (object) - Additional properties to update for the note

## Parameter Naming Patterns Identified

### ID Parameters
- **Generic ID**: `id` - Used in get, delete, update tools
- **Specific ID**: `noteId` - Used in association-related tools (addAssociation, listAssociations, removeAssociation)

### Association Parameters
- **Object Type**: `objectType` - Consistent across all association tools
- **Object ID**: `objectId` - Consistent across all association tools
- **Association Type**: `associationType` - Optional parameter across association tools
- **To Object Type**: `toObjectType` - Used specifically in listAssociations tool (with enum constraint)

### Pagination Parameters
- **Limit**: `limit` - Used consistently across list/recent tools with appropriate constraints
- **After**: `after` - Used consistently for pagination cursors

### Owner Parameters
- **Owner ID**: `ownerId` - Used consistently across create/update/list tools

### Content Parameters
- **Content**: `content` - Used consistently in create/update tools
- **Metadata**: `metadata` - Used consistently as object type for additional properties

## Potential Mismatch Areas

1. **ID Parameter Inconsistency**: 
   - Generic tools use `id` (get, delete, update)
   - Association tools use `noteId` (addAssociation, listAssociations, removeAssociation)

2. **Association Object Structure**:
   - Some tools expect flat parameters (`objectType`, `objectId`)
   - Other tools expect array of association objects

3. **Special Cases**:
   - `listAssociations` uses `toObjectType` instead of `objectType`
   - `createWithAssociations` requires associations array while `create` makes it optional

## Schema Alignment Recommendations

1. **Standardize ID parameters**: Consider whether association tools should use `id` instead of `noteId`
2. **Unify association parameter structure**: Ensure consistent approach to association objects
3. **Review enum constraints**: `toObjectType` has enum constraint while `objectType` does not