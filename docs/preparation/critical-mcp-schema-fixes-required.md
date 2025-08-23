# Critical MCP Schema Fixes Required - Implementation Roadmap

## Executive Summary
Based on comprehensive BCP tool audit, **systematic parameter naming mismatches** require immediate architectural fixes to restore functionality. Current generic MCP schemas are fundamentally incompatible with BCP tool expectations.

## CRITICAL PRIORITY FIXES (Production Blockers)

### 1. Properties BCP - Complete Schema Replacement (HIGHEST PRIORITY)

**Problem**: Properties BCP NEVER uses generic `id` parameter - uses `propertyName` for ALL operations.

**Current Broken Pattern**:
```json
{
  "properties": {
    "id": { "type": "string", "description": "Property ID" }
  },
  "required": ["id"]
}
```

**Required Fix**:
```json
{
  "properties": {
    "objectType": { "type": "string", "description": "HubSpot object type", "required": true },
    "propertyName": { "type": "string", "description": "Property name", "required": true }
  },
  "required": ["objectType", "propertyName"]
}
```

**Operations Requiring Fix**:
- get, delete, update: Replace `id` with `propertyName`
- create: Keep existing complex schema but ensure `propertyName` not `id`
- All group operations: Use `groupName` instead of `id`

**Impact**: 100% Properties functionality restoration

### 2. Notes Association Operations - Conditional Parameter Routing (HIGH PRIORITY)

**Problem**: Notes uses `id` for CRUD but `noteId` for association operations.

**Current Broken Pattern**:
```json
// Generic schema expecting 'id' for all operations
{
  "properties": {
    "id": { "type": "string", "description": "Note ID" }
  }
}
```

**Required Fix - Operation-Aware Routing**:
```json
// For CRUD operations (get, delete, update)
{
  "properties": {
    "id": { "type": "string", "description": "Note ID" }
  }
}

// For association operations (addAssociation, listAssociations, removeAssociation)
{
  "properties": {
    "noteId": { "type": "string", "description": "Note ID" },
    "objectType": { "type": "string", "description": "Object type" },
    "objectId": { "type": "string", "description": "Object ID" }
  }
}

// Special case for listAssociations
{
  "properties": {
    "noteId": { "type": "string", "description": "Note ID" },
    "toObjectType": { 
      "type": "string", 
      "enum": ["contacts", "companies", "deals", "tickets", "products", "line_items"]
    }
  }
}
```

**Impact**: Notes association functionality restoration

## HIGH PRIORITY FIXES (Advanced Feature Blockers)

### 3. Associations BCP - Bidirectional Parameter Schema

**Problem**: Associations uses `fromObjectType`/`fromObjectId` + `toObjectType`/`toObjectId` pattern.

**Required Schema**:
```json
{
  "properties": {
    "fromObjectType": { "type": "string", "description": "Source object type" },
    "fromObjectId": { "type": "string", "description": "Source object ID" },
    "toObjectType": { "type": "string", "description": "Target object type" },
    "toObjectId": { "type": "string", "description": "Target object ID" },
    "associationTypes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "associationCategory": {
            "type": "string",
            "enum": ["HUBSPOT_DEFINED", "USER_DEFINED", "INTEGRATOR_DEFINED"]
          },
          "associationTypeId": { "type": "integer" }
        }
      }
    }
  },
  "required": ["fromObjectType", "fromObjectId", "toObjectType", "toObjectId"]
}
```

### 4. Quotes Line Items - Specialized ID Pattern

**Problem**: Quote line item operations use `quoteId` not generic `id`.

**Operations Requiring Fix**:
- addLineItem, removeLineItem, updateLineItem, listLineItems

**Required Pattern**:
```json
{
  "properties": {
    "quoteId": { "type": "string", "description": "Quote ID" }
  },
  "required": ["quoteId"]
}
```

## MEDIUM PRIORITY FIXES (Validation Enhancements)

### 5. Enum Constraint Enforcement

**Properties Tool Enums**:
- `type`: ["string", "number", "date", "datetime", "enumeration", "bool"]  
- `fieldType`: ["text", "textarea", "select", "radio", "checkbox", "date", "file", "number"]

**Companies Tool Enums**:
- `industry`: [Full list of 62 valid HubSpot industries]

**Associations Tool Enums**:
- `associationCategory`: ["HUBSPOT_DEFINED", "USER_DEFINED", "INTEGRATOR_DEFINED"]

### 6. Complex Structure Validation

**Properties Options Array**:
```json
{
  "options": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "label": { "type": "string" },
        "value": { "type": "string" },
        "displayOrder": { "type": "number" },
        "hidden": { "type": "boolean" }
      },
      "required": ["label", "value"]
    }
  }
}
```

## Implementation Strategy

### Phase 1: Critical Production Fixes (Week 1)
1. **Properties Schema Replacement**: Update all Properties MCP schemas to use `propertyName`
2. **Notes Association Routing**: Implement operation-aware parameter routing for Notes

### Phase 2: Advanced Feature Restoration (Week 2)
1. **Associations Bidirectional Schema**: Implement from/to parameter patterns
2. **Quotes Line Item Schema**: Update line item operations to use `quoteId`

### Phase 3: Validation Enhancement (Week 3)
1. **Enum Constraint Implementation**: Add strict enum validation
2. **Complex Structure Validation**: Implement nested object validation

### Phase 4: Testing & Validation (Week 4)
1. **End-to-End Testing**: Test all priority operations
2. **User Acceptance Testing**: Verify reported issues resolved
3. **Documentation Update**: Update schemas and examples

## Testing Checklist

### Critical Path Tests:
- [ ] Properties: get property with `propertyName` parameter
- [ ] Properties: create property with complex schema
- [ ] Notes: addAssociation with `noteId` parameter
- [ ] Notes: listAssociations with `noteId` and `toObjectType`
- [ ] Associations: create with bidirectional parameters
- [ ] Quotes: addLineItem with `quoteId` parameter

### Validation Tests:
- [ ] Properties: invalid `type` enum rejected
- [ ] Companies: invalid `industry` enum rejected
- [ ] Properties: malformed `options` array rejected
- [ ] Associations: invalid `associationCategory` rejected

## Success Metrics

### Functional Restoration:
- Properties operations: 0% → 100% success rate
- Notes associations: 0% → 100% success rate  
- Associations operations: 0% → 100% success rate
- Quotes line items: 0% → 100% success rate

### User Experience:
- Eliminate "parameter not found" errors
- Restore full BCP functionality
- Enable complex HubSpot operations

This implementation roadmap provides the specific technical changes needed to resolve the systematic parameter mismatch issues identified in the comprehensive BCP audit.