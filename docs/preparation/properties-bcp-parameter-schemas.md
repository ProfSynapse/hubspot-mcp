# Properties BCP Parameter Schema Analysis

## Overview
The Properties BCP contains 10 tools for managing HubSpot properties and property groups. This analysis documents all parameter schemas used by each tool.

## Tool Parameter Schemas

### Property Management Tools

### 1. create (createProperty)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type to create property for
  - `name` (string) - Internal name of the property (unique, lowercase, no spaces)
  - `label` (string) - Display label for the property
  - `groupName` (string) - Property group name to organize the property
  - `type` (string, enum) - Data type: string, number, date, datetime, enumeration, bool
  - `fieldType` (string, enum) - Form field type: text, textarea, select, radio, checkbox, date, file, number
- **Optional Parameters:**
  - `description` (string) - Description of the property
  - `options` (array) - Array of options for enumeration type properties (with label, value, displayOrder, hidden)
  - `formField` (boolean) - Whether property should appear in forms
  - `displayOrder` (number) - Display order for the property
  - `hidden` (boolean) - Whether the property is hidden
  - `hasUniqueValue` (boolean) - Whether property values must be unique
  - `calculationFormula` (string) - Formula for calculated properties

### 2. get (getProperty)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `propertyName` (string) - The name of the property to retrieve

### 3. delete (deleteProperty)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `propertyName` (string) - The name of the property to delete

### 4. update (updateProperty)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `propertyName` (string) - The name of the property to update
- **Optional Parameters:**
  - `label` (string) - Updated display label for the property
  - `description` (string) - Updated description of the property
  - `groupName` (string) - Updated property group name
  - `type` (string, enum) - Updated data type: string, number, date, datetime, enumeration, bool
  - `fieldType` (string, enum) - Updated form field type: text, textarea, select, radio, checkbox, date, file, number
  - `options` (array) - Updated array of options for enumeration type properties
  - `formField` (boolean) - Whether the property should appear in forms
  - `displayOrder` (number) - Updated display order for the property
  - `hidden` (boolean) - Whether the property is hidden
  - `hasUniqueValue` (boolean) - Whether the property values must be unique
  - `calculationFormula` (string) - Updated formula for calculated properties

### 5. list (listProperties)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type to get properties for

### Property Group Management Tools

### 6. createGroup (createPropertyGroup)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type to create property group for
  - `name` (string) - Internal name of the property group (unique, lowercase, no spaces)
  - `displayName` (string) - Display name for the property group
- **Optional Parameters:**
  - `displayOrder` (number) - Display order for the property group

### 7. getGroup (getPropertyGroup)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `groupName` (string) - The name of the property group to retrieve

### 8. deleteGroup (deletePropertyGroup)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `groupName` (string) - The name of the property group to delete

### 9. updateGroup (updatePropertyGroup)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type
  - `groupName` (string) - The name of the property group to update
- **Optional Parameters:**
  - `displayName` (string) - Updated display name for the property group
  - `displayOrder` (number) - Updated display order for the property group

### 10. listGroups (listPropertyGroups)
- **Required Parameters:**
  - `objectType` (string) - The HubSpot object type to get property groups for

## Parameter Naming Patterns Identified

### Core Object Parameters
- **Object Type**: `objectType` - Consistently used across all tools to specify HubSpot object type

### Property Identification
- **Property Name**: `propertyName` - Used consistently for property identification in get, delete, update tools
- **Property Label**: `label` - Used for display names in create and update tools
- **Internal Name**: `name` - Used in create tools for internal naming

### Group Identification
- **Group Name**: `groupName` - Used consistently for property group identification

### Display and Organization Parameters
- **Display Name**: `displayName` - Used consistently for human-readable names of groups
- **Display Order**: `displayOrder` - Used consistently for ordering properties and groups

### Type and Structure Parameters
- **Type**: `type` - Used with enum constraints for data types
- **Field Type**: `fieldType` - Used with enum constraints for form field types
- **Options**: `options` - Used for enumeration properties with consistent array structure

### Metadata Parameters
- **Description**: `description` - Used consistently for descriptive text
- **Hidden**: `hidden` - Used consistently as boolean flag
- **Form Field**: `formField` - Used consistently as boolean flag
- **Has Unique Value**: `hasUniqueValue` - Used consistently as boolean flag

## Potential Mismatch Areas

### 1. Property Identification Inconsistency
- Create tool uses `name` for internal property name
- Other tools use `propertyName` for property identification
- This could cause confusion when mapping between MCP layer and BCP layer

### 2. Naming Convention Patterns
- Properties use `propertyName` consistently
- Groups use `groupName` consistently
- But create operations use `name` instead

### 3. Complex Parameter Structures
- **Options array** has nested object structure with required/optional fields
- This complex structure might need special handling in delegation layer

## Schema Alignment Recommendations

1. **Standardize property identification**: Consider whether create tool should use `propertyName` instead of `name`
2. **Review parameter mapping**: Ensure MCP layer properly maps to BCP property identification patterns
3. **Handle complex structures**: Special attention needed for `options` array parameter structure
4. **Maintain consistency**: Good pattern established with `objectType`, `groupName`, `displayName`, `displayOrder`