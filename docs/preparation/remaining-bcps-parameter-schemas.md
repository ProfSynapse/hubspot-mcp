# Remaining BCPs Parameter Schema Analysis

## Contacts BCP Parameter Patterns

### Key Characteristics:
- **ID Parameter**: Uses generic `id` consistently (get, delete, update)
- **Core Parameters**: `email` (required), `firstName`, `lastName`, `phone`, `company`
- **Extension Pattern**: `additionalProperties` object for custom fields
- **Search Parameters**: `searchType` (enum), `searchTerm`, `limit`
- **Pagination**: Standard `limit` parameter (1-100)

### Parameter Naming Consistency:
- Follows same pattern as Companies BCP
- Uses generic `id` for CRUD operations
- Has `additionalProperties` extension mechanism

## Associations BCP Parameter Patterns

### Key Characteristics:
- **Complex Association Structure**: Uses `fromObjectType`/`fromObjectId` and `toObjectType`/`toObjectId`
- **Association Types**: Complex array with `associationCategory` and `associationTypeId`
- **List Operations**: Uses `objectType`/`objectId` + `toObjectType` pattern
- **Batch Operations**: Multiple create/delete operations with arrays
- **Reference Operations**: Special tools for association type management

### Critical Mismatches:
- **Directional Parameters**: `from`/`to` prefixes not used in other BCPs
- **Complex Type Arrays**: `associationTypes` array has nested object structure
- **Mixed Parameter Patterns**: Different tools use different parameter combinations

## Deals BCP Parameter Patterns

### Key Characteristics:
- **ID Parameter**: Uses generic `id` consistently
- **Core Parameters**: `dealname` (required), `pipeline`, `dealstage`, `amount`, `closedate`
- **Owner Parameter**: `hubspot_owner_id` (with underscores, different from other BCPs)
- **Extension Pattern**: `additionalProperties` object
- **Batch Operations**: Similar to other BCPs with array inputs

### Parameter Naming Note:
- Uses HubSpot's internal property names (`dealname`, `dealstage`, `hubspot_owner_id`)
- Different naming convention from other BCPs which use camelCase

## Products BCP Parameter Patterns

### Key Characteristics:
- **ID Parameter**: Uses generic `id` consistently
- **Simple Structure**: Minimal parameter complexity
- **Search Parameters**: Standard `searchTerm`, `limit` pattern
- **No Complex Associations**: Straightforward CRUD operations

### Simplest Parameter Structure:
- Most consistent with generic ID usage
- Minimal parameter validation complexity

## Emails BCP Parameter Patterns

### Key Characteristics:
- **ID Parameter**: Uses generic `id` consistently
- **Service-Based**: Uses EmailsService for operations
- **Error Handling**: Enhanced error handling with specific error types
- **Standard CRUD**: Get, create, delete, update, list, recent operations

### Consistent Patterns:
- Follows standard BCP patterns
- No association complexity
- Standard parameter naming

## BlogPosts BCP Parameter Patterns

### Key Characteristics:
- **ID Parameter**: Uses generic `id` consistently
- **Standard Operations**: Create, get, delete, update, list, recent
- **Simple Parameter Structure**: No complex nested objects
- **Consistent Naming**: Follows standard BCP conventions

## Quotes BCP Parameter Patterns

### Key Characteristics:
- **Specific ID Usage**: Uses `quoteId` for line item operations
- **Complex Line Items**: Extensive line item properties with billing parameters
- **Enum Constraints**: Billing period enums (`monthly`, `quarterly`, etc.)
- **Product Integration**: `productId` parameter for HubSpot product library integration

### Notable Mismatch:
- **Quote-Specific ID**: Uses `quoteId` instead of generic `id` for line item tools
- **Complex Properties**: Extensive line item property structures

## Cross-BCP Parameter Pattern Summary

### Consistent Patterns Across BCPs:
1. **Generic ID Usage**: Most BCPs use `id` for CRUD operations
2. **Limit Parameters**: Consistent `limit` with 1-100 constraints
3. **Additional Properties**: Many BCPs use extension object patterns
4. **Search Patterns**: `searchType`/`searchTerm` combinations

### Major Inconsistencies:
1. **Specific vs Generic IDs**: 
   - Notes: `id` vs `noteId`
   - Quotes: `id` vs `quoteId`
   - Properties: `propertyName` vs `id`

2. **Association Parameter Complexity**:
   - Simple: `objectType`/`objectId`
   - Complex: `fromObjectType`/`toObjectType`
   - Specialized: `toObjectType` for filtering

3. **Extension Pattern Variations**:
   - `additionalProperties` (Companies, Contacts, Deals)
   - `metadata` (Notes)
   - Domain-specific parameters (Quotes line items)

4. **Naming Conventions**:
   - camelCase (most BCPs)
   - snake_case (Deals: `hubspot_owner_id`)
   - HubSpot internal names (Deals: `dealname`, `dealstage`)

### Critical Schema Alignment Needs:
1. **ID Parameter Unification**: Decide on generic vs specific ID patterns
2. **Association Parameter Standardization**: Handle complex association structures
3. **Extension Pattern Consistency**: Standardize additional property mechanisms
4. **Naming Convention Alignment**: Address camelCase vs snake_case inconsistencies

This analysis confirms that the major parameter naming mismatches are concentrated in:
- ID parameter usage patterns
- Association-related parameter complexity
- Extension mechanism variations
- Cross-BCP naming convention inconsistencies