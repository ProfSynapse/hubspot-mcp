# Properties BCP Complete Parameter Audit

## Overview
Complete analysis of ALL Properties BCP tool parameter requirements based on actual inputSchema definitions in the tool files.

## Critical Discovery: Consistent `propertyName` Usage
**CONFIRMED**: Properties BCP NEVER uses generic `id` parameter - ALL property operations use `propertyName` instead.
This is a MAJOR difference from other BCPs and confirms the user testing failure mentioned in the initial context.

---

## Tool-by-Tool Parameter Analysis

### 1. create.tool.ts
- **Tool Name**: `createProperty`
- **Required Parameters**: `objectType`, `name`, `label`, `groupName`, `type`, `fieldType`
- **Optional Parameters**: `description`, `options`, `formField`, `displayOrder`, `hidden`, `hasUniqueValue`, `calculationFormula`
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type to create the property for"
  - `name`: string - "The internal name of the property (must be unique, lowercase, no spaces)"
  - `label`: string - "The display label for the property"
  - `description`: string - "Optional description of the property"
  - `groupName`: string - "Property group name to organize the property (required)"
  - `type`: enum - ["string", "number", "date", "datetime", "enumeration", "bool"]
  - `fieldType`: enum - ["text", "textarea", "select", "radio", "checkbox", "date", "file", "number"]
  - `options`: array - Complex array of objects for enumeration properties
    - Array items: `label` (string, required), `value` (string, required), `displayOrder` (number), `hidden` (boolean)
  - `formField`: boolean - Default: true
  - `displayOrder`: number - Default: -1
  - `hidden`: boolean - Default: false
  - `hasUniqueValue`: boolean - Default: false
  - `calculationFormula`: string
- **Complex Structures**: options array with nested object validation

### 2. delete.tool.ts
- **Tool Name**: `deleteProperty`
- **Required Parameters**: `objectType`, `propertyName`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `propertyName`: string - "The name of the property to delete"
- **Critical Note**: Uses `propertyName` NOT `id`

### 3. get.tool.ts
- **Tool Name**: `getProperty`
- **Required Parameters**: `objectType`, `propertyName`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `propertyName`: string - "The name of the property to retrieve"
- **Critical Note**: Uses `propertyName` NOT `id`

### 4. update.tool.ts
- **Tool Name**: `updateProperty`
- **Required Parameters**: `objectType`, `propertyName`
- **Optional Parameters**: `label`, `description`, `groupName`, `type`, `fieldType`, `options`, `formField`, `displayOrder`, `hidden`, `hasUniqueValue`, `calculationFormula`
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `propertyName`: string - "The name of the property to update"
  - [All update fields same types as create operation]
- **Critical Note**: Uses `propertyName` NOT `id`

### 5. list.tool.ts
- **Tool Name**: `listProperties`
- **Required Parameters**: `objectType`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type to get properties for"

### 6. createGroup.tool.ts
- **Tool Name**: `createPropertyGroup`
- **Required Parameters**: `objectType`, `name`, `displayName`
- **Optional Parameters**: `displayOrder`
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type to create the property group for"
  - `name`: string - "The internal name of the property group (must be unique, lowercase, no spaces)"
  - `displayName`: string - "The display name for the property group"
  - `displayOrder`: number - Default: -1

### 7. deleteGroup.tool.ts
- **Tool Name**: `deletePropertyGroup`
- **Required Parameters**: `objectType`, `groupName`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `groupName`: string - "The name of the property group to delete"

### 8. getGroup.tool.ts
- **Tool Name**: `getPropertyGroup`
- **Required Parameters**: `objectType`, `groupName`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `groupName`: string - "The name of the property group to retrieve"

### 9. listGroups.tool.ts
- **Tool Name**: `listPropertyGroups`
- **Required Parameters**: `objectType`
- **Optional Parameters**: None
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type to get property groups for"

### 10. updateGroup.tool.ts
- **Tool Name**: `updatePropertyGroup`
- **Required Parameters**: `objectType`, `groupName`
- **Optional Parameters**: `displayName`, `displayOrder`
- **Parameter Types**:
  - `objectType`: string - "The HubSpot object type"
  - `groupName`: string - "The name of the property group to update"
  - `displayName`: string - "Updated display name for the property group"
  - `displayOrder`: number - "Updated display order for the property group"

---

## Parameter Naming Patterns Summary

### ID Parameter Usage:
**COMPLETELY DIFFERENT FROM OTHER BCPs**: Properties BCP uses `propertyName` for ALL property identification operations:
- get, delete, update: Use `propertyName` (NOT `id`)
- Property group operations: Use `groupName` (NOT `id`)

### Object Type Parameter Usage:
- **Consistent `objectType`**: Used across ALL operations
- **Always required**: No operations work without specifying the object type

### Property Group Operations:
- **Consistent `groupName`**: Used for all group identification (get, delete, update)
- **Create operations**: Use `name` for new group creation, `displayName` for UI display

### Complex Structures:
1. **options array** (create, update): Array of enumeration option objects
   - Required per item: `label`, `value`
   - Optional per item: `displayOrder`, `hidden`
2. **Enum validations**: `type` and `fieldType` have strict enum constraints
3. **Boolean defaults**: Several boolean parameters with explicit defaults

---

## Critical Mismatches Identified

### 1. Property Identification Parameter
- **Problem**: Properties BCP uses `propertyName` for ALL property operations, NEVER uses generic `id`
- **Impact**: ALL property operations fail if MCP schema expects generic `id`
- **User Testing Confirmation**: This matches the user-reported issue
- **Required Fix**: MCP schemas must use `propertyName` instead of `id` for Properties domain

### 2. Group Identification Parameter
- **Problem**: Property group operations use `groupName`, not generic `id`
- **Impact**: Group operations would fail with generic schemas
- **Required Fix**: MCP schemas must use `groupName` for group operations

### 3. Required Object Type
- **Problem**: ALL Properties operations require `objectType` - no operations work without it
- **Impact**: Generic schemas that make `objectType` optional would fail
- **Required Fix**: MCP schemas must mark `objectType` as required for ALL Properties operations

### 4. Complex Enum Validations
- **Problem**: `type` and `fieldType` have strict enum constraints not in generic schemas
- **Impact**: Invalid values pass MCP validation but fail at BCP level
- **Required Fix**: MCP schemas must include exact enum values

### 5. Complex Options Array Structure
- **Problem**: enumeration properties require specific array structure with nested validation
- **Impact**: Malformed options arrays pass generic validation but fail at BCP level
- **Required Fix**: Proper nested array object validation in MCP schemas

---

## MCP Schema Recommendations

### For Property Operations:
- **NEVER use generic `id`** - always use `propertyName`
- **ALWAYS require `objectType`** - no optional object type parameters
- Include enum validation for `type` and `fieldType` parameters
- Implement proper array validation for `options` with nested object structure

### For Group Operations:
- Use `groupName` instead of generic `id` for identification
- **ALWAYS require `objectType`** for all group operations
- Support proper display name vs internal name distinction

### Critical Fix Priority:
**HIGHEST PRIORITY**: The `propertyName` vs `id` mismatch is a complete blocker for Properties functionality and matches the exact user testing failure scenario described.

This analysis confirms that Properties BCP is fundamentally incompatible with generic ID-based schemas.